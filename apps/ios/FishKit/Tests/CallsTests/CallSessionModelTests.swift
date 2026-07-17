import CallData
@testable import Calls
import Foundation
import Testing
import TestSupport

/// Behavior tests of the session orchestrator against scripted providers —
/// the same flows the web `call-provider` tests pin: happy paths on both
/// sides of a call, permission and command failures with their exact calm
/// copy, wakeup-driven joins, recovery, and teardown.
@MainActor
struct CallSessionModelTests {
    struct Failure: Error {}

    struct GrantedPermissions: MediaPermissionRequesting {
        func requestAccess(for _: CallKind) async -> MediaPermissionOutcome { .granted }
    }

    struct FixedPermissions: MediaPermissionRequesting {
        let outcome: MediaPermissionOutcome
        func requestAccess(for _: CallKind) async -> MediaPermissionOutcome { outcome }
    }

    @MainActor
    struct Harness {
        let commands: ScriptedCallCommands
        let realtime: FixtureCallRealtime
        let media: FixtureCallMedia
        let model: CallSessionModel

        init(
            userId: String = CallFixtures.clientId,
            commands: ScriptedCallCommands = ScriptedCallCommands(),
            permissions: any MediaPermissionRequesting = GrantedPermissions(),
            autoClear: Duration = .seconds(60)
        ) {
            let realtime = FixtureCallRealtime()
            let media = FixtureCallMedia()
            let defaults = UserDefaults(suiteName: "call-session-tests-\(UUID().uuidString)")!
            self.commands = commands
            self.realtime = realtime
            self.media = media
            self.model = CallSessionModel(
                userId: userId,
                commands: commands,
                realtime: realtime,
                media: media,
                permissions: permissions,
                defaults: defaults,
                terminalAutoClearDelay: autoClear
            )
        }
    }

