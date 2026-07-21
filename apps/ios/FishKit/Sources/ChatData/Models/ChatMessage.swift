import ChatCore
import Foundation

public struct ChatReaction: Equatable, Sendable, Codable {
    public let emoji: String
    public let count: Int
    public let byMe: Bool

    public init(emoji: String, count: Int, byMe: Bool) {
        self.emoji = emoji
        self.count = count
        self.byMe = byMe
    }
}

public struct ChatLinkPreview: Equatable, Sendable, Codable {
    public let url: URL
    public let hostname: String
    public let title: String?
    public let description: String?
    public let siteName: String?

    public init(
        url: URL,
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

    public var coreState: ChatStateLinkPreview {
        ChatStateLinkPreview(
            url: url.absoluteString,
            hostname: hostname,
            title: title,
            description: description,
            siteName: siteName
        )
    }
}

public struct ChatMessage: Identifiable, Equatable, Sendable {
    public let id: String
    public let conversationId: String
    public let senderId: String
    public let senderRole: String
    public let senderDisplayName: String?
    public let body: String
    public let linkPreview: ChatLinkPreview?
    public let clientRequestId: String
    public let createdAt: Date
    public let editedAt: Date?
    public let deletedAt: Date?
    public let replyToMessageId: String?
    public let gif: ChatGif?
    public let stickerId: String?
    public let reactions: [ChatReaction]
    public let attachments: [ChatAttachment]

    public init(
        id: String,
        conversationId: String,
        senderId: String,
        senderRole: String,
        senderDisplayName: String? = nil,
        body: String,
        linkPreview: ChatLinkPreview? = nil,
        clientRequestId: String? = nil,
        createdAt: Date,
        editedAt: Date? = nil,
        deletedAt: Date? = nil,
        replyToMessageId: String? = nil,
        gif: ChatGif? = nil,
        stickerId: String? = nil,
        reactions: [ChatReaction] = [],
        attachments: [ChatAttachment] = []
    ) {
        self.id = id
        self.conversationId = conversationId
        self.senderId = senderId
        self.senderRole = senderRole
        self.senderDisplayName = senderDisplayName
        self.body = body
        self.linkPreview = linkPreview
        self.clientRequestId = clientRequestId ?? id
        self.createdAt = createdAt
        self.editedAt = editedAt
        self.deletedAt = deletedAt
        self.replyToMessageId = replyToMessageId
        self.gif = gif
        self.stickerId = stickerId
        self.reactions = reactions
        self.attachments = attachments
    }

    public func enriched(
        displayName: String? = nil,
        gif: ChatGif? = nil,
        linkPreview: ChatLinkPreview? = nil,
        reactions: [ChatReaction]? = nil,
        attachments: [ChatAttachment]? = nil
    ) -> Self {
        Self(
            id: id,
            conversationId: conversationId,
            senderId: senderId,
            senderRole: senderRole,
            senderDisplayName: displayName ?? senderDisplayName,
            body: body,
            linkPreview: linkPreview ?? self.linkPreview,
            clientRequestId: clientRequestId,
            createdAt: createdAt,
            editedAt: editedAt,
            deletedAt: deletedAt,
            replyToMessageId: replyToMessageId,
            gif: gif ?? self.gif,
            stickerId: stickerId,
            reactions: reactions ?? self.reactions,
            attachments: attachments ?? self.attachments
        )
    }

    public var coreState: ChatMessageState {
        ChatMessageState(
            id: id,
            conversationId: conversationId,
            senderId: senderId,
            senderRole: ChatUserRole(rawValue: senderRole) ?? .client,
            senderDisplayName: senderDisplayName,
            body: body,
            gif: gif.map {
                ChatStateGif(
                    provider: $0.provider.rawValue,
                    providerId: $0.providerId,
                    title: $0.title,
                    description: $0.description,
                    sourceUrl: $0.sourceUrl.absoluteString,
                    posterUrl: $0.posterUrl.absoluteString,
                    previewUrl: $0.previewUrl.absoluteString,
                    mediaUrl: $0.mediaUrl.absoluteString,
                    width: $0.width,
                    height: $0.height
                )
            },
            linkPreview: linkPreview?.coreState,
            stickerId: stickerId,
            attachments: attachments.map(\.coreState),
            images: attachments.map(\.coreState),
            clientRequestId: clientRequestId,
            createdAt: ChatTimestamp.string(createdAt),
            editedAt: editedAt.map(ChatTimestamp.string),
            deletedAt: deletedAt.map(ChatTimestamp.string),
            replyToMessageId: replyToMessageId,
            reactions: reactions.map {
                ChatReactionState(emoji: $0.emoji, count: $0.count, byMe: $0.byMe)
            },
            localStatus: .sent
        )
    }
}

public extension ChatAttachment {
    var coreState: ChatStateAttachment {
        ChatStateAttachment(
            id: id,
            status: status,
            kind: kind.rawValue,
            originalName: originalName,
            mimeType: mimeType,
            byteSize: byteSize,
            width: width,
            height: height,
            thumbnailPath: thumbnailPath,
            displayPath: displayPath,
            thumbnailUrl: thumbnailUrl?.absoluteString,
            displayUrl: displayUrl?.absoluteString
        )
    }
}

public struct SendChatMessageRequest: Equatable, Sendable, Codable {
    public let conversationId: String
    public let body: String
    public let clientRequestId: String
    public let replyToMessageId: String?
    public let attachmentIds: [String]
    public let gif: ChatGif?
    public let stickerId: String?

    public init(
        conversationId: String,
        body: String,
        clientRequestId: String,
        replyToMessageId: String? = nil,
        attachmentIds: [String] = [],
        gif: ChatGif? = nil,
        stickerId: String? = nil
    ) {
        self.conversationId = conversationId
        self.body = body
        self.clientRequestId = clientRequestId
        self.replyToMessageId = replyToMessageId
        self.attachmentIds = attachmentIds
        self.gif = gif
        self.stickerId = stickerId
    }
}

public enum ChatTimestamp {
    public static func string(_ date: Date) -> String {
        formatter(fractionalSeconds: true).string(from: date)
    }

    public static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        return formatter(fractionalSeconds: true).date(from: value)
            ?? formatter(fractionalSeconds: false).date(from: value)
    }

    private static func formatter(fractionalSeconds: Bool) -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = fractionalSeconds
            ? [.withInternetDateTime, .withFractionalSeconds]
            : [.withInternetDateTime]
        return formatter
    }
}
