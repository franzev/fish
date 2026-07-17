import CallData
import DesignSystem
import SwiftUI

/// Heading and status line for the current call state. Ringing prompts use
/// the serif heading role; every other state uses the compact form with the
/// call-kind chip — mirroring the web `CallPopoverView` header.
struct CallStatusHeader: View {
    let call: CallSessionState

    private var copy: CallCopy.StateCopy { CallCopy.stateCopy(for: call) }

    private var isPrompt: Bool {
        call.status == .ringing
    }

    var body: some View {
        if isPrompt {
            VStack(alignment: .leading, spacing: Spacing.twoXs) {
                Text(copy.heading)
                    .textStyle(.heading)
                    .foregroundStyle(Palette.foreground)
                    .fixedSize(horizontal: false, vertical: true)
                Text(copy.status)
                    .textStyle(.ui)
                    .foregroundStyle(Palette.body)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        } else {
            HStack(spacing: Spacing.sm) {
                kindChip
                VStack(alignment: .leading, spacing: 0) {
                    Text(copy.heading)
                        .textStyle(.label)
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(1)
                    Text(copy.status)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var kindChip: some View {
        (call.kind == .video ? Icon.video : Icon.phone).image
            .glyphFrame()
            .foregroundStyle(Palette.foreground)
            .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
            .background(Palette.surface2, in: Circle())
    }
}
