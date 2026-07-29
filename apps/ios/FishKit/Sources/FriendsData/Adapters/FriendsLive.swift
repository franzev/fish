import Foundation
import Supabase

/// Live friend events over the private `friends:user:{id}` broadcast channel.
///
/// The stream keeps subscribing for as long as anyone is listening. A channel
/// that failed to open, dropped, or simply ended is the one failure friends
/// cannot afford to sit on: it is the only thing that tells a sender their new
/// conversation exists. Every successful (re)subscribe emits `.streamResumed`,
/// because being back is itself news — whatever happened while the channel was
/// down was never delivered.
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
        // Realtime authenticates from the token the app boundary hands over,
        // so this client never needs — and never touches — stored sessions.
        client = SupabaseClient(
            supabaseURL: configuration.supabaseUrl,
            supabaseKey: configuration.anonKey,
            options: SupabaseClientOptions(
                auth: .init(storage: FriendsInMemoryAuthStorage())
            )
        )
    }

    public func events(userId: String) -> AsyncStream<FriendEvent> {
        let configuration = configuration
        let client = client
        let retryDelay = retryDelay
        return AsyncStream(bufferingPolicy: .bufferingNewest(20)) { continuation in
            let task = Task {
                while !Task.isCancelled {
                    await runChannel(
                        configuration: configuration,
                        client: client,
                        userId: userId,
                        continuation: continuation
                    )
                    guard !Task.isCancelled else { break }
                    // Nothing to report and nothing to log: who someone is
                    // friends with never reaches diagnostics. Coming back is
                    // the answer.
                    try? await Task.sleep(for: retryDelay)
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

/// One subscription attempt: opens the channel, reports the resume, and
/// returns as soon as the channel stops delivering so the caller can back off
/// and try again. Nothing is emitted for an attempt that never subscribed.
private func runChannel(
    configuration: FriendsBackendConfiguration,
    client: SupabaseClient,
    userId: String,
    continuation: AsyncStream<FriendEvent>.Continuation
) async {
    guard let token = await configuration.accessToken(), !token.isEmpty else { return }
    await client.realtimeV2.setAuth(token)
    let channel = client.channel(FriendsRealtimeWire.topic(userId: userId)) {
        $0.isPrivate = true
    }
    // Created before subscribing so nothing that arrives during the handshake
    // is missed.
    let changes = channel.broadcastStream(event: FriendsRealtimeWire.changedEvent)
    do {
        try await channel.subscribeWithError()
    } catch {
        await client.removeChannel(channel)
        return
    }
    continuation.yield(FriendEvent(reason: .streamResumed))
    for await envelope in changes {
        continuation.yield(friendEvent(from: envelope))
    }
    await client.removeChannel(channel)
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
