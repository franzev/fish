import Foundation
import PresenceData

/// Deterministic replacement for the repository's injected `sleep`: every
/// request suspends until the test releases it by duration, and pending
/// requests are inspectable. Cancellation resumes the sleeper by throwing,
/// like `Task.sleep`.
actor TestSleeper {
    private struct Pending {
        let duration: Duration
        let continuation: CheckedContinuation<Void, any Error>
    }

    private var pending: [Pending] = []
    private var requested: [Duration] = []

    func sleep(_ duration: Duration) async throws {
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                requested.append(duration)
                pending.append(
                    Pending(duration: duration, continuation: continuation)
                )
            }
        } onCancel: {
            Task { await self.cancelAll() }
        }
    }

    /// Resumes the oldest pending sleep with exactly this duration.
    func release(_ duration: Duration) {
        guard let index = pending.firstIndex(where: { $0.duration == duration }) else {
            return
        }
        let entry = pending.remove(at: index)
        entry.continuation.resume()
    }

    /// Suspends until at least one sleep with this duration is pending.
    func waitForPending(_ duration: Duration) async {
        let deadline = ContinuousClock.now.advanced(by: .seconds(2))
        while ContinuousClock.now < deadline {
            if pending.contains(where: { $0.duration == duration }) { return }
            try? await Task.sleep(for: .milliseconds(5))
        }
    }

    func requestedDurations() -> [Duration] {
        requested
    }

    private func cancelAll() {
        let entries = pending
        pending = []
        for entry in entries {
            entry.continuation.resume(throwing: CancellationError())
        }
    }
}

/// Manually advanced wall clock for the injected `now`.
final class ManualClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    init(_ start: Date = ISO8601DateFormatter().date(from: "2026-07-16T15:00:00Z")!) {
        current = start
    }

    var now: Date {
        lock.withLock { current }
    }

    func advance(by interval: TimeInterval) {
        lock.withLock { current = current.addingTimeInterval(interval) }
    }
}

/// Polls a predicate with tiny real sleeps — the repo's established idiom
/// for awaiting actor-driven state (`CallSessionModelTests` precedent).
func eventually(
    within limit: Duration = .seconds(2),
    _ predicate: @Sendable () async -> Bool
) async -> Bool {
    let deadline = ContinuousClock.now.advanced(by: limit)
    while ContinuousClock.now < deadline {
        if await predicate() { return true }
        try? await Task.sleep(for: .milliseconds(5))
    }
    return await predicate()
}
