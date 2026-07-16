/// One emoji from the shared `emoji-groups.json` catalog (generated from
/// unicode-emoji-json — identical search vocabulary on every platform).
/// Skin-tone metadata exists in the file but is deliberately not modeled:
/// web ships base glyphs only, and iOS matches it.
public struct EmojiEntry: Decodable, Equatable, Sendable, Identifiable {
    public let emoji: String
    public let name: String
    public let slug: String

    public var id: String { slug }

    public init(emoji: String, name: String, slug: String) {
        self.emoji = emoji
        self.name = name
        self.slug = slug
    }
}

/// One of the nine Unicode categories the picker browses.
public struct EmojiGroup: Decodable, Equatable, Sendable, Identifiable {
    public let name: String
    public let slug: String
    public let emojis: [EmojiEntry]

    public var id: String { slug }

    public init(name: String, slug: String, emojis: [EmojiEntry]) {
        self.name = name
        self.slug = slug
        self.emojis = emojis
    }
}
