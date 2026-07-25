import ChatData
import DesignSystem
import SwiftUI

/// One row carrying a conversation's notification state, expanding in place
/// rather than pushing another destination: quiet is a small preference, not a
/// screen. The row holds no state of its own so every combination can be
/// rendered and compared directly.
public struct ConversationQuietRow: View {
    private let mute: ConversationMute
    private let optionsShown: Bool
    private let now: Date
    private let onToggleOptions: () -> Void
    private let onSelect: (ConversationQuietPeriod?) -> Void

    public init(
        mute: ConversationMute,
        optionsShown: Bool,
        now: Date = Date(),
        onToggleOptions: @escaping () -> Void,
        onSelect: @escaping (ConversationQuietPeriod?) -> Void
    ) {
        self.mute = mute
        self.optionsShown = optionsShown
        self.now = now
        self.onToggleOptions = onToggleOptions
        self.onSelect = onSelect
    }

    private var value: String {
        ConversationQuietCopy.value(for: mute, now: now)
    }

    /// The glyph tracks the state so a quiet conversation never carries a
    /// sound-is-on icon.
    private var glyph: Icon {
        mute.isQuiet(at: now) ? .moonFilled : .speaker
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Button(action: onToggleOptions) {
                HStack(spacing: Spacing.sm) {
                    glyph.image
                        .glyphFrame()
                        .foregroundStyle(Palette.body)
                    Text(ConversationQuietCopy.rowLabel)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                    Spacer(minLength: Spacing.sm)
                    Text(value)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .multilineTextAlignment(.trailing)
                }
                .padding(.horizontal, Spacing.md)
                .frame(
                    maxWidth: .infinity,
                    minHeight: Metrics.targetTouch,
                    alignment: .leading
                )
                .background(
                    Palette.surface,
                    in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
                .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(ConversationQuietCopy.rowLabel)
            .accessibilityValue(value)
            .accessibilityIdentifier(ConversationQuietCopy.rowIdentifier)

            if optionsShown {
                // Only offered while something is silenced, so the way back is
                // never a no-op sitting above the quiet periods.
                if mute.isQuiet(at: now) {
                    option(ConversationQuietCopy.turnBackOn, period: nil)
                }
                ForEach(ConversationQuietPeriod.allCases, id: \.self) { period in
                    option(period.label, period: period)
                }
            }
        }
    }

    private func option(_ label: String, period: ConversationQuietPeriod?) -> some View {
        Button { onSelect(period) } label: {
            Text(label)
                .textStyle(.ui)
                .foregroundStyle(Palette.foreground)
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
    }
}
