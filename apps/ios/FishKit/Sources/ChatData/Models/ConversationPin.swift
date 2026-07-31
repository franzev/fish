import Foundation

/// The conversation's single pinned message, as the server sees it. There is
/// at most one row per conversation — the primary key enforces that, not
/// client logic.
public struct ConversationPin: Equatable, Sendable {
    public let conversationId: String
    public let messageId: String
    public let pinnedBy: String
    public let pinnedAt: Date

    public init(
        conversationId: String,
        messageId: String,
        pinnedBy: String,
        pinnedAt: Date
    ) {
        self.conversationId = conversationId
        self.messageId = messageId
        self.pinnedBy = pinnedBy
        self.pinnedAt = pinnedAt
    }
}
