import ChatData
import DesignSystem
import SwiftUI
import UIComponents

/// The staged GIF above the composer field: a small live preview, a quiet
/// confirmation label, and one removal control. Text can still be typed and
/// sent alongside it.
public struct GifSelectionPreview: View {
    private let gif: ChatGif
    private let onRemove: () -> Void

    public init(gif: ChatGif, onRemove: @escaping () -> Void) {
        self.gif = gif
        self.onRemove = onRemove
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Spacing.xs) {
            GifMedia(gif: gif, preview: true, allowPlaybackControl: true)
                .frame(width: Metrics.chatGifSelection)
            Text(MediaAccessibility.gifSelectedLabel)
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
            Spacer(minLength: 0)
            IconButton(
                .close,
                accessibilityLabel: MediaAccessibility.removeGifLabel,
                action: onRemove
            )
        }
    }
}
