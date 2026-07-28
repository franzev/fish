import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// Closure bundle the stateless call surfaces emit intent through — set only
/// what the host wires (the web context-callback shape).
public struct CallPanelActions {
    public var answer: () -> Void = {}
    public var decline: () -> Void = {}
    public var cancel: () -> Void = {}
    public var end: () -> Void = {}
    public var toggleMute: () -> Void = {}
    public var toggleCamera: () -> Void = {}
    public var switchCamera: () -> Void = {}
    public var toggleSpeaker: () -> Void = {}
    public var openMessages: () -> Void = {}
    public var setVideoQualityPreference: (VideoQualityPreference) -> Void = { _ in }

    public init() {}
}

/// The in-call control row: quiet 44-point icon controls around the single
/// critical end action. While `connecting`, only End call shows (web parity).
struct CallControls: View {
    let state: CallPanelState
    let actions: CallPanelActions

    @State private var settingsOpen = false

    private var call: CallSessionState { state.call }
    private var showsFullRow: Bool { call.status != .connecting }

    var body: some View {
        HStack(spacing: Spacing.xs) {
            if showsFullRow {
                if call.kind == .video {
                    HStack(spacing: Spacing.twoXs) {
                        MicrophoneLevelMeter(
                            level: call.muted ? 0 : state.speaking.localMicrophoneLevel,
                            active: !call.muted && state.speaking.localMicrophoneActive
                        )
                        muteButton
                    }
                } else {
                    muteButton
                }

                if call.kind == .video {
                    IconButton(
                        call.cameraEnabled ? .video : .videoOff,
                        accessibilityLabel: call.cameraEnabled
                            ? CallCopy.cameraOff
                            : CallCopy.cameraOn,
                        action: actions.toggleCamera
                    )
                    if call.cameraEnabled {
                        IconButton(
                            .cameraFlip,
                            accessibilityLabel: CallCopy.switchCamera,
                            action: actions.switchCamera
                        )
                    }
                } else {
                    IconButton(
                        .speaker,
                        isActive: state.speakerEnabled,
                        accessibilityLabel: state.speakerEnabled
                            ? CallCopy.speakerOff
                            : CallCopy.speakerOn,
                        action: actions.toggleSpeaker
                    )
                }

                IconButton(
                    .messages,
                    accessibilityLabel: CallCopy.openMessages,
                    action: actions.openMessages
                )

                if call.kind == .video {
                    IconButton(
                        .settings,
                        accessibilityLabel: CallCopy.callSettings
                    ) {
                        settingsOpen = true
                    }
                }
            }

            IconButton(
                .phoneOff,
                tone: .critical,
                accessibilityLabel: CallCopy.endCall,
                isBusy: state.busy,
                action: actions.end
            )
        }
        .frame(maxWidth: .infinity)
        .sheet(isPresented: $settingsOpen) {
            CallSettingsSheet(
                preference: state.videoQualityPreference,
                onSetPreference: actions.setVideoQualityPreference
            )
        }
    }

    private var muteButton: some View {
        IconButton(
            call.muted ? .microphoneOff : .microphone,
            accessibilityLabel: call.muted ? CallCopy.unmute : CallCopy.mute,
            action: actions.toggleMute
        )
    }
}
