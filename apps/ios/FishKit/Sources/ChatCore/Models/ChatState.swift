import Foundation

public typealias ChatConversationId = String
public typealias ChatMessageId = String
public typealias ChatUserId = String

public enum ChatUserRole: String, Codable, Sendable, Equatable {
    case client
    case coach
}

public enum LocalMessageStatus: String, Codable, Sendable, Equatable {
    case pending
    case sending
    case sent
    case failed
}

public enum OutgoingMessageStatus: String, Codable, Sendable, Equatable {
    case sent
    case delivered
    case read
}

public enum RealtimeConnectionState: String, Codable, Sendable, Equatable {
    case idle
    case connecting
    case connected
    case disconnected
}

public struct ChatReactionState: Codable, Sendable, Equatable {
    public var emoji: String
    public var count: Int
    public var byMe: Bool

    public init(emoji: String, count: Int, byMe: Bool) {
        self.emoji = emoji
        self.count = count
        self.byMe = byMe
    }
}

public struct ChatStateGif: Codable, Sendable, Equatable {
    public var provider: String
    public var providerId: String
    public var title: String
    public var description: String
    public var sourceUrl: String
    public var posterUrl: String
    public var previewUrl: String
    public var mediaUrl: String
    public var width: Int
    public var height: Int

    public init(
        provider: String,
        providerId: String,
        title: String,
        description: String,
        sourceUrl: String,
        posterUrl: String,
        previewUrl: String,
        mediaUrl: String,
        width: Int,
        height: Int
    ) {
        self.provider = provider
        self.providerId = providerId
        self.title = title
        self.description = description
        self.sourceUrl = sourceUrl
        self.posterUrl = posterUrl
        self.previewUrl = previewUrl
        self.mediaUrl = mediaUrl
        self.width = width
        self.height = height
    }
}

public struct ChatStateLinkPreview: Codable, Sendable, Equatable {
    public var url: String
    public var hostname: String
    public var title: String?
    public var description: String?
    public var siteName: String?

    public init(
        url: String,
        hostname: String,
        title: String? = nil,
        description: String? = nil,
        siteName: String? = nil
    ) {
        self.url = url
        self.hostname = hostname
        self.title = title
        self.description = description
        self.siteName = siteName
    }
}

public struct ChatStateAttachment: Codable, Sendable, Equatable {
    public var id: String
    public var status: String
    public var kind: String?
    public var originalName: String
    public var mimeType: String?
    public var byteSize: Int?
    public var width: Int?
    public var height: Int?
    public var thumbnailPath: String?
    public var displayPath: String
    public var thumbnailUrl: String?
    public var displayUrl: String?

    public init(
        id: String,
        status: String = "ready",
        kind: String? = nil,
        originalName: String,
        mimeType: String? = nil,
        byteSize: Int? = nil,
        width: Int? = nil,
        height: Int? = nil,
        thumbnailPath: String? = nil,
        displayPath: String,
        thumbnailUrl: String? = nil,
        displayUrl: String? = nil
    ) {
        self.id = id
        self.status = status
        self.kind = kind
        self.originalName = originalName
        self.mimeType = mimeType
        self.byteSize = byteSize
        self.width = width
        self.height = height
        self.thumbnailPath = thumbnailPath
        self.displayPath = displayPath
        self.thumbnailUrl = thumbnailUrl
        self.displayUrl = displayUrl
    }
}

public struct ChatMessageState: Codable, Sendable, Equatable, Identifiable {
    public var id: ChatMessageId
    public var conversationId: ChatConversationId
    public var senderId: ChatUserId
    public var senderRole: ChatUserRole
    public var senderDisplayName: String?
    public var body: String
    public var gif: ChatStateGif?
    public var linkPreview: ChatStateLinkPreview?
    public var stickerId: String?
    public var attachments: [ChatStateAttachment]?
    public var images: [ChatStateAttachment]?
    public var clientRequestId: String
    public var createdAt: String
    public var editedAt: String?
    public var deletedAt: String?
    public var replyToMessageId: ChatMessageId?
    public var reactions: [ChatReactionState]?
    public var localStatus: LocalMessageStatus?
    public var failureReason: String?

    public init(
        id: ChatMessageId,
        conversationId: ChatConversationId,
        senderId: ChatUserId,
        senderRole: ChatUserRole,
        senderDisplayName: String? = nil,
        body: String,
        gif: ChatStateGif? = nil,
        linkPreview: ChatStateLinkPreview? = nil,
        stickerId: String? = nil,
        attachments: [ChatStateAttachment]? = nil,
        images: [ChatStateAttachment]? = nil,
        clientRequestId: String,
        createdAt: String,
        editedAt: String? = nil,
        deletedAt: String? = nil,
        replyToMessageId: ChatMessageId? = nil,
        reactions: [ChatReactionState]? = nil,
        localStatus: LocalMessageStatus? = nil,
        failureReason: String? = nil
    ) {
        self.id = id
        self.conversationId = conversationId
        self.senderId = senderId
        self.senderRole = senderRole
        self.senderDisplayName = senderDisplayName
        self.body = body
        self.gif = gif
        self.linkPreview = linkPreview
        self.stickerId = stickerId
        self.attachments = attachments
        self.images = images
        self.clientRequestId = clientRequestId
        self.createdAt = createdAt
        self.editedAt = editedAt
        self.deletedAt = deletedAt
        self.replyToMessageId = replyToMessageId
        self.reactions = reactions
        self.localStatus = localStatus
        self.failureReason = failureReason
    }
}

