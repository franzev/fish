import DesignSystem
import SwiftUI

/// The picker tabs' shared search treatment: a quiet inline field with a
/// leading glyph, a 50-character cap, and no autofocus — opening a tab never
/// pops the keyboard over the grid. Debouncing belongs to consumers (only the
/// GIF tab wants it).
struct MediaPickerSearchField: View {
    let label: String
    var prompt: String?
    @Binding var text: String

    private static let maxLength = 50

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Icon.search.image
                .glyphFrame()
                .foregroundStyle(Palette.muted)
            TextField(
                "",
                text: $text,
                prompt: Text(prompt ?? label).foregroundStyle(Palette.muted)
            )
            .textInputStyle(.ui)
            .foregroundStyle(Palette.foreground)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.search)
            .accessibilityLabel(label)
            .onChange(of: text) { _, updated in
                if updated.count > Self.maxLength {
                    text = String(updated.prefix(Self.maxLength))
                }
            }
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.compact)
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                .strokeBorder(Palette.border, lineWidth: 1)
        }
        .padding(Spacing.xs)
    }
}
