import Foundation

public struct ChatMessageSearchCursor: Equatable, Sendable {
    public let createdAt: String
    public let id: String

    public init(createdAt: String, id: String) {
        self.createdAt = createdAt
        self.id = id
    }
}

public struct ChatMessageSearchHit: Equatable, Sendable {
    public let id: String
    public let conversationId: String
    public let senderId: String
    public let body: String
    public let createdAt: Date

    public init(
        id: String,
        conversationId: String,
        senderId: String,
        body: String,
        createdAt: Date
    ) {
        self.id = id
        self.conversationId = conversationId
        self.senderId = senderId
        self.body = body
        self.createdAt = createdAt
    }
}

public struct ChatMessageSearchPage: Equatable, Sendable {
    public let hits: [ChatMessageSearchHit]
    public let nextCursor: ChatMessageSearchCursor?

    public init(
        hits: [ChatMessageSearchHit],
        nextCursor: ChatMessageSearchCursor?
    ) {
        self.hits = hits
        self.nextCursor = nextCursor
    }
}
