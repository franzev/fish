import DesignSystem
import SwiftUI

struct ReactionPill: View {
    let reaction: MessageReactionUiModel
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("\(reaction.emoji) \(reaction.count)")
                .textStyle(.caption)
                .foregroundStyle(Palette.foreground)
                .padding(.horizontal, Spacing.xs)
                .frame(minHeight: Metrics.targetTouch)
                .background(
                    reaction.byMe ? Palette.surface2 : Palette.surface,
                    in: Capsule()
                )
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? Opacity.focus : 1)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(reaction.byMe ? "Removes your reaction" : "Adds your reaction")
        .accessibilityAddTraits(reaction.byMe ? .isSelected : [])
    }

    private var accessibilityLabel: String {
        let people = reaction.count == 1 ? "person" : "people"
        let ownership = reaction.byMe ? ", including you" : ""
        return "\(reaction.emoji) reaction, \(reaction.count) \(people)\(ownership)"
    }
}
