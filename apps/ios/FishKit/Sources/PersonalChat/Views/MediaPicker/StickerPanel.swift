import DesignSystem
import SwiftUI

/// Searchable three-column grid over the bundled aquatic pack. No style rail
/// and no recents — search plus one small catalog is the whole surface, by
/// design.
struct StickerPanel: View {
    let onSelect: (ChatSticker) -> Void

    @State private var query: String

    init(initialQuery: String = "", onSelect: @escaping (ChatSticker) -> Void) {
        self.onSelect = onSelect
        self._query = State(initialValue: initialQuery)
    }

    var body: some View {
        VStack(spacing: 0) {
            MediaPickerSearchField(label: "Search stickers", text: $query)
            ScrollView {
                let stickers = StickerCatalog.search(query)
                if stickers.isEmpty {
                    Text("No stickers match that yet.")
                        .textStyle(.ui)
                        .foregroundStyle(Palette.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.lg)
                } else {
                    LazyVGrid(
                        columns: Array(
                            repeating: GridItem(.flexible(), spacing: Spacing.twoXs),
                            count: 3
                        ),
                        spacing: Spacing.twoXs
                    ) {
                        ForEach(stickers) { sticker in
                            stickerTile(sticker)
                        }
                    }
                    .padding(.horizontal, Spacing.xs)
                    .padding(.bottom, Spacing.xs)
                }
            }
        }
    }

    private func stickerTile(_ sticker: ChatSticker) -> some View {
        Button {
            onSelect(sticker)
        } label: {
            StickerMedia(stickerId: sticker.id, displaySize: .fill)
                .padding(Spacing.twoXs)
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .background(
                    Palette.surface2,
                    in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(MediaAccessibility.stickerTileLabel(sticker))
    }
}
