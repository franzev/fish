import Foundation

/// What one subscription attempt reports. The live adapter maps the realtime
/// channel onto these — a `subscribed` status is `joined`, every other status
/// is `dropped` — and everything downstream of that one mapping is pure.
enum FriendChannelSignal: Sendable, Equatable {
    /// The channel joined and is delivering.
    case joined
    /// A payload arrived on the joined channel.
    case received(FriendEvent)
    /// The channel stopped delivering: the socket blipped, the SDK rejoined
    /// the channel behind our back, or the server closed it.
    case dropped
}

/// The reconnect loop's decisions, with the socket factored out: one attempt
/// at a time, `streamResumed` exactly once per join, a backoff between
/// attempts, and silence for an attempt that never joined.
///
/// Both effects are injected so every decision here runs without a socket.
/// This loop is the part of friends realtime that has to be right: a stream
/// that quietly stops looks exactly like a person with no new friends.
struct FriendEventStream: Sendable {
    /// One subscription attempt's signals. The stream finishes when the
    /// attempt is over; an attempt that never joined finishes without
    /// signalling anything.
    let attempt: @Sendable () -> AsyncStream<FriendChannelSignal>

    /// Waits between attempts.
    let backoff: @Sendable () async -> Void

    func run(into continuation: AsyncStream<FriendEvent>.Continuation) async {
        while !Task.isCancelled {
            await runAttempt(into: continuation)
            guard !Task.isCancelled else { break }
            await backoff()
        }
        continuation.finish()
    }

    private func runAttempt(
        into continuation: AsyncStream<FriendEvent>.Continuation
    ) async {
        var joined = false
        for await signal in attempt() {
            switch signal {
            case .joined:
                // Being back is itself news — whatever happened while the
                // channel was down was never delivered — but one join is one
                // piece of news, however many times it is reported.
                guard !joined else { continue }
                joined = true
                continuation.yield(FriendEvent(reason: .streamResumed))
            case .received(let event):
                continuation.yield(event)
            case .dropped:
                // Hand the decision back to the loop: a fresh token, a fresh
                // channel, and a resume the consumer can act on.
                return
            }
        }
    }
}
