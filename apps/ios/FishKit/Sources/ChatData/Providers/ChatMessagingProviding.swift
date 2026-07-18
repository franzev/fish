public protocol ChatMessagingProviding: Sendable {
    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage
    func messages(conversationId: String) async throws -> [ChatMessage]
}
