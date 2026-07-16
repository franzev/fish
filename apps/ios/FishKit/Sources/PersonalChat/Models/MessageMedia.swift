import ChatData

/// Optional expressive media on a message. The web row carries independent
/// optional fields; iOS encodes the same states as one enum so a message can
/// never claim both a GIF and a sticker, and invalid provider metadata maps
/// to a readable fallback instead of propagating bad URLs.
public enum MessageMedia: Equatable, Sendable {
    /// Catalog-backed sticker. Unknown ids stay representable and render as
    /// "Sticker unavailable" so old clients survive future packs.
    case sticker(id: String)
    case gif(ChatGif)
    /// A GIF row whose metadata failed validation — kept readable, never blank.
    case gifUnavailable
}
