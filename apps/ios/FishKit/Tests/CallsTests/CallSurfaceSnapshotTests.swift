import CallData
@testable import Calls
import DesignSystem
import PersonalChat
import SwiftUI
import Testing
import TestSupport

/// Visual regression over every call surface state, light and dark — the
/// same state matrix the web Storybook stories pin, on the floating card and
/// the full-screen video stage.
@MainActor
struct CallSurfaceSnapshotTests {
    private func session(
        _ status: CallLifecycleStatus,
        direction: CallDirection = .incoming,
        kind: CallKind = .audio,
        muted: Bool = false,
        cameraEnabled: Bool = false
    ) -> CallSessionState {
        CallSessionState(
            callId: "call-1",
            counterpartId: "user-2",
            counterpartName: "Coach Mina",
            kind: kind,
            status: status,
            direction: direction,
            muted: muted,
            cameraEnabled: cameraEnabled,
            expiresAt: "2026-07-17T10:00:45.000Z",
            connectedAt: status == .active || status == .reconnecting
                ? "2026-07-17T10:00:06.000Z"
                : nil
        )
    }

    private func surface(
        _ state: CallPanelState,
        chatContent: AnyView? = nil,
        chatOpen: Bool = false
    ) -> some View {
        CallSurface(
            state: state,
            chatContent: chatContent,
            chatOpen: chatOpen
        )
    }

    @Test func incomingAudioRinging() {
        let view = surface(CallPanelState(call: session(.ringing)))
        assertThemedSnapshots(of: view, named: "incoming-audio-ringing")
        assertAccessibilitySnapshots(of: view, named: "incoming-audio-ringing")
    }

    @Test func incomingVideoRinging() {
        assertThemedSnapshots(
            of: surface(CallPanelState(call: session(.ringing, kind: .video))),
            named: "incoming-video-ringing"
        )
    }

    @Test func outgoingRinging() {
        assertThemedSnapshots(
            of: surface(CallPanelState(call: session(.ringing, direction: .outgoing))),
            named: "outgoing-ringing"
        )
    }

    @Test func requestingPermission() {
        assertThemedSnapshots(
            of: surface(CallPanelState(call: CallSessionState(
                counterpartId: "user-2",
                counterpartName: "Coach Mina",
                kind: .video,
                status: .requestingPermission,
                direction: .outgoing
            ))),
            named: "requesting-permission"
        )
    }

    @Test func connectingAudio() {
        assertThemedSnapshots(
            of: surface(CallPanelState(call: session(.connecting), busy: true)),
            named: "connecting-audio"
        )
    }

    @Test func activeAudioSpeaking() {
        let view = surface(CallPanelState(
            call: session(.active),
            speaking: CallMediaSpeaking(
                localMicrophoneActive: true,
                localMicrophoneLevel: 0.55,
                remoteSpeaking: true,
                remoteMicrophoneLevel: 0.72
            )
        ))
        assertThemedSnapshots(of: view, named: "active-audio-speaking")
        assertAccessibilitySnapshots(of: view, named: "active-audio-speaking")
    }

    @Test func activeAudioBothMuted() {
        assertThemedSnapshots(
            of: surface(CallPanelState(
                call: session(.active, muted: true),
                remoteMuted: true
            )),
            named: "active-audio-both-muted"
        )
    }

    @Test func reconnectingAudio() {
        assertThemedSnapshots(
            of: surface(CallPanelState(call: session(.reconnecting))),
            named: "reconnecting-audio"
        )
    }

    @Test func terminalMissed() {
        assertThemedSnapshots(
            of: surface(CallPanelState(call: session(.missed))),
            named: "terminal-missed"
        )
    }

    @Test func failedWithNotice() {
        // A distinct provider reason — the failed heading already carries
        // CallCopy.callDidNotConnect, so an identical notice would render the
        // same sentence twice.
        assertThemedSnapshots(
            of: surface(CallPanelState(
                call: session(.failed),
                notice: CallCopy.callNoLongerAvailable
            )),
            named: "failed-with-notice"
        )
    }

    @Test func videoActiveCameraOff() {
        assertThemedSnapshots(
            of: surface(CallPanelState(
                call: session(.active, kind: .video),
                speakerEnabled: true
            )),
            named: "video-active-camera-off"
        )
    }

    @Test func videoActiveRemoteMutedWithLocalCamera() {
        assertThemedSnapshots(
            of: surface(CallPanelState(
                call: session(.active, kind: .video, cameraEnabled: true),
                remoteMuted: true,
                localVideoAvailable: true,
                speakerEnabled: true
            )),
            named: "video-active-remote-muted"
        )
    }

    @Test func videoConnecting() {
        assertThemedSnapshots(
            of: surface(CallPanelState(
                call: session(.connecting, kind: .video),
                busy: true
            )),
            named: "video-connecting"
        )
    }

    @Test func videoActiveChatOpen() {
        let chat = AnyView(
            VStack {
                Spacer()
                Text("Conversation renders here")
                    .textStyle(.body)
                Spacer()
            }
            .frame(maxWidth: .infinity)
        )
        assertThemedSnapshots(
            of: surface(
                CallPanelState(
                    call: session(.active, kind: .video, cameraEnabled: true),
                    speakerEnabled: true
                ),
                chatContent: chat,
                chatOpen: true
            ),
            named: "video-active-chat-open"
        )
    }

    @Test func entryButtons() {
        let view = HStack {
            CallEntryButtons(
                recipientName: "Coach Mina",
                busy: false,
                onStartCall: { _ in }
            )
        }
        .padding(Spacing.page)
        .frame(maxWidth: .infinity, alignment: .leading)
        assertThemedSnapshots(of: view, named: "call-entry-buttons")
    }

    @Test func entryButtonsInChatHeader() {
        let view = PersonalChatTopBar(
            participantName: "Coach Mina",
            presence: PresenceUiModel(label: "Online", tone: .online),
            onBack: {},
            trailingContent: AnyView(CallEntryButtons(
                recipientName: "Coach Mina",
                busy: false,
                onStartCall: { _ in }
            ))
        )
        assertThemedSnapshots(of: view, named: "call-entry-chat-header")
        assertAccessibilitySnapshots(of: view, named: "call-entry-chat-header")
    }
}
