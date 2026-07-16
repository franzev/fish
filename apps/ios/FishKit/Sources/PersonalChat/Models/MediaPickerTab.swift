/// The three expressive media the picker offers, in display order. Titles and
/// glyphs mirror the web tab strip exactly.
public enum MediaPickerTab: String, CaseIterable, Equatable, Sendable {
    case emoji
    case gif
    case sticker

    public var title: String {
        switch self {
        case .emoji: "Emoji"
        case .gif: "GIFs"
        case .sticker: "Stickers"
        }
    }

    /// Decorative tab glyph — hidden from assistive tech; the title carries
    /// the meaning.
    public var glyph: String {
        switch self {
        case .emoji: "😀"
        case .gif: "🎞️"
        case .sticker: "🦀"
        }
    }
}
