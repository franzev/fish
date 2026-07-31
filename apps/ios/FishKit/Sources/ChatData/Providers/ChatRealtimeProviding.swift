import ChatCore
import Foundation

public enum ChatRealtimeWire {
    public static let typingEvent = "typing"
    public static let typingUserIdKey = "userId"
    public static let typingValueKey = "typing"

    public static func messageTopic(_ conversationId: String) -> String {
        "conversation:\(conversationId):messages"
    }
    public static func readTopic(_ conversationId: String) -> String {
        "conversation:\(conversationId):reads"
    }
    public static func reactionTopic(_ conversationId: String) -> String {
        "conversation:\(conversationId):reactions"
    }
    public static func typingTopic(_ conversationId: String) -> String {
        "conversation:\(conversationId):typing"
    }
    public static func pinTopic(_ conversationId: String) -> String {
        "conversation:\(conversationId):pins"
    }
}

public enum ChatRealtimeConnection: Equatable, Sendable {
    case connecting
    case connected
    case disconnected
    case reconnected
}

public enum ChatRealtimeEvent: Equatable, Sendable {
    case messageChanged(ChatMessage)
    case readStateChanged(ChatReadState)
    case reactionsChanged(messageId: String)
    case typingChanged(userId: String, typing: Bool)
    /// `nil` means the conversation's pin was removed. Unlike message and
    /// reaction changes, an unpin is a real row delete, not a soft update.
    case pinChanged(ConversationPin?)
}

public final class ChatRealtimeSubscription: @unchecked Sendable {
    public let events: AsyncStream<ChatRealtimeEvent>
    public let connections: AsyncStream<ChatRealtimeConnection>
    private let typing: @Sendable (Bool) async -> Void
    private let cancellation: @Sendable () -> Void

    public init(
        events: AsyncStream<ChatRealtimeEvent>,
        connections: AsyncStream<ChatRealtimeConnection>,
        sendTyping: @escaping @Sendable (Bool) async -> Void,
        cancel: @escaping @Sendable () -> Void
    ) {
        self.events = events
        self.connections = connections
        typing = sendTyping
        cancellation = cancel
    }

    public func sendTyping(_ value: Bool) async { await typing(value) }
    public func cancel() { cancellation() }

    deinit { cancellation() }
}

public protocol ChatRealtimeProviding: Sendable {
    func subscribe(conversationId: String, currentUserId: String) -> ChatRealtimeSubscription
}
