import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// The full-bleed video surface: remote video (or its calm camera-off
/// placeholder) on the `surface2` well, the remote speaking/muted pills, and
/// the draggable self-view — a state-for-state port of the web video stage.
struct CallVideoStage: View {
    let state: CallPanelState
    let remoteVideo: AnyView?
    let localVideo: AnyView?

    private var call: CallSessionState { state.call }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Palette.surface2

                if let remoteVideo, state.remoteVideoAvailable {
                    remoteVideo
                        .accessibilityLabel(CallCopy.remoteVideoLabel(for: call))
                } else {
                    VStack(spacing: Spacing.xs) {
                        Icon.videoOff.image
                            .glyphFrame()
                            .foregroundStyle(Palette.body)
                        Text(CallCopy.cameraOffPlaceholder(for: call))
                            .textStyle(.caption)
                            .foregroundStyle(Palette.body)
                            .lineLimit(1)
                            .padding(.horizontal, Spacing.md)
                    }
                }

                pills
                    .frame(
                        maxWidth: .infinity,
                        maxHeight: .infinity,
                        alignment: .bottom
                    )

                LocalVideoPreview(
                    video: state.localVideoAvailable ? localVideo : nil,
                    stageSize: geometry.size
                )
            }
        }
        .clipped()
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var pills: some View {
        if state.remoteMuted {
            HStack(spacing: Spacing.xs) {
                Icon.microphoneOff.image
                    .glyphFrame()
                    .foregroundStyle(Palette.foreground)
                Text(CallCopy.remoteMutedPill(for: call))
                    .textStyle(.caption)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .background(Palette.bg, in: Capsule())
            .padding(.bottom, Spacing.sm)
            .accessibilityElement(children: .combine)
        } else if state.speaking.remoteSpeaking {
            HStack {
                MicrophoneLevelMeter(
                    level: state.speaking.remoteMicrophoneLevel,
                    active: true
                )
                .padding(.horizontal, Spacing.sm)
                .frame(minHeight: Metrics.targetTouch)
                .background(Palette.bg, in: Capsule())
                .accessibilityLabel(CallCopy.remoteSpeakingLabel(for: call))
                Spacer(minLength: 0)
            }
            .padding([.leading, .bottom], Spacing.sm)
        }
    }
}
