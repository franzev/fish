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
    public var toggleChat: () -> Void = {}
    public var setVideoQualityPreference: (VideoQualityPreference) -> Void = { _ in }

    public init() {}
}

/// The in-call control row: quiet 44-point icon controls around the single
/// critical end action. While `connecting`, only End call shows (web parity).
struct CallControls: View {
    let state: CallPanelState
    let actions: CallPanelActions
    let chatAvailable: Bool
    let chatOpen: Bool

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

                if chatAvailable {
                    IconButton(
                        .messages,
                        isActive: chatOpen,
                        accessibilityLabel: chatOpen
                            ? CallCopy.closeChat
                            : CallCopy.openChat,
                        action: actions.toggleChat
                    )
                }

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

/// Video-call settings: the one disclosed choice ("Use less data") plus the
/// platform note that audio routing follows the device. The web microphone
/// picker has no iOS equivalent — the system owns the active route.
private struct CallSettingsSheet: View {
    let preference: VideoQualityPreference
    let onSetPreference: (VideoQualityPreference) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(CallCopy.callSettings)
                .textStyle(.heading)
                .foregroundStyle(Palette.foreground)

            Toggle(isOn: Binding(
                get: { preference == .dataSaver },
                set: { onSetPreference($0 ? .dataSaver : .auto) }
            )) {
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(CallCopy.dataSaverTitle)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                    Text(CallCopy.dataSaverDescription)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                }
            }
            .tint(Palette.primary)
            .frame(minHeight: Metrics.targetTouch)

            Text(CallCopy.audioRouteNote)
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)

            Spacer(minLength: 0)
        }
        .padding(Spacing.page)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.surface)
        .presentationDetents([.height(Metrics.callSettings)])
        .presentationDragIndicator(.visible)
    }
}
