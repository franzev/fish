import DesignSystem
import SwiftUI

/// Renders a catalog sticker from the bundled WebP assets. Unknown ids keep
/// the message readable with a calm "Sticker unavailable" box — persisted
/// sticker ids must survive clients older than the pack.
public struct StickerMedia: View {
    public enum DisplaySize: Equatable, Sendable {
        /// Transcript size (96 pt).
        case tile
        /// Composer-thumbnail size (44 pt).
        case control
        /// Fills the proposed square, for picker grid cells.
        case fill

        var length: CGFloat? {
            switch self {
            case .tile: Metrics.stickerTile
            case .control: Metrics.targetTouch
            case .fill: nil
            }
        }
    }

    private let stickerId: String
    private let displaySize: DisplaySize

    public init(stickerId: String, displaySize: DisplaySize = .tile) {
        self.stickerId = stickerId
        self.displaySize = displaySize
    }

    public var body: some View {
        if
            let sticker = StickerCatalog.sticker(for: stickerId),
            let image = Self.image(for: sticker)
        {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(width: displaySize.length, height: displaySize.length)
                .accessibilityLabel(sticker.description)
        } else {
            RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                .fill(Palette.surface2)
                .frame(width: displaySize.length, height: displaySize.length)
                .overlay {
                    Text(MediaAccessibility.stickerUnavailableLabel)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                        .multilineTextAlignment(.center)
                        .padding(Spacing.twoXs)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(MediaAccessibility.stickerUnavailableLabel)
        }
    }

    @MainActor private static let imageCache = NSCache<NSString, UIImage>()

    @MainActor private static func image(for sticker: ChatSticker) -> UIImage? {
        let key = sticker.assetBaseName as NSString
        if let cached = imageCache.object(forKey: key) {
            return cached
        }
        guard
            let url = Bundle.module.url(
                forResource: sticker.assetBaseName,
                withExtension: "webp",
                subdirectory: "ChatMedia/stickers/aquatic"
            ),
            let image = UIImage(contentsOfFile: url.path())
        else { return nil }
        imageCache.setObject(image, forKey: key)
        return image
    }
}