    // Generous deadline: suites run in parallel and snapshot rendering can
    // hold the main actor for long stretches.
    private func waitUntil(
        _ comment: Comment,
        timeout: Duration = .seconds(10),
        condition: () -> Bool
    ) async {
        let deadline = ContinuousClock.now.advanced(by: timeout)
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(10))
        }
        #expect(condition(), comment)
    }

    // MARK: - Outgoing

    @Test func outgoingCallRingsThenJoinsWhenAccepted() async {
        let harness = Harness()
        await harness.model.start()

        await harness.model.startCall(
            recipientId: CallFixtures.coachId,
            recipientName: CallFixtures.coachName,
            kind: .audio
        )

        #expect(harness.model.state.current.status == .ringing)
        #expect(harness.model.state.current.direction == .outgoing)
        #expect(harness.model.state.current.counterpartName == CallFixtures.coachName)

        // The callee accepts: the durable row flips to connecting and the
        // wakeup arrives. The caller (initiator) must join media.
        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .connecting,
            initiatedBy: CallFixtures.clientId
        )))

        await waitUntil("caller joins media after the connecting wakeup") {
            harness.media.connectedCallId == CallFixtures.callId
        }

        // Both parties are now in the room; the LiveKit webhook flips the
        // durable row to active (a connecting-row wakeup that raced local
        // media keeps the state at connecting until this arrives — web
        // parity).
        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .active,
            initiatedBy: CallFixtures.clientId,
            connectedAt: "2026-07-17T10:00:08.000Z"
        )))

        await waitUntil("the active row settles the call as active") {
            harness.model.state.current.status == .active
        }
    }

    @Test func startCallRefusesWhileLive() async {
        let harness = Harness()
        await harness.model.start()
        await harness.model.startCall(
            recipientId: CallFixtures.coachId,
            recipientName: CallFixtures.coachName,
            kind: .audio
        )
        #expect(harness.model.state.current.status == .ringing)

        await harness.model.startCall(
            recipientId: CallFixtures.coachId,
            recipientName: CallFixtures.coachName,
            kind: .audio
        )

        #expect(harness.model.notice == CallCopy.finishCurrentCall)
        #expect(harness.model.state.current.status == .ringing)
    }

    @Test func permissionDeniedOnStartFailsWithSettingsGuidance() async {
        let harness = Harness(permissions: FixedPermissions(outcome: .denied))
        await harness.model.start()

        await harness.model.startCall(
            recipientId: CallFixtures.coachId,
            recipientName: CallFixtures.coachName,
            kind: .audio
        )

        #expect(harness.model.state.current.status == .failed)
        #expect(harness.model.state.current.failureReason == .permissionDenied)
        #expect(harness.model.notice == CallCopy.allowMicrophoneToStart)
    }

    @Test func missingCameraOnVideoStartIsDeviceUnavailable() async {
        let harness = Harness(permissions: FixedPermissions(outcome: .unavailable))
        await harness.model.start()

        await harness.model.startCall(
            recipientId: CallFixtures.coachId,
            recipientName: CallFixtures.coachName,
            kind: .video
        )

        #expect(harness.model.state.current.status == .failed)
        #expect(harness.model.state.current.failureReason == .deviceUnavailable)
        #expect(harness.model.notice == CallCopy.cameraUnavailable)
    }

    @Test func initiateFailureSurfacesServerNotice() async {
        let commands = ScriptedCallCommands(onInitiate: { _, _, _ in
            throw CallCommandFailure(
                code: "participant_busy",
                notice: "They’re already in a call. Try again a little later."
            )
        })
        let harness = Harness(commands: commands)
        await harness.model.start()

        await harness.model.startCall(
            recipientId: CallFixtures.coachId,
            recipientName: CallFixtures.coachName,
            kind: .audio
        )

        #expect(harness.model.state.current.status == .failed)
        #expect(harness.model.state.current.failureReason == .providerUnavailable)
        #expect(
            harness.model.notice
                == "They’re already in a call. Try again a little later."
        )
    }

    // MARK: - Incoming

    @Test func incomingWakeupRingsAndAnswerGoesActive() async {
        let harness = Harness()
        await harness.model.start()

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            kind: .video,
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))

        await waitUntil("wakeup hydrates the incoming ring") {
            harness.model.state.current.status == .ringing
        }
        #expect(harness.model.state.current.direction == .incoming)
        #expect(harness.model.state.current.kind == .video)

        await harness.model.answer()

        #expect(harness.media.connectedCallId == CallFixtures.callId)
        await waitUntil("answer flips the call active") {
            harness.model.state.current.status == .active
        }
        #expect(harness.media.speakerEnabled, "video calls default to speaker")
        #expect(harness.media.cameraEnabled, "video answers publish the camera")
    }

    @Test func permissionDeniedOnAnswerKeepsRinging() async {
        let harness = Harness(permissions: FixedPermissions(outcome: .denied))
        await harness.model.start()

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("wakeup hydrates the incoming ring") {
            harness.model.state.current.status == .ringing
        }

        await harness.model.answer()

        #expect(harness.model.state.current.status == .ringing)
        #expect(harness.model.notice == CallCopy.allowMicrophoneToAnswer)
        #expect(harness.media.connectedCallId == nil)
    }

    @Test func declineRejectsAndDisconnectsMedia() async {
        let harness = Harness()
        await harness.model.start()

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("wakeup hydrates the incoming ring") {
            harness.model.state.current.status == .ringing
        }

        await harness.model.decline()

        #expect(harness.model.state.current.status == .rejected)
        #expect(harness.media.disconnectCount >= 1)
    }

    @Test func mediaConnectFailureRunsCalmFailurePath() async {
        let harness = Harness()
        harness.media.connectError = Failure()
        await harness.model.start()

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("wakeup hydrates the incoming ring") {
            harness.model.state.current.status == .ringing
        }

        await harness.model.answer()

        #expect(harness.model.state.current.status == .failed)
        #expect(harness.model.state.current.failureReason == .connectFailed)
        #expect(harness.model.notice == CallCopy.callDidNotConnect)
        #expect(harness.media.disconnectCount >= 1)
    }

    // MARK: - Wakeups, recovery, terminal

    @Test func remoteEndWakeupTearsDownMedia() async {
        let harness = Harness()
        await harness.model.start()

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("ringing") {
            harness.model.state.current.status == .ringing
        }
        await harness.model.answer()
        await waitUntil("active") {
            harness.model.state.current.status == .active
        }

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ended,
            initiatedBy: CallFixtures.coachId
        )))

        await waitUntil("remote end reaches the reducer") {
            harness.model.state.current.status == .ended
        }
        await waitUntil("media disconnects on terminal state") {
            harness.media.disconnectCount >= 1
        }
    }

    @Test func recoveryHydratesTheCurrentLiveCall() async {
        let harness = Harness()
        // The durable row exists before the subscription starts — the
        // recover() pass must hydrate and join without any wakeup.
        harness.realtime.setCall(
            CallFixtures.snapshot(CallFixtures.call(
                status: .active,
                initiatedBy: CallFixtures.coachId,
                connectedAt: "2026-07-17T10:00:06.000Z"
            )),
            broadcast: false
        )

        await harness.model.start()

        await waitUntil("recovery hydrates the active call") {
            harness.model.state.current.status == .active
        }
        await waitUntil("recovery rejoins media") {
            harness.media.connectedCallId == CallFixtures.callId
        }
        #expect(harness.model.state.current.connectedAt == "2026-07-17T10:00:06.000Z")
    }

    @Test func terminalStateAutoClearsAfterDelay() async {
        let harness = Harness(autoClear: .milliseconds(60))
        await harness.model.start()

        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("ringing") {
            harness.model.state.current.status == .ringing
        }
        await harness.model.decline()
        #expect(harness.model.state.current.status == .rejected)

        await waitUntil("terminal panel clears itself") {
            harness.model.state.current.status == .idle
        }
    }

    // MARK: - Controls

    @Test func muteZeroesLocalSpeaking() async {
        let harness = Harness()
        await harness.model.start()
        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("ringing") {
            harness.model.state.current.status == .ringing
        }
        await harness.model.answer()
        await waitUntil("active") {
            harness.model.state.current.status == .active
        }
        harness.media.send(.speakingChanged(
            callId: CallFixtures.callId,
            CallMediaSpeaking(
                localMicrophoneActive: true,
                localMicrophoneLevel: 0.6,
                remoteSpeaking: false,
                remoteMicrophoneLevel: 0
            )
        ))
        #expect(harness.model.speaking.localMicrophoneActive)

        await harness.model.toggleMute()

        #expect(harness.model.state.current.muted)
        #expect(harness.media.muted)
        #expect(!harness.model.speaking.localMicrophoneActive)
        #expect(harness.model.speaking.localMicrophoneLevel == 0)
    }

    @Test func cameraFailureShowsCalmNotice() async {
        let harness = Harness()
        await harness.model.start()
        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            kind: .video,
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("ringing") {
            harness.model.state.current.status == .ringing
        }
        await harness.model.answer()
        await waitUntil("active") {
            harness.model.state.current.status == .active
        }
        await waitUntil("camera reported on") {
            harness.model.state.current.cameraEnabled
        }

        harness.media.cameraError = Failure()
        await harness.model.toggleCamera()

        #expect(harness.model.notice == CallCopy.cameraStopFailed)
    }

    @Test func shutdownResetsIdentityAndDisconnects() async {
        let harness = Harness()
        await harness.model.start()
        harness.realtime.setCall(CallFixtures.snapshot(CallFixtures.call(
            status: .ringing,
            initiatedBy: CallFixtures.coachId
        )))
        await waitUntil("ringing") {
            harness.model.state.current.status == .ringing
        }

        harness.model.shutdown()

        #expect(harness.model.state.current.status == .idle)
        await waitUntil("shutdown tears media down") {
            harness.media.disconnectCount >= 1
        }
    }
}
