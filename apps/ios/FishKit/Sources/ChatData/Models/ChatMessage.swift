import Foundation

public struct ChatMessage: Identifiable, Equatable, Sendable {
    public let id: String
    public let conversationId: String
    public let senderId: String
    public let senderRole: String
    public let body: String
    public let createdAt: Date
    public let attachments: [ChatAttachment]

    public init(
        id: String,
        conversationId: String,
        senderId: String,
        senderRole: String,
        body: String,
        createdAt: Date,
        attachments: [ChatAttachment] = []
    ) {
        self.id = id
        self.conversationId = conversationId
        self.senderId = senderId
        self.senderRole = senderRole
        self.body = body
        self.createdAt = createdAt
        self.attachments = attachments
    }

    public func withAttachments(_ attachments: [ChatAttachment]) -> Self {
        Self(
            id: id,
            conversationId: conversationId,
            senderId: senderId,
            senderRole: senderRole,
            body: body,
            createdAt: createdAt,
            attachments: attachments
        )
    }
}

public struct SendChatMessageRequest: Equatable, Sendable, Codable {
    public let conversationId: String
    public let body: String
    public let clientRequestId: String
    public let attachmentIds: [String]

    public init(
        conversationId: String,
        body: String,
        clientRequestId: String,
        attachmentIds: [String]
    ) {
        self.conversationId = conversationId
        self.body = body
        self.clientRequestId = clientRequestId
        self.attachmentIds = attachmentIds
    }
}
