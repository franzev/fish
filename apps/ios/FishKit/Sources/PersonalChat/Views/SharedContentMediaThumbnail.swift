import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentMediaThumbnail: View {
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
