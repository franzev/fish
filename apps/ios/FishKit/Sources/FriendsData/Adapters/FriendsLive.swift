import Foundation
import Supabase

/// Live friend events over the private `friends:user:{id}` broadcast channel.
///
/// The stream keeps subscribing for as long as anyone is listening. A channel
/// that failed to open, dropped, or was closed by the server is the one
/// failure friends cannot afford to sit on: it is the only thing that tells a
/// sender their new conversation exists. Every successful (re)join emits
/// `.streamResumed`, because being back is itself news — whatever happened
/// while the channel was down was never delivered, and consumers refetch on
/// every event.
///
/// The Supabase SDK stays inside this file; callers see
/// `FriendEventsProviding`. This owns its own realtime client — ChatData's is
/// internal to that module — so construct it once, at the app boundary.
public struct FriendsLive: FriendEventsProviding {
    /// Matches the Android as-built backoff (`DefaultFriendsRepository`).
    public static let defaultRetryDelay: Duration = .seconds(2)

    private let configuration: FriendsBackendConfiguration
    private let client: SupabaseClient
    private let retryDelay: Duration

    public init(
        configuration: FriendsBackendConfiguration,
        retryDelay: Duration = FriendsLive.defaultRetryDelay
    ) {
        self.configuration = configuration
        self.retryDelay = retryDelay
        client = SupabaseClient(
            supabaseURL: configuration.supabaseUrl,
            supabaseKey: configuration.anonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    // Realtime never reads a stored session: the app boundary
                    // owns auth and hands the token over.
                    storage: FriendsInMemoryAuthStorage(),
                    // The SDK's bring-your-own-token mode. Joins the SDK
                    // drives itself — the automatic rejoin after a socket
                    // reconnect — resolve a current token through this
                    // closure; without it they fall back to the last
                    // `setAuth` value and replay the first token until it
                    // expires and the private channel is refused.
                    // `client.auth` must never be touched once this is set.
                    accessToken: { await configuration.accessToken() }
                )
            )
        )
    }

    /// One live stream per user id: every call opens its own channel, so a
    /// caller that needs these events in two places shares one stream rather
    /// than calling this twice.
    public func events(userId: String) -> AsyncStream<FriendEvent> {
        let configuration = configuration
        let client = client
        let retryDelay = retryDelay
        return AsyncStream(bufferingPolicy: .bufferingNewest(20)) { continuation in
            let loop = FriendEventStream(
                attempt: {
                    friendChannelSignals(
                        configuration: configuration,
                        client: client,
                        userId: userId
                    )
                },
                backoff: {
                    // Nothing to report and nothing to log: who someone is
                    // friends with never reaches diagnostics. Coming back is
                    // the answer.
                    try? await Task.sleep(for: retryDelay)
                }
            )
            let task = Task { await loop.run(into: continuation) }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

/// One subscription attempt against the private friends channel. It reports
/// nothing at all unless it joined, and stops reporting the moment the
/// channel stops delivering, so the loop can take a fresh token and join
/// again.
private func friendChannelSignals(
    configuration: FriendsBackendConfiguration,
    client: SupabaseClient,
    userId: String
) -> AsyncStream<FriendChannelSignal> {
    AsyncStream { continuation in
        let task = Task {
            // Signed out: nothing to listen to and nothing to say. Retrying
            // on the loop's backoff is cheap here — one closure call, no
            // socket and no request — and the stream is torn down on
            // sign-out anyway.
            guard let token = await configuration.accessToken(), !token.isEmpty else {
                continuation.finish()
                return
            }
            await client.realtimeV2.setAuth(token)
            let channel = client.channel(FriendsRealtimeWire.topic(userId: userId)) {
                $0.isPrivate = true
            }
            // Created before subscribing so nothing that arrives during the
            // handshake is missed.
            let changes = channel.broadcastStream(event: FriendsRealtimeWire.changedEvent)
            do {
                try await channel.subscribeWithError()
            } catch {
                await client.removeChannel(channel)
                continuation.finish()
                return
            }
            continuation.yield(.joined)
            // Read only after joining: the status stream replays the current
            // value, so starting it here reports `subscribed` — or, if the
            // channel already fell over during the handshake, the drop
            // itself.
            let statuses = channel.statusChange
            await withTaskGroup(of: Void.self) { group in
                group.addTask {
                    for await envelope in changes {
                        continuation.yield(.received(friendEvent(from: envelope)))
                    }
                    continuation.yield(.dropped)
                }
                group.addTask {
                    // Any status that is not `subscribed` ends this attempt:
                    // a socket blip, the SDK's own silent rejoin (which would
                    // otherwise resume delivery with no resume event, so
                    // nothing missed during the outage is ever refetched), or
                    // a server close (which drops the channel from the client
                    // entirely, so no later rejoin would include it).
                    for await status in statuses where status != .subscribed { break }
                    continuation.yield(.dropped)
                }
                _ = await group.next()
                group.cancelAll()
            }
            await client.removeChannel(channel)
            continuation.finish()
        }
        continuation.onTermination = { _ in task.cancel() }
    }
}

/// An unreadable payload still means something changed, so it is delivered as
/// `unknown` rather than dropped — consumers refetch on every event.
private func friendEvent(from envelope: JSONObject) -> FriendEvent {
    guard let payload = envelope["payload"]?.objectValue else {
        return FriendEvent(reason: .unknown)
    }
    return FriendEventWire(
        reason: payload["reason"]?.stringValue,
        requestId: payload["requestId"]?.stringValue,
        friendshipId: payload["friendshipId"]?.stringValue
    ).domain
}

private final class FriendsInMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
    private var values: [String: Data] = [:]
    private let lock = NSLock()

    func store(key: String, value: Data) throws {
        lock.withLock { values[key] = value }
    }

    func retrieve(key: String) throws -> Data? {
        lock.withLock { values[key] }
    }

    func remove(key: String) throws {
        lock.withLock { values[key] = nil }
    }
}
