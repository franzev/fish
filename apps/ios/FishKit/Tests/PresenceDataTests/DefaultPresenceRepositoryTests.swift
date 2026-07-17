import Foundation
import PresenceData
import Testing
import TestSupport

/// Behavior pins ported from Android's `DefaultPresenceRepositoryTest` — the
/// native reference implementation (ADR 0004).
struct DefaultPresenceRepositoryTests {
    private func makeRepository(
        remote: ScriptedPresenceRemote,
        sleeper: TestSleeper,
        clock: ManualClock
    ) -> DefaultPresenceRepository {
        DefaultPresenceRepository(
            remote: remote,
            now: { clock.now },
            sleep: { try await sleeper.sleep($0) },
            sessionId: "session-fixture"
        )
    }

    private func latestState(
        of repository: DefaultPresenceRepository
    ) async -> PresenceState {
        var latest = PresenceState()
        for await state in repository.states() {
            latest = state
            break
        }
        return latest
    }

    @Test func foregroundStartsSessionAndBackgroundEndsIt() async {
        let remote = ScriptedPresenceRemote()
        let sleeper = TestSleeper()
        let clock = ManualClock()
        let repository = makeRepository(remote: remote, sleeper: sleeper, clock: clock)

        await repository.setAuthenticatedUser(PresenceFixtures.selfId)
        await repository.setAppForegrounded(true)

        #expect(await eventually {
            remote.touches.first == RecordedPresenceTouch(
                sessionId: "session-fixture", activity: true, ended: false
            )
        })
        #expect(await eventually {
            let state = await self.latestState(of: repository)
            return state.connection == .connected
                && state.snapshots.keys.sorted()
                    == [PresenceFixtures.selfId, PresenceFixtures.coachId].sorted()
        })

        await repository.setAppForegrounded(false)

        #expect(await eventually {
            remote.touches.last == RecordedPresenceTouch(
                sessionId: "session-fixture", activity: false, ended: true
            )
        })
        let state = await latestState(of: repository)
        #expect(state.connection == .disconnected)
        #expect(state.currentUserId == PresenceFixtures.selfId)
        #expect(!state.snapshots.isEmpty)
    }

    @Test func heartbeatRunsEveryThirtySecondsAndIdleReturnSendsActivity() async {
        let remote = ScriptedPresenceRemote()
        let sleeper = TestSleeper()
        let clock = ManualClock()
        let repository = makeRepository(remote: remote, sleeper: sleeper, clock: clock)

        await repository.setAuthenticatedUser(PresenceFixtures.selfId)
        await repository.setAppForegrounded(true)
        #expect(await eventually { remote.touches.count == 1 })

        await sleeper.waitForPending(PresenceRules.heartbeatInterval)
        clock.advance(by: 30)
        await sleeper.release(PresenceRules.heartbeatInterval)

        #expect(await eventually { remote.touches.count == 2 })
        #expect(remote.touches[1].activity == false)
        #expect(remote.touches[1].ended == false)

        // A return from ≥ 5 minutes idle forces an immediate activity write.
        clock.advance(by: 360)
        await repository.markActive()
        #expect(await eventually { remote.touches.count == 3 })
        #expect(remote.touches[2].activity == true)
        #expect(remote.touches[2].ended == false)
    }

    @Test func heartbeatFailuresRetryAtFiveTenAndThirtySeconds() async {
        let remote = ScriptedPresenceRemote(
            onTouch: { _, _, _ in throw URLError(.notConnectedToInternet) }
        )
        let sleeper = TestSleeper()
        let clock = ManualClock()
        let repository = makeRepository(remote: remote, sleeper: sleeper, clock: clock)

        await repository.setAuthenticatedUser(PresenceFixtures.selfId)
        await repository.setAppForegrounded(true)

        #expect(await eventually { remote.touches.count == 1 })
        for (index, delay) in PresenceRules.retryDelays.enumerated() {
            await sleeper.waitForPending(delay)
            await sleeper.release(delay)
            #expect(await eventually { remote.touches.count == index + 2 })
        }
        #expect(remote.touches.count == 4)
        let requested = await sleeper.requestedDurations()
        #expect(Array(requested.prefix(3)) == PresenceRules.retryDelays)
    }

    @Test func onlyNewerRevisionsMergeAndRevokedSubjectsRejectLateEvents() async {
        let roster = LockedValue([
            PresenceFixtures.snapshot(userId: PresenceFixtures.selfId, revision: 1),
            PresenceFixtures.snapshot(userId: PresenceFixtures.coachId, revision: 2),
        ])
        let remote = ScriptedPresenceRemote(onListVisible: { roster.value })
        let sleeper = TestSleeper()
        let clock = ManualClock()
        let repository = makeRepository(remote: remote, sleeper: sleeper, clock: clock)

        await repository.setAuthenticatedUser(PresenceFixtures.selfId)
        await repository.setAppForegrounded(true)
        #expect(await eventually {
            let state = await self.latestState(of: repository)
            return state.snapshots[PresenceFixtures.coachId]?.revision == 2
        })

        remote.send(.snapshotChanged(
            PresenceFixtures.snapshot(
                userId: PresenceFixtures.coachId, status: .idle, revision: 1
            )
        ))
        remote.send(.snapshotChanged(
            PresenceFixtures.snapshot(
                userId: PresenceFixtures.coachId, status: .idle, revision: 3
            )
        ))
        #expect(await eventually {
            let state = await self.latestState(of: repository)
            return state.snapshots[PresenceFixtures.coachId]?.revision == 3
                && state.snapshots[PresenceFixtures.coachId]?.status == .idle
        })

        // Relationship revoked: the refresh drops the subject and late
        // events for it are rejected.
        roster.value = [
            PresenceFixtures.snapshot(userId: PresenceFixtures.selfId, revision: 1)
        ]
        remote.send(.subjectsChanged)
        #expect(await eventually {
            let state = await self.latestState(of: repository)
            return state.snapshots[PresenceFixtures.coachId] == nil
        })

        remote.send(.snapshotChanged(
            PresenceFixtures.snapshot(
                userId: PresenceFixtures.coachId, status: .online, revision: 9
            )
        ))
        try? await Task.sleep(for: .milliseconds(50))
        let state = await latestState(of: repository)
        #expect(state.snapshots[PresenceFixtures.coachId] == nil)
    }

    @Test func preferenceResultAppliesOnlyWhenItIsNotSuperseded() async {
        let remote = ScriptedPresenceRemote(
            onSetPreference: { _, _ in
                PresenceFixtures.commandResult(
                    preference: .automatic, revision: 8, status: .online
                )
            }
        )
        let sleeper = TestSleeper()
        let clock = ManualClock()
        let repository = makeRepository(remote: remote, sleeper: sleeper, clock: clock)

        await repository.setAuthenticatedUser(PresenceFixtures.selfId)
        await repository.setAppForegrounded(true)
        #expect(await eventually {
            await self.latestState(of: repository).connection == .connected
        })

        remote.send(.preferenceChanged(
            PresencePreferenceSetting(preference: .busy, expiresAt: nil),
            revision: 10
        ))
        #expect(await eventually {
            await self.latestState(of: repository).preferenceRevision == 10
        })

        let outcome = await repository.setPreference(.automatic, for: .forever)
        #expect(outcome == .success(PresenceFixtures.commandResult(
            preference: .automatic, revision: 8, status: .online
        )))

        let state = await latestState(of: repository)
        #expect(state.ownPreference.preference == .busy)
        #expect(state.preferenceRevision == 10)
    }

    @Test func signOutEndsTheSessionAndResetsState() async {
        let remote = ScriptedPresenceRemote()
        let sleeper = TestSleeper()
        let clock = ManualClock()
        let repository = makeRepository(remote: remote, sleeper: sleeper, clock: clock)

        await repository.setAuthenticatedUser(PresenceFixtures.selfId)
        await repository.setAppForegrounded(true)
        #expect(await eventually { remote.touches.count == 1 })

        await repository.endSession()
        #expect(remote.touches.last?.ended == true)

        await repository.setAuthenticatedUser(nil)
        #expect(await eventually {
            await self.latestState(of: repository) == PresenceState()
        })
    }

    @Test func unconfiguredRepositoryFailsCommandsWithCalmCopy() async {
        let repository = UnconfiguredPresenceRepository()
        let outcome = await repository.setPreference(.busy, for: .oneHour)
        #expect(outcome == .failure(notice: "This build is not connected yet."))
    }
}

/// Tiny lock box so scripted closures can swap their replies mid-test.
final class LockedValue<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var stored: Value

    init(_ value: Value) {
        stored = value
    }

    var value: Value {
        get { lock.withLock { stored } }
        set { lock.withLock { stored = newValue } }
    }
}
