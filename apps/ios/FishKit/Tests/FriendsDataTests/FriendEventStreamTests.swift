import Foundation
import Testing
@testable import FriendsData

/// The reconnect loop's decisions, driven by scripted attempts instead of a
/// socket: what a consumer hears, in what order, when a channel joins, drops,
/// never joins, or is torn down. Cadence is asserted from a recorded trace
/// rather than from timing, so nothing here is flaky.
struct FriendEventStreamTests {
    /// Hands out one scripted attempt at a time and records the order of the
    /// loop's effects.
    private actor Script {
        private var attempts: [[FriendChannelSignal]]
        private(set) var trace: [String] = []

        init(_ attempts: [[FriendChannelSignal]]) {
            self.attempts = attempts
        }

        func nextAttempt() -> [FriendChannelSignal] {
            trace.append("attempt")
            return attempts.isEmpty ? [] : attempts.removeFirst()
        }

        func recordBackoff() {
            trace.append("backoff")
        }
    }

    private func makeLoop(_ script: Script) -> FriendEventStream {
        FriendEventStream(
            attempt: {
                AsyncStream { continuation in
                    Task {
                        for signal in await script.nextAttempt() {
                            continuation.yield(signal)
                        }
                        continuation.finish()
                    }
                }
            },
            backoff: { await script.recordBackoff() }
        )
    }

    /// Runs the loop until `count` events arrive, then stops consuming.
    private func collect(_ count: Int, from loop: FriendEventStream) async -> [FriendEvent] {
        let events = AsyncStream<FriendEvent>.makeStream()
        let task = Task { await loop.run(into: events.continuation) }
        defer { task.cancel() }
        var collected: [FriendEvent] = []
        for await event in events.stream {
            collected.append(event)
            if collected.count == count { break }
        }
        return collected
    }

    private static let requestCreated = FriendEvent(
        reason: .requestCreated,
        requestId: "req-1"
    )
    private static let friendshipCreated = FriendEvent(
        reason: .friendshipCreated,
        friendshipId: "friendship-1"
    )
    private static let resumed = FriendEvent(reason: .streamResumed)

    @Test func joiningIsNewsExactlyOncePerAttempt() async {
        let script = Script([[.joined, .joined, .received(Self.requestCreated)]])

        let events = await collect(2, from: makeLoop(script))

        #expect(events == [Self.resumed, Self.requestCreated])
    }

    @Test func everyAttemptAfterTheFirstWaitsForTheBackoff() async {
        let script = Script([
            [.joined, .dropped],
            [.joined, .dropped],
            [.joined, .dropped],
        ])

        let events = await collect(3, from: makeLoop(script))

        #expect(events == [Self.resumed, Self.resumed, Self.resumed])
        #expect(await script.trace.starts(with: [
            "attempt", "backoff", "attempt", "backoff", "attempt",
        ]))
    }

    /// A channel that never opened has nothing to say — announcing a resume
    /// there would send consumers refetching for no reason.
    @Test func anAttemptThatNeverJoinedSaysNothing() async {
        let script = Script([[], [.joined]])

        let events = await collect(1, from: makeLoop(script))

        #expect(events == [Self.resumed])
        #expect(await script.trace.starts(with: ["attempt", "backoff", "attempt"]))
    }

    /// The drop is what the live adapter reports for any channel status that
    /// is not `subscribed` — including the SDK's own silent rejoin. Whatever
    /// arrives after it belongs to a channel that is no longer trusted.
    @Test func aDropEndsTheAttemptAndWhatFollowsIsNeverDelivered() async {
        let script = Script([
            [
                .joined,
                .received(Self.requestCreated),
                .dropped,
                .received(Self.friendshipCreated),
            ],
            [.joined],
        ])

        let events = await collect(3, from: makeLoop(script))

        #expect(events == [Self.resumed, Self.requestCreated, Self.resumed])
        #expect(!events.contains(Self.friendshipCreated))
    }

    @Test func cancellingTheConsumerEndsTheStream() async {
        let script = Script([[.joined]])
        let loop = FriendEventStream(
            attempt: {
                AsyncStream { continuation in
                    Task {
                        for signal in await script.nextAttempt() {
                            continuation.yield(signal)
                        }
                        continuation.finish()
                    }
                }
            },
            // Long enough that only cancellation can end this run.
            backoff: { try? await Task.sleep(for: .seconds(60)) }
        )
        let events = AsyncStream<FriendEvent>.makeStream()
        let task = Task { await loop.run(into: events.continuation) }
        var iterator = events.stream.makeAsyncIterator()

        #expect(await iterator.next() == Self.resumed)

        task.cancel()

        #expect(await iterator.next() == nil)
    }
}
