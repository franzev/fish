import Foundation

public enum MessageDirection: Sendable, Equatable {
    case incoming
    case outgoing
}

public enum MessageDeliveryStatus: Sendable, Equatable {
    case sending
    case sent
    case delivered
    case read
    case failed
}

public struct MessageReplyPreviewUiModel: Equatable, Sendable {
    public let messageId: String
    public let authorName: String
    public let snippet: String

    public init(messageId: String, authorName: String, snippet: String) {
        self.messageId = messageId
        self.authorName = authorName
        self.snippet = snippet
    }
}

public struct MessageReactionUiModel: Identifiable, Equatable, Sendable {
    public var id: String { emoji }
    public let emoji: String
    public let count: Int
    public let byMe: Bool

    public init(emoji: String, count: Int, byMe: Bool) {
        self.emoji = emoji
        self.count = count
        self.byMe = byMe
    }
}

/// Provider-free presentation model. Future state and data layers adapt into
/// this value without changing views.
public struct MessageUiModel: Identifiable, Equatable, Sendable {
    public let id: String
    public let direction: MessageDirection
    public let senderId: String
    public let senderName: String
    public let body: String
    /// Expressive media rendered above the text bubble. `body` may be empty
    /// when media is present — never both empty and `nil` media.
    public let media: MessageMedia?
    public let attachments: [MessageAttachmentUiModel]
    public let sentAt: Date
    public let delivery: MessageDeliveryStatus?
    public let replyPreview: MessageReplyPreviewUiModel?
    public let reactions: [MessageReactionUiModel]
    public let isEdited: Bool
    public let isDeleted: Bool

    public init(
        id: String,
        direction: MessageDirection,
        senderId: String,
        senderName: String,
        body: String,
        media: MessageMedia? = nil,
        attachments: [MessageAttachmentUiModel] = [],
        sentAt: Date,
        delivery: MessageDeliveryStatus? = nil,
        replyPreview: MessageReplyPreviewUiModel? = nil,
        reactions: [MessageReactionUiModel] = [],
        isEdited: Bool = false,
        isDeleted: Bool = false
    ) {
        self.id = id
        self.direction = direction
        self.senderId = senderId
        self.senderName = senderName
        self.body = body
        self.media = media
        self.attachments = attachments
        self.sentAt = sentAt
        self.delivery = delivery
        self.replyPreview = replyPreview
        self.reactions = reactions
        self.isEdited = isEdited
        self.isDeleted = isDeleted
    }
}
