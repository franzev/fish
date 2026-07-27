import ChatCore
import Foundation

/// The exact payload `ChatEvent.hydrateWindow` takes, persisted as-is so a
/// cached transcript can replay through the same reducer path a network
/// fetch does. Not a general-purpose transcript model.
public struct ChatCachedWindow: Codable, Sendable, Equatable {
    public let messages: [ChatMessageState]
    public let readStates: [ChatReadState]
    public let hasMoreOlder: Bool
    public let oldestCursor: ChatMessageCursor?

    public init(
        messages: [ChatMessageState],
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
