import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentMediaGrid: View {
    let items: [SharedContentGalleryItem]
    let onSelectItem: ((String) -> Void)?
    let accessibilityFocus: AccessibilityFocusState<String?>.Binding
    let loadThumbnail: (SharedContentMediaThumbnailHandle) async -> Data?
    let onThumbnailDisplayed: (SharedContentMediaThumbnailHandle) -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let minimum = dynamicTypeSize.isAccessibilitySize
            ? SharedContentGalleryLayout.accessibilityMediaMinimum
            : SharedContentGalleryLayout.normalMediaMinimum
        LazyVGrid(
            columns: [
                GridItem(
                    .adaptive(minimum: minimum),
                    spacing: Spacing.twoXs
                ),
            ],
            spacing: Spacing.twoXs
        ) {
            ForEach(items) { item in
                if case .media(let media) = item {
                    mediaTile(media)
                        .sharedContentViewportItem(media.itemId)
                }
            }
        }
        .frame(
            maxWidth: SharedContentGalleryLayout.mediaMaximumWidth(
                accessibilitySize: dynamicTypeSize.isAccessibilitySize
            ),
            alignment: .leading
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func mediaTile(_ item: SharedContentGalleryItem.Media) -> some View {
        let tile = SharedContentMediaThumbnail(
            item: item,
            loadThumbnail: loadThumbnail,
            onDisplayed: onThumbnailDisplayed
        )
            .aspectRatio(1, contentMode: .fit)
            .contentShape(Rectangle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.accessibilityLabel)

        if item.selectionEnabled, let onSelectItem {
            Button {
                onSelectItem(item.itemId)
            } label: {
                tile
            }
            .buttonStyle(.plain)
            .accessibilityFocused(accessibilityFocus, equals: item.itemId)
        } else {
            tile.accessibilityFocused(accessibilityFocus, equals: item.itemId)
        }
    }

}

private struct SharedContentMediaThumbnail: View {
    let item: SharedContentGalleryItem.Media
    let loadThumbnail: (SharedContentMediaThumbnailHandle) async -> Data?
    let onDisplayed: (SharedContentMediaThumbnailHandle) -> Void

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Palette.surface2
            if item.kind == "sticker", let stickerId = item.stickerId {
                StickerMedia(stickerId: stickerId, displaySize: .fill)
            } else if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .onAppear { onDisplayed(item.thumbnailHandle) }
            } else {
                fallback
            }
            if item.kind == "video", image != nil {
                Icon.video.image
                    .glyphFrame()
                    .foregroundStyle(Palette.foreground)
            }
            if item.kind == "gif", image != nil {
                Text("GIF")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.foreground)
            }
        }
        .clipShape(
            RoundedRectangle(
                cornerRadius: Radius.chatInner,
                style: .continuous
            )
        )
        .task(id: item.thumbnailHandle) {
            guard item.kind != "sticker",
                  let data = await loadThumbnail(item.thumbnailHandle)
            else { return }
            image = UIImage(data: data)
        }
    }

    @ViewBuilder private var fallback: some View {
        switch item.kind {
        case "video":
            Icon.video.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
        case "gif":
            Text("GIF")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
        case "sticker":
            Icon.moodSmile.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
        default:
            Icon.photo.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
        }
    }
}
