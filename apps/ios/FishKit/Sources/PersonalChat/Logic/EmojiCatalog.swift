import Foundation

/// The shared emoji catalog (nine Unicode groups, generated from
/// unicode-emoji-json). Decoded once on first use; synced verbatim from
/// `packages/core` and drift-gated like the sticker catalog.
public enum EmojiCatalog {
    public static let groups: [EmojiGroup] = load()

    /// Case-insensitive substring search over name and slug, flattened across
    /// every group — identical results to the web picker. Blank queries return
    /// nothing; browsing uses `groups` instead.
    public static func search(_ query: String) -> [EmojiEntry] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalized.isEmpty else { return [] }
        return groups.flatMap(\.emojis).filter { entry in
            entry.name.lowercased().contains(normalized)
                || entry.slug.lowercased().contains(normalized)
        }
    }

    private static func load() -> [EmojiGroup] {
        guard
            let url = Bundle.module.url(
                forResource: "emoji-groups",
                withExtension: "json",
                subdirectory: "ChatMedia"
            ),
            let data = try? Data(contentsOf: url),
            let groups = try? JSONDecoder().decode([EmojiGroup].self, from: data)
        else {
            assertionFailure("Bundled emoji catalog is missing or invalid — run: pnpm ios:chat-media")
            return []
        }
        return groups
    }
}
