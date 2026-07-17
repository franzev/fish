import Foundation

/// Foreground polling stand-in for the private `calls:user:<id>` broadcast
/// channel. It leans on the same durability guarantee the web client uses
/// after a missed broadcast: the `calls` row is the source of truth, so a
/// periodic `findCurrentCall` (plus one follow-up read when a live call
/// leaves the live set) reproduces every wakeup — just with polling latency.
/// The websocket Realtime adapter replaces this when `supabase-swift` lands;
/// consumers only see `CallRealtimeProviding`.
public struct PollingCallRealtime: CallRealtimeProviding {
    private let directory: RestCallDirectory
    private let interval: Duration

    public init(directory: RestCallDirectory, interval: Duration = .seconds(3)) {
        self.directory = directory
        self.interval = interval
    }

    public func signals(userId: String) -> AsyncStream<CallRealtimeSignal> {
        let directory = directory
        let interval = interval
        return AsyncStream { continuation in
            let task = Task {
                continuation.yield(.recovered)
                var lastEventKey: String?
                var trackedCallId: String?

                while !Task.isCancelled {
                    do {
                        try await Task.sleep(for: interval)
                    } catch {
                        break
                    }

                    let snapshot: CallSnapshot?
                    do {
                        snapshot = try await directory.findCurrentCall(userId: userId)
                    } catch {
                        continue
                    }

                    if let live = snapshot {
                        let key = [
                            live.call.id,
                            live.call.status.rawValue,
                            live.call.updatedAt,
                        ].joined(separator: "|")
                        trackedCallId = live.call.id
                        if key != lastEventKey {
                            lastEventKey = key
                            continuation.yield(.event(CallRealtimeEvent(
                                callId: live.call.id,
                                status: live.call.status,
                                occurredAt: live.call.updatedAt
                            )))
                        }
                        continue
                    }

                    // The live call disappeared from the live set — read its
                    // terminal status once so decline/missed/end still wake
                    // the session up.
                    if let endedCallId = trackedCallId {
                        trackedCallId = nil
                        lastEventKey = nil
                        if let ended = try? await directory.findCall(
                            id: endedCallId,
                            userId: userId
                        ) {
                            continuation.yield(.event(CallRealtimeEvent(
                                callId: ended.call.id,
                                status: ended.call.status,
                                occurredAt: ended.call.updatedAt
                            )))
                        }
                    }
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    public func findCurrentCall(userId: String) async throws -> CallSnapshot? {
        try await directory.findCurrentCall(userId: userId)
    }

    public func findCall(id: String, userId: String) async throws -> CallSnapshot? {
        try await directory.findCall(id: id, userId: userId)
    }
}
