import Foundation

/// The bundled aquatic sticker pack. One shared JSON catalog backs search,
/// tile rendering, and persisted-id fallbacks — the file is synced verbatim
/// from `packages/core` by `pnpm ios:chat-media` and drift-gated in CI.
public enum StickerCatalog {
    public static let all: [ChatSticker] = load()

    private static let byId = Dictionary(
        uniqueKeysWithValues: all.map { ($0.id, $0) }
    )

    /// Nil for ids the bundled catalog does not know — callers render the
    /// calm "Sticker unavailable" fallback.
    public static func sticker(for id: String) -> ChatSticker? {
        byId[id]
    }

    /// Case-insensitive substring search across phrase, animal, description,
    /// keywords, and styles — the exact web vocabulary. An empty or blank
    /// query returns the whole pack.
    public static func search(_ query: String) -> [ChatSticker] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalized.isEmpty else { return all }
        return all.filter { sticker in
            ([sticker.phrase, sticker.animal, sticker.description]
                + sticker.keywords + sticker.styles)
                .contains { $0.lowercased().contains(normalized) }
        }
    }

    private static func load() -> [ChatSticker] {
        guard
            let url = Bundle.module.url(
                forResource: "sticker-catalog",
                withExtension: "json",
                subdirectory: "ChatMedia"
            ),
            let data = try? Data(contentsOf: url),
            let stickers = try? JSONDecoder().decode([ChatSticker].self, from: data)
        else {
            assertionFailure("Bundled sticker catalog is missing or invalid — run: pnpm ios:chat-media")
            return []
        }
        return stickers
    }
}
