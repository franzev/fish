import Foundation

public enum ChatEvent: Sendable, Equatable, Codable {
    case hydrateConversation(conversationId: String, messages: [ChatMessageState], readStates: [ChatReadState])
    case draftChanged(conversationId: String, draft: String)
    case sendOptimisticMessage(message: ChatMessageState)
    case confirmSentMessage(message: ChatMessageState, localRequestId: String?)
    case markMessageFailed(conversationId: String, clientRequestId: String, reason: String?)
    case mergeRemoteMessage(message: ChatMessageState, localRequestId: String?)
    case mergeReadState(conversationId: String, readState: ChatReadState)
    case composerGifSelected(conversationId: String, gif: ChatStateGif, query: String)
    case composerStickerSelected(conversationId: String, stickerId: String)
    case composerSelectionCleared(conversationId: String)
    case deleteRequested(conversationId: String, messageId: String, at: String)
    case deleteFailed(conversationId: String, messageId: String)
    case setReplyTarget(conversationId: String, messageId: String?)
    case setEditTarget(conversationId: String, messageId: String?)
    case setRealtimeStatus(conversationId: String, status: RealtimeConnectionState)
    case clearComposer(conversationId: String)
    case hydrateWindow(
        conversationId: String,
        messages: [ChatMessageState],
        readStates: [ChatReadState],
        hasMoreOlder: Bool,
        oldestCursor: ChatMessageCursor?
    )
    case olderMessagesRequested(conversationId: String)
    case olderPageLoaded(
        conversationId: String,
        messages: [ChatMessageState],
        hasMoreOlder: Bool,
        oldestCursor: ChatMessageCursor?
    )
    case olderPageLoadFailed(conversationId: String)

    private enum CodingKeys: String, CodingKey {
        case type, conversationId, messages, readStates, draft, message
        case localRequestId, clientRequestId, reason, readState, messageId
        case status, hasMoreOlder, oldestCursor, gif, query, stickerId, at
    }

