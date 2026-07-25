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
