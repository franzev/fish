import Foundation

public struct ChatNotificationReply: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let conversationId: String
    public let body: String
    public let messageId: String?
    public let createdAt: Date

    public init(
        id: String = UUID().uuidString.lowercased(),
        conversationId: String,
        body: String,
        messageId: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.conversationId = conversationId
        self.body = body
        self.messageId = messageId
        self.createdAt = createdAt
    }
}

public protocol ChatNotificationReplyProviding: Sendable {
    func enqueue(_ reply: ChatNotificationReply) async throws
    func pendingReplies() async throws -> [ChatNotificationReply]
    func remove(id: String) async throws
    func removeAll() async throws
}
