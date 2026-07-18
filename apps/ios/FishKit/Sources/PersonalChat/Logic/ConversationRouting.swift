import ChatData

public enum ConversationRoute: Equatable, Sendable {
    case empty
    case direct(conversationId: String)
    case list
}

public enum ConversationRouting {
    public static func route(for conversations: [ChatConversationPreview]) -> ConversationRoute {
        switch conversations.count {
        case 0: .empty
        case 1: .direct(conversationId: conversations[0].conversationId)
        default: .list
        }
    }
}
