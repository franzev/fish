import ChatCore
import Foundation

public struct ChatMessagePage: Equatable, Sendable {
    public let messages: [ChatMessage]
    public let hasMoreOlder: Bool
    public let oldestCursor: ChatMessageCursor?

    public init(messages: [ChatMessage], hasMoreOlder: Bool, oldestCursor: ChatMessageCursor?) {
        self.messages = messages
        self.hasMoreOlder = hasMoreOlder
        self.oldestCursor = oldestCursor
    }
}

public struct ChatNewestWindow: Equatable, Sendable {
    public let messages: [ChatMessage]
    public let readStates: [ChatReadState]
    public let hasMoreOlder: Bool
    public let oldestCursor: ChatMessageCursor?

    public init(
        messages: [ChatMessage],
        readStates: [ChatReadState],
        hasMoreOlder: Bool,
        oldestCursor: ChatMessageCursor?
    ) {
        self.messages = messages
        self.readStates = readStates
        self.hasMoreOlder = hasMoreOlder
        self.oldestCursor = oldestCursor
    }
}

public struct ChatBackfillPage: Equatable, Sendable {
    public let messages: [ChatMessage]
    public let needsReset: Bool

    public init(messages: [ChatMessage], needsReset: Bool) {
        self.messages = messages
        self.needsReset = needsReset
    }
}

public struct ChatUnreadSummary: Equatable, Sendable {
    public let count: Int
    public let oldestUnreadAt: Date?
    public let latestUnreadMessageId: String?

    public init(count: Int, oldestUnreadAt: Date?, latestUnreadMessageId: String?) {
        self.count = count
        self.oldestUnreadAt = oldestUnreadAt
        self.latestUnreadMessageId = latestUnreadMessageId
    }
}
