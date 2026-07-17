import CallData
import DesignSystem
import SwiftUI
import UIComponents

/// Audio-call activity well: who is muted, listening, or speaking — the calm
/// stand-in for a video stage during voice calls. Mirrors the web two-cell
/// grid (`Call activity`).
struct CallActivityPanel: View {
    let state: CallPanelState

    private var call: CallSessionState { state.call }

    var body: some View {
        HStack(spacing: 0) {
            cell(
                name: CallCopy.you,
                status: call.muted
                    ? CallCopy.mutedLabel
                    : state.speaking.localMicrophoneActive
                        ? CallCopy.voiceDetected
                        : CallCopy.listening
            ) {
                if call.muted {
                    Icon.microphoneOff.image
                        .glyphFrame()
                        .foregroundStyle(Palette.muted)
                } else {
                    Icon.microphone.image
                        .glyphFrame()
                        .foregroundStyle(
                            state.speaking.localMicrophoneActive
                                ? Palette.success
                                : Palette.muted
                        )
                }
            }

            Rectangle()
                .fill(Palette.divider)
                .frame(width: 1)

            cell(
                name: CallCopy.callPartner(call),
                status: state.remoteMuted
                    ? CallCopy.mutedLabel
                    : state.speaking.remoteSpeaking
                        ? CallCopy.speaking
                        : CallCopy.listening
            ) {
                if state.remoteMuted {
                    Icon.microphoneOff.image
                        .glyphFrame()
                        .foregroundStyle(Palette.muted)
                } else {
                    MicrophoneLevelMeter(
                        level: state.speaking.remoteMicrophoneLevel,
                        active: state.speaking.remoteSpeaking
                    )
                }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(Palette.surface2)
        .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(CallCopy.callActivity)
    }

    private func cell(
        name: String,
        status: String,
        @ViewBuilder indicator: () -> some View
    ) -> some View {
        HStack(spacing: Spacing.xs) {
            indicator()
            VStack(alignment: .leading, spacing: 0) {
                Text(name)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                Text(status)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
