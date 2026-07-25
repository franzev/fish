public enum MessageAction: Equatable, Sendable {
    case reply(String)
    case edit(String)
    case delete(String)
    case toggleReaction(messageId: String, emoji: String)
    case reportGif(String)
    /// The viewer tapped a reply preview to jump to the quoted message.
    case openReplyPreview(String)
}
