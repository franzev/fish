import DesignSystem
import SwiftUI

/// Three equal-width expression tabs, drawn with tokens instead of a system
/// segmented control so the monochrome hierarchy holds. Glyphs are decorative;
/// the titles carry the meaning.
struct MediaPickerTabs: View {
    @Binding var selection: MediaPickerTab
    var gifDisabled = false
    var stickerDisabled = false

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        HStack(spacing: Spacing.twoXs) {
            ForEach(MediaPickerTab.allCases, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, Spacing.twoXs)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Expression type")
        .overlay(alignment: .bottom) {
            Palette.divider.frame(height: 1)
        }
    }

    private func isDisabled(_ tab: MediaPickerTab) -> Bool {
        switch tab {
        case .emoji: false
        case .gif: gifDisabled
        case .sticker: stickerDisabled
        }
    }

    private func tabButton(_ tab: MediaPickerTab) -> some View {
        let isSelected = selection == tab
        let disabled = isDisabled(tab)
        return Button {
            selection = tab
        } label: {
            HStack(spacing: Spacing.twoXs) {
                // Decorative; dropped at accessibility sizes so the title
                // always fits its third of the strip.
                if !typeSize.isAccessibilitySize {
                    Text(tab.glyph).accessibilityHidden(true)
                }
                Text(tab.title).textStyle(.caption)
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.twoXs)
            .background(
                isSelected ? Palette.surface2 : .clear,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
            .foregroundStyle(
                disabled ? Palette.muted : isSelected ? Palette.foreground : Palette.body
            )
            .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}
