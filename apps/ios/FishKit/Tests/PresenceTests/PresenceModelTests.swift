import Foundation
import PresenceData
import Testing
import TestSupport
import UIComponents
@testable import Presence

/// Optimistic-command behavior pins ported from Android's
/// `PresenceViewModelTest`.
@MainActor
struct PresenceModelTests {
    private static let formatter = PresenceFormatter(
        locale: Locale(identifier: "en_US"),
        calendar: Calendar(identifier: .gregorian),
        timeZone: TimeZone(identifier: "UTC")!
    )

    private func connectedState(
        preference: PresencePreferenceSetting = PresencePreferenceSetting()
    ) -> PresenceState {
        PresenceState(
            currentUserId: PresenceFixtures.selfId,
            snapshots: [
                PresenceFixtures.selfId: PresenceFixtures.snapshot(
                    userId: PresenceFixtures.selfId
                ),
            ],
            ownPreference: preference,
            preferenceRevision: 1,
            connection: .connected
        )
    }

    private func makeModel(
        repository: ScriptedPresenceRepository,
        now: @escaping @Sendable () -> Date = {
            ISO8601DateFormatter().date(from: "2026-07-16T15:00:00Z")!
        },
        ticks: AsyncStream<Void>? = nil
    ) -> (PresenceModel, Task<Void, Never>) {
        let model = PresenceModel(
            repository: repository,
            formatter: Self.formatter,
            now: now,
            ticks: { ticks ?? AsyncStream { _ in } }
        )
        let runner = Task { await model.start() }
        return (model, runner)
    }

    @Test func optimisticCommandPreventsDuplicatesAndConfirmsOnSuccess() async {
        let gate = AsyncGate()
        let repository = ScriptedPresenceRepository(
            initial: connectedState(),
            onSetPreference: { preference, _ in
                await gate.wait()
                return .success(PresenceFixtures.commandResult(preference: preference))
            }
        )
        let (model, runner) = makeModel(repository: repository)
        defer { runner.cancel() }
        #expect(await eventually { await model.uiState.connection == .connected })

        model.setPreference(.busy, for: .oneHour)
        #expect(model.uiState.updating)
        #expect(model.uiState.own.status == .busy)

        // A second command while one is in flight is ignored.
        model.setPreference(.invisible, for: .forever)
        #expect(model.uiState.own.status == .busy)

        await gate.open()
        #expect(await eventually { await model.confirmations == 1 })
        #expect(model.uiState.updating == false)
        #expect(repository.preferenceCalls.count == 1)
    }

    @Test func failureRollsBackAndKeepsCalmNotice() async {
        let repository = ScriptedPresenceRepository(
            initial: connectedState(),
            onSetPreference: { _, _ in
                .failure(notice: "Your status could not change. Try again.")
            }
        )
        let (model, runner) = makeModel(repository: repository)
        defer { runner.cancel() }
        #expect(await eventually { await model.uiState.connection == .connected })

        model.setPreference(.away, for: .fifteenMinutes)
        #expect(await eventually { await model.uiState.notice != nil })
        #expect(model.uiState.notice == "Your status could not change. Try again.")
        #expect(model.uiState.own.status == .online)
        #expect(model.uiState.updating == false)
        #expect(model.confirmations == 0)

        model.clearNotice()
        #expect(model.uiState.notice == nil)
    }

    @Test func expiredTimedModeRevertsToAutomaticOnTheClock() async {
        let clock = ManualTestClock(start: "2026-07-16T15:00:00Z")
        let (tickStream, tickContinuation) = AsyncStream<Void>.makeStream()
        let repository = ScriptedPresenceRepository(
            initial: connectedState(
                preference: PresencePreferenceSetting(
                    preference: .busy,
                    expiresAt: "2026-07-16T15:10:00Z"
                )
            )
        )
        let (model, runner) = makeModel(
            repository: repository,
            now: { clock.now },
            ticks: tickStream
        )
        defer { runner.cancel() }

        #expect(await eventually { await model.uiState.own.status == .busy })

        clock.advance(by: 601)
        tickContinuation.yield(())
        // The preference reverts to automatic locally; the effective status
        // comes from the snapshot again, which is stale by now — so the
        // owner reads Offline until the next heartbeat merges (web parity).
        #expect(await eventually { await model.uiState.own.status == .offline })
        #expect(model.uiState.ownPreference == PresencePreferenceSetting())
    }
}

/// Resumable gate for holding a scripted reply open.
private actor AsyncGate {
    private var opened = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        if opened { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    func open() {
        opened = true
        waiters.forEach { $0.resume() }
        waiters = []
    }
}

/// Same shape as `ManualClock` in PresenceDataTests, local to this target.
private final class ManualTestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    init(start: String) {
        current = ISO8601DateFormatter().date(from: start)!
    }

    var now: Date {
        lock.withLock { current }
    }

    func advance(by interval: TimeInterval) {
        lock.withLock { current = current.addingTimeInterval(interval) }
    }
}

/// Local polling helper mirroring the PresenceDataTests idiom.
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
