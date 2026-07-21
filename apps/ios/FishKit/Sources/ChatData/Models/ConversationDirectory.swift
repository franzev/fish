import Foundation

public struct ChatConversationPreview: Identifiable, Equatable, Sendable {
    public var id: String { conversationId }
    public let conversationId: String
    public let participantId: String
    public let participantRole: String
    public let participantDisplayName: String
    public let latestMessageSenderId: String?
    public let latestMessageText: String
    public let latestMessageCreatedAt: Date?
    public let unreadCount: Int
    public let hasDraft: Bool

    public init(
        conversationId: String,
        participantId: String,
        participantRole: String,
        participantDisplayName: String,
        latestMessageSenderId: String?,
        latestMessageText: String,
        latestMessageCreatedAt: Date?,
        unreadCount: Int,
        hasDraft: Bool = false
    ) {
        self.conversationId = conversationId
        self.participantId = participantId
        self.participantRole = participantRole
        self.participantDisplayName = participantDisplayName
        self.latestMessageSenderId = latestMessageSenderId
        self.latestMessageText = latestMessageText
        self.latestMessageCreatedAt = latestMessageCreatedAt
        self.unreadCount = max(0, unreadCount)
        self.hasDraft = hasDraft
    }
}

public struct ChatNavigationAttention: Identifiable, Equatable, Sendable {
    public var id: String { "\(surface):\(entityId)" }
    public let surface: String
    public let entityId: String
    public let conversationId: String?
    public let unreadCount: Int
    public let mentionCount: Int
    public let newActivity: Bool

    public init(
        surface: String,
        entityId: String,
        conversationId: String?,
        unreadCount: Int,
        mentionCount: Int,
        newActivity: Bool
    ) {
        self.surface = surface
        self.entityId = entityId
        self.conversationId = conversationId
        self.unreadCount = max(0, unreadCount)
        self.mentionCount = max(0, mentionCount)
        self.newActivity = newActivity
    }
}