public struct ChatReadState: Codable, Sendable, Equatable {
    public var userId: ChatUserId
    public var lastDeliveredMessageId: ChatMessageId?
    public var deliveredAt: String?
    public var lastReadMessageId: ChatMessageId?
    public var readAt: String?

    public init(
        userId: ChatUserId,
        lastDeliveredMessageId: ChatMessageId?,
        deliveredAt: String?,
        lastReadMessageId: ChatMessageId?,
        readAt: String?
    ) {
        self.userId = userId
        self.lastDeliveredMessageId = lastDeliveredMessageId
        self.deliveredAt = deliveredAt
        self.lastReadMessageId = lastReadMessageId
        self.readAt = readAt
    }
}

public struct UnreadMessageSummary: Codable, Sendable, Equatable {
    public var count: Int
    public var oldestUnreadAt: String?
    public var latestUnreadMessageId: String?

    public init(count: Int, oldestUnreadAt: String?, latestUnreadMessageId: String?) {
        self.count = count
        self.oldestUnreadAt = oldestUnreadAt
        self.latestUnreadMessageId = latestUnreadMessageId
    }
}

public struct ChatComposerState: Codable, Sendable, Equatable {
    public var draft: String
    public var replyTargetId: ChatMessageId?
    public var editTargetId: ChatMessageId?
    public var selectedGif: ChatStateGif?
    public var selectedGifQuery: String?
    public var selectedStickerId: String?
    public var selectionRevision: Int?
    public var pendingDeleteByMessageId: [ChatMessageId: String]?

    public init(
        draft: String = "",
        replyTargetId: ChatMessageId? = nil,
        editTargetId: ChatMessageId? = nil,
        selectedGif: ChatStateGif? = nil,
        selectedGifQuery: String? = nil,
        selectedStickerId: String? = nil,
        selectionRevision: Int? = nil,
        pendingDeleteByMessageId: [ChatMessageId: String]? = nil
    ) {
        self.draft = draft
        self.replyTargetId = replyTargetId
        self.editTargetId = editTargetId
        self.selectedGif = selectedGif
        self.selectedGifQuery = selectedGifQuery
        self.selectedStickerId = selectedStickerId
        self.selectionRevision = selectionRevision
        self.pendingDeleteByMessageId = pendingDeleteByMessageId
    }
}

public struct ChatMessageCursor: Codable, Sendable, Equatable {
    public var createdAt: String
    public var id: String

    public init(createdAt: String, id: String) {
        self.createdAt = createdAt
        self.id = id
    }
}

public struct ChatPaginationState: Codable, Sendable, Equatable {
    public var oldestLoadedCursor: ChatMessageCursor?
    public var hasMoreOlder: Bool
    public var isLoadingOlder: Bool
    public var hasLoadError: Bool

    public init(
        oldestLoadedCursor: ChatMessageCursor? = nil,
        hasMoreOlder: Bool = false,
        isLoadingOlder: Bool = false,
        hasLoadError: Bool = false
    ) {
        self.oldestLoadedCursor = oldestLoadedCursor
        self.hasMoreOlder = hasMoreOlder
        self.isLoadingOlder = isLoadingOlder
        self.hasLoadError = hasLoadError
    }
}

public struct ChatRealtimeState: Codable, Sendable, Equatable {
    public var status: RealtimeConnectionState

    public init(status: RealtimeConnectionState = .idle) {
        self.status = status
    }
}

public struct ChatConversationState: Codable, Sendable, Equatable {
    public var conversationId: ChatConversationId
    public var messages: [ChatMessageState]
    public var readStates: [ChatReadState]
    public var composer: ChatComposerState
    public var realtime: ChatRealtimeState
    public var pagination: ChatPaginationState

    public init(
        conversationId: ChatConversationId,
        messages: [ChatMessageState] = [],
        readStates: [ChatReadState] = [],
        composer: ChatComposerState = ChatComposerState(),
        realtime: ChatRealtimeState = ChatRealtimeState(),
        pagination: ChatPaginationState = ChatPaginationState()
    ) {
        self.conversationId = conversationId
        self.messages = messages
        self.readStates = readStates
        self.composer = composer
        self.realtime = realtime
        self.pagination = pagination
    }
}

public struct ChatState: Codable, Sendable, Equatable {
    public var conversations: [ChatConversationId: ChatConversationState]

    public init(conversations: [ChatConversationId: ChatConversationState] = [:]) {
        self.conversations = conversations
    }
}

public struct ReplyPreview: Codable, Sendable, Equatable {
    public var id: ChatMessageId
    public var authorName: String
    public var snippet: String

    public init(id: ChatMessageId, authorName: String, snippet: String) {
        self.id = id
        self.authorName = authorName
        self.snippet = snippet
    }
}
