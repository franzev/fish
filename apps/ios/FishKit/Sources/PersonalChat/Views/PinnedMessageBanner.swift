import DesignSystem
import SwiftUI

/// One quiet row above the transcript. Its only behavior is tap-to-focus —
/// unpinning lives in the pinned message's own context menu, never a second
/// control here. Renders nothing when there is no pin to show.
public struct PinnedMessageBanner: View {
    private let pin: PinnedMessageUiModel?
    private let onTap: (String) -> Void

    public init(pin: PinnedMessageUiModel?, onTap: @escaping (String) -> Void) {
        self.pin = pin
        self.onTap = onTap
    }

    public var body: some View {
        if let pin {
            Button { onTap(pin.messageId) } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "pin.fill")
                        .glyphFrame()
                        .foregroundStyle(Palette.body)
                        .accessibilityHidden(true)
                    Text(pin.snippet)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .padding(.horizontal, Spacing.md)
                .frame(
                    maxWidth: .infinity,
                    minHeight: Metrics.targetTouch,
                    alignment: .leading
                )
                .background(
                    Palette.surface2,
                    in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
                .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Pinned message: \(pin.snippet)")
            .padding(.horizontal, Spacing.page)
            .padding(.top, Spacing.xs)
        }
    }
}
