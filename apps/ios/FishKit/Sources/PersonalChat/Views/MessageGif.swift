import ChatData
import DesignSystem
import SwiftUI

/// A GIF message in the transcript: capped-width media with its own playback
/// control and always-visible provider attribution linking to the source.
/// The media image is hidden from assistive tech — the bubble's combined
/// label already describes it — while the control and link stay focusable.
public struct MessageGif: View {
    private let gif: ChatGif

    public init(gif: ChatGif) {
        self.gif = gif
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            GifMedia(
                gif: gif,
                allowPlaybackControl: true,
                mediaAccessibilityHidden: true
            )
            Link(destination: gif.sourceUrl) {
                Text("Via \(providerName)")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
                    .frame(minHeight: Metrics.targetTouch)
                    .contentShape(Rectangle())
            }
        }
        .frame(maxWidth: Metrics.chatGifMaxWidth, alignment: .leading)
    }

    private var providerName: String {
        switch gif.provider {
        case .klipy: "KLIPY"
        case .giphy: "GIPHY"
        }
    }
}
