public enum MessageAction: Equatable, Sendable {
    case reply(String)
    case edit(String)
    case delete(String)
    case toggleReaction(messageId: String, emoji: String)
    case reportGif(String)
}