    private enum Kind: String, Codable {
        case hydrateConversation, draftChanged, sendOptimisticMessage
        case confirmSentMessage, markMessageFailed, mergeRemoteMessage
        case mergeReadState, composerGifSelected, composerStickerSelected
        case composerSelectionCleared, deleteRequested, deleteFailed
        case setReplyTarget, setEditTarget, setRealtimeStatus
        case clearComposer, hydrateWindow, olderMessagesRequested
        case olderPageLoaded, olderPageLoadFailed
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let type = try values.decode(Kind.self, forKey: .type)
        switch type {
        case .hydrateConversation:
            self = try .hydrateConversation(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messages: values.decode([ChatMessageState].self, forKey: .messages),
                readStates: values.decode([ChatReadState].self, forKey: .readStates)
            )
        case .draftChanged:
            self = try .draftChanged(
                conversationId: values.decode(String.self, forKey: .conversationId),
                draft: values.decode(String.self, forKey: .draft)
            )
        case .sendOptimisticMessage:
            self = try .sendOptimisticMessage(message: values.decode(ChatMessageState.self, forKey: .message))
        case .confirmSentMessage:
            self = try .confirmSentMessage(
                message: values.decode(ChatMessageState.self, forKey: .message),
                localRequestId: values.decodeIfPresent(String.self, forKey: .localRequestId)
            )
        case .markMessageFailed:
            self = try .markMessageFailed(
                conversationId: values.decode(String.self, forKey: .conversationId),
                clientRequestId: values.decode(String.self, forKey: .clientRequestId),
                reason: values.decodeIfPresent(String.self, forKey: .reason)
            )
        case .mergeRemoteMessage:
            self = try .mergeRemoteMessage(
                message: values.decode(ChatMessageState.self, forKey: .message),
                localRequestId: values.decodeIfPresent(String.self, forKey: .localRequestId)
            )
        case .mergeReadState:
            self = try .mergeReadState(
                conversationId: values.decode(String.self, forKey: .conversationId),
                readState: values.decode(ChatReadState.self, forKey: .readState)
            )
        case .composerGifSelected:
            self = try .composerGifSelected(
                conversationId: values.decode(String.self, forKey: .conversationId),
                gif: values.decode(ChatStateGif.self, forKey: .gif),
                query: values.decode(String.self, forKey: .query)
            )
        case .composerStickerSelected:
            self = try .composerStickerSelected(
                conversationId: values.decode(String.self, forKey: .conversationId),
                stickerId: values.decode(String.self, forKey: .stickerId)
            )
        case .composerSelectionCleared:
            self = try .composerSelectionCleared(
                conversationId: values.decode(String.self, forKey: .conversationId)
            )
        case .deleteRequested:
            self = try .deleteRequested(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messageId: values.decode(String.self, forKey: .messageId),
                at: values.decode(String.self, forKey: .at)
            )
        case .deleteFailed:
            self = try .deleteFailed(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messageId: values.decode(String.self, forKey: .messageId)
            )
        case .setReplyTarget:
            self = try .setReplyTarget(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messageId: values.decodeIfPresent(String.self, forKey: .messageId)
            )
        case .setEditTarget:
            self = try .setEditTarget(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messageId: values.decodeIfPresent(String.self, forKey: .messageId)
            )
        case .setRealtimeStatus:
            self = try .setRealtimeStatus(
                conversationId: values.decode(String.self, forKey: .conversationId),
                status: values.decode(RealtimeConnectionState.self, forKey: .status)
            )
        case .clearComposer:
            self = try .clearComposer(conversationId: values.decode(String.self, forKey: .conversationId))
        case .hydrateWindow:
            self = try .hydrateWindow(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messages: values.decode([ChatMessageState].self, forKey: .messages),
                readStates: values.decode([ChatReadState].self, forKey: .readStates),
                hasMoreOlder: values.decode(Bool.self, forKey: .hasMoreOlder),
                oldestCursor: values.decodeIfPresent(ChatMessageCursor.self, forKey: .oldestCursor)
            )
        case .olderMessagesRequested:
            self = try .olderMessagesRequested(conversationId: values.decode(String.self, forKey: .conversationId))
        case .olderPageLoaded:
            self = try .olderPageLoaded(
                conversationId: values.decode(String.self, forKey: .conversationId),
                messages: values.decode([ChatMessageState].self, forKey: .messages),
                hasMoreOlder: values.decode(Bool.self, forKey: .hasMoreOlder),
                oldestCursor: values.decodeIfPresent(ChatMessageCursor.self, forKey: .oldestCursor)
            )
        case .olderPageLoadFailed:
            self = try .olderPageLoadFailed(conversationId: values.decode(String.self, forKey: .conversationId))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .hydrateConversation(let id, let messages, let reads):
            try values.encode(Kind.hydrateConversation, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(messages, forKey: .messages)
            try values.encode(reads, forKey: .readStates)
        case .draftChanged(let id, let draft):
            try values.encode(Kind.draftChanged, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(draft, forKey: .draft)
        case .sendOptimisticMessage(let message):
            try values.encode(Kind.sendOptimisticMessage, forKey: .type)
            try values.encode(message, forKey: .message)
        case .confirmSentMessage(let message, let requestId):
            try values.encode(Kind.confirmSentMessage, forKey: .type)
            try values.encode(message, forKey: .message)
            try values.encodeIfPresent(requestId, forKey: .localRequestId)
        case .markMessageFailed(let id, let requestId, let reason):
            try values.encode(Kind.markMessageFailed, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(requestId, forKey: .clientRequestId)
            try values.encodeIfPresent(reason, forKey: .reason)
        case .mergeRemoteMessage(let message, let requestId):
            try values.encode(Kind.mergeRemoteMessage, forKey: .type)
            try values.encode(message, forKey: .message)
            try values.encodeIfPresent(requestId, forKey: .localRequestId)
        case .mergeReadState(let id, let readState):
            try values.encode(Kind.mergeReadState, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(readState, forKey: .readState)
        case .composerGifSelected(let id, let gif, let query):
            try values.encode(Kind.composerGifSelected, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(gif, forKey: .gif)
            try values.encode(query, forKey: .query)
        case .composerStickerSelected(let id, let stickerId):
            try values.encode(Kind.composerStickerSelected, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(stickerId, forKey: .stickerId)
        case .composerSelectionCleared(let id):
            try values.encode(Kind.composerSelectionCleared, forKey: .type)
            try values.encode(id, forKey: .conversationId)
        case .deleteRequested(let id, let messageId, let at):
            try values.encode(Kind.deleteRequested, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(messageId, forKey: .messageId)
            try values.encode(at, forKey: .at)
        case .deleteFailed(let id, let messageId):
            try values.encode(Kind.deleteFailed, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(messageId, forKey: .messageId)
        case .setReplyTarget(let id, let messageId):
            try values.encode(Kind.setReplyTarget, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encodeIfPresent(messageId, forKey: .messageId)
        case .setEditTarget(let id, let messageId):
            try values.encode(Kind.setEditTarget, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encodeIfPresent(messageId, forKey: .messageId)
        case .setRealtimeStatus(let id, let status):
            try values.encode(Kind.setRealtimeStatus, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(status, forKey: .status)
        case .clearComposer(let id):
            try values.encode(Kind.clearComposer, forKey: .type)
            try values.encode(id, forKey: .conversationId)
        case .hydrateWindow(let id, let messages, let reads, let hasMore, let cursor):
            try values.encode(Kind.hydrateWindow, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(messages, forKey: .messages)
            try values.encode(reads, forKey: .readStates)
            try values.encode(hasMore, forKey: .hasMoreOlder)
            try values.encodeIfPresent(cursor, forKey: .oldestCursor)
        case .olderMessagesRequested(let id):
            try values.encode(Kind.olderMessagesRequested, forKey: .type)
            try values.encode(id, forKey: .conversationId)
        case .olderPageLoaded(let id, let messages, let hasMore, let cursor):
            try values.encode(Kind.olderPageLoaded, forKey: .type)
            try values.encode(id, forKey: .conversationId)
            try values.encode(messages, forKey: .messages)
            try values.encode(hasMore, forKey: .hasMoreOlder)
            try values.encodeIfPresent(cursor, forKey: .oldestCursor)
        case .olderPageLoadFailed(let id):
            try values.encode(Kind.olderPageLoadFailed, forKey: .type)
            try values.encode(id, forKey: .conversationId)
        }
    }
}
