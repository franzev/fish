import ChatCore
import Foundation

public struct ChatStateVector: Decodable, Sendable {
    public struct ExpectedSelectors: Decodable, Sendable {
        public struct UnreadCount: Decodable, Sendable {
            public let conversationId: String
            public let currentUserId: String
            public let readStateUserId: String
            public let expected: Int
        }
        public struct Snippet: Decodable, Sendable {
            public let conversationId: String
            public let messageId: String
            public let expected: String
        }
        public struct OutgoingStatus: Decodable, Sendable {
            public let conversationId: String
            public let messageId: String
            public let readStateUserId: String
            public let expected: OutgoingMessageStatus
        }
        public struct Reply: Decodable, Sendable {
            public let conversationId: String
            public let messageId: String
            public let currentUserId: String
            public let participantName: String
            public let currentUserName: String
            public let expected: ReplyPreview
        }

        public let unreadCount: UnreadCount?
        public let snippet: Snippet?
        public let outgoingStatus: OutgoingStatus?
        public let replyPreview: Reply?
    }

    public let name: String
    public let initialState: ChatState
    public let events: [ChatEvent]
    public let expectedState: ChatState?
    public let expectedSelectors: ExpectedSelectors?
}

public struct ChatMediaMergeVector: Decodable, Sendable {
    public let name: String
    public let existing: ChatMessageState
    public let incoming: ChatMessageState
    public let expectedGifProviderId: String?
    public let expectedStickerId: String?
    public let expectedAttachmentIds: [String]
}

public enum ChatStateVectors {
    public static func load() throws -> [ChatStateVector] {
        try JSONDecoder().decode([ChatStateVector].self, from: rawJSON("chat-state-vectors"))
    }

    public static func loadMediaMerge() throws -> [ChatMediaMergeVector] {
        try JSONDecoder().decode(
            [ChatMediaMergeVector].self,
            from: rawJSON("chat-media-merge-vectors")
        )
    }

    public static func rawJSON(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try Data(contentsOf: url)
    }
}
