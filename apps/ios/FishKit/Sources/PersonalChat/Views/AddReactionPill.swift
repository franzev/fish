import DesignSystem
import SwiftUI

struct AddReactionPill: View {
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("+")
                .textStyle(.label)
                .foregroundStyle(Palette.muted)
                .frame(width: Metrics.targetTouch, height: Metrics.targetTouch)
                .background(Palette.surface, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? Opacity.focus : 1)
        .accessibilityLabel("Add a reaction")
    }
}
