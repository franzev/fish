import DesignSystem
import SwiftUI

/// The staged sticker shown in place of the expression trigger — selection is
/// visible without growing the composer, and tapping it removes the sticker.
public struct StickerSelectionThumbnail: View {
    private let sticker: ChatSticker
    private let onRemove: () -> Void

    public init(sticker: ChatSticker, onRemove: @escaping () -> Void) {
        self.sticker = sticker
        self.onRemove = onRemove
    }

    public var body: some View {
        Button(action: onRemove) {
            StickerMedia(stickerId: sticker.id, displaySize: .control)
                .overlay(alignment: .topTrailing) {
                    Icon.close.image
                        .frame(
                            width: TypeScale.caption.size,
                            height: TypeScale.caption.size
                        )
                        .foregroundStyle(Palette.foreground)
                        .frame(width: Metrics.avatarBadge, height: Metrics.avatarBadge)
                        .background(Palette.surface2, in: Circle())
                        .offset(x: Spacing.twoXs, y: -Spacing.twoXs)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(MediaAccessibility.removeStickerLabel)
    }
}
