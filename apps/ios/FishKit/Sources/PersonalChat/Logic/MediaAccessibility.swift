import ChatData

/// Accessible names for the media picker and staged/rendered media — the
/// exact strings the web implementation exposes, so the two platforms read
/// identically under assistive tech.
public enum MediaAccessibility {
    public static let triggerLabel = "Add emoji, GIF, or sticker"
    public static let pickerTitle = "Add to message"
    public static let closeLabel = "Close expression picker"
    public static let removeGifLabel = "Remove selected GIF"
    public static let removeStickerLabel = "Remove selected sticker"
    public static let gifSelectedLabel = "GIF selected"
    public static let stickerUnavailableLabel = "Sticker unavailable"
    public static let gifUnavailableLabel = "GIF unavailable"

    public static func stickerTileLabel(_ sticker: ChatSticker) -> String {
        "Add \(sticker.phrase) sticker"
    }

    public static func gifTileLabel(_ gif: ChatGif) -> String {
        "Choose \(gif.description)"
    }

    public static func gifPlaybackLabel(paused: Bool, description: String) -> String {
        paused ? "Play GIF: \(description)" : "Pause GIF: \(description)"
    }

    /// Spoken description of a message's media, woven into the transcript
    /// row's combined label ahead of the body text.
    public static func mediaDescription(_ media: MessageMedia) -> String {
        switch media {
        case .sticker(let id):
            StickerCatalog.sticker(for: id)
                .map { "\($0.description) sticker" } ?? stickerUnavailableLabel
        case .gif(let gif):
            "GIF: \(gif.description)"
        case .gifUnavailable:
            gifUnavailableLabel
        }
    }
}
