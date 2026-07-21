import ChatCore

public protocol ChatMessagingProviding: Sendable {
    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage
    func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit: Int
    ) async throws -> ChatMessagePage
    func newestWindow(conversationId: String, limit: Int) async throws -> ChatNewestWindow
    func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit: Int
    ) async throws -> ChatBackfillPage
    func messages(ids: [String]) async throws -> [ChatMessage]
    func searchMessages(
        conversationId: String,
        query: String,
        before: ChatMessageSearchCursor?,
        limit: Int
    ) async throws -> ChatMessageSearchPage
}

public extension ChatMessagingProviding {
    func messages(conversationId: String) async throws -> [ChatMessage] {
        try await messages(
            conversationId: conversationId,
            before: nil,
            limit: 40
        ).messages
    }
}

public enum ChatMessageCommand: Equatable, Sendable {
    case edit(messageId: String, body: String)
    case delete(messageId: String)
    case setReaction(messageId: String, emoji: String, active: Bool)
}

public protocol ChatCommandProviding: Sendable {
    func execute(_ command: ChatMessageCommand) async throws -> ChatMessage
    func reportGif(messageId: String) async throws
    func markReadState(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?
    ) async throws -> ChatReadState
    func unreadSummary(conversationId: String) async throws -> ChatUnreadSummary
}

public protocol ConversationDirectoryProviding: Sendable {
    func conversations() async throws -> [ChatConversationPreview]
    func navigationAttention() async throws -> [ChatNavigationAttention]
    func attentionEvents(conversationIds: [String]) -> AsyncStream<String>
}
