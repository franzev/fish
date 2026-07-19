import DesignSystem
import SwiftUI
import UIComponents

struct ReactionPicker: View {
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        VStack(spacing: 0) {
            header
            EmojiPanel { emoji in
                onSelect(emoji)
                dismiss()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .frame(
            width: horizontalSizeClass == .regular ? Metrics.reactionPickerWidth : nil,
            height: horizontalSizeClass == .regular ? Metrics.reactionPickerHeight : nil
        )
        .background(Palette.bg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCompactAdaptation(.sheet)
        .accessibilityLabel("Add a reaction")
    }

    private var header: some View {
        HStack(spacing: Spacing.xs) {
            Text("Add a reaction")
                .textStyle(.label)
                .foregroundStyle(Palette.foreground)
                .padding(.leading, Spacing.xs)
            Spacer(minLength: 0)
            IconButton(.close, accessibilityLabel: "Close reaction picker") {
                dismiss()
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.top, Spacing.xs)
        .overlay(alignment: .bottom) {
            Palette.divider.frame(height: 1)
        }
    }
}
