import ChatData

/// The composer's staged expressive media. GIF and sticker are mutually
/// exclusive by construction — selecting one replaces the other. Text combines
/// with either. The GIF case carries the search query that found it so the
/// send path can register the share with the provider after a confirmed send.
public enum ComposerSelection: Equatable, Sendable {
    case none
    case gif(ChatGif, searchQuery: String)
    case sticker(ChatSticker)

    public var stagedGif: ChatGif? {
        if case .gif(let gif, _) = self { return gif }
        return nil
    }

    public var stagedSticker: ChatSticker? {
        if case .sticker(let sticker) = self { return sticker }
        return nil
    }
}
