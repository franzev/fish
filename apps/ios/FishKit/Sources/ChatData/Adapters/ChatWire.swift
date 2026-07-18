import ChatCore
import Foundation

struct ChatMessageWire: Decodable {
    let id: String
    let conversationId: String
    let senderId: String
    let senderRole: String
    let senderDisplayName: String?
    let body: String
    let clientRequestId: String?
    let createdAt: Date
    let editedAt: Date?
    let deletedAt: Date?
    let replyToMessageId: String?
    let stickerId: String?
    let reactions: [ChatReactionWire]?
    let images: [ChatAttachmentWire]?
    let gif: ChatGifWire?

    enum CodingKeys: String, CodingKey {
        case id, body, reactions, images, gif
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case senderRole = "sender_role"
        case senderDisplayName = "sender_display_name"
        case clientRequestId = "client_request_id"
        case createdAt = "created_at"
        case editedAt = "edited_at"
        case deletedAt = "deleted_at"
        case replyToMessageId = "reply_to_message_id"
        case stickerId = "sticker_id"
    }

    var domain: ChatMessage {
        ChatMessage(
            id: id,
            conversationId: conversationId,
            senderId: senderId,
            senderRole: senderRole,
            senderDisplayName: senderDisplayName,
            body: body,
            clientRequestId: clientRequestId,
            createdAt: createdAt,
            editedAt: editedAt,
            deletedAt: deletedAt,
            replyToMessageId: replyToMessageId,
            gif: gif?.domain,
            stickerId: stickerId?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            reactions: reactions?.map(\.domain) ?? [],
            attachments: images?.map(\.domain) ?? []
        )
    }
}

struct ChatReactionWire: Decodable {
    let emoji: String
    let count: Int
    let byMe: Bool

    enum CodingKeys: String, CodingKey { case emoji, count, byMe = "by_me" }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        emoji = try values.decode(String.self, forKey: .emoji)
        count = try values.decode(Int.self, forKey: .count)
        byMe = try values.decodeIfPresent(Bool.self, forKey: .byMe) ?? false
    }

    var domain: ChatReaction { ChatReaction(emoji: emoji, count: count, byMe: byMe) }
}

struct ChatGifWire: Decodable {
    let messageId: String?
    let provider: ChatGifProvider
    let providerId: String
    let title: String
    let description: String
    let sourceUrl: URL
    let posterUrl: URL
    let previewUrl: URL
    let mediaUrl: URL
    let width: Int
    let height: Int

    enum CodingKeys: String, CodingKey {
        case provider, title, description, width, height
        case messageId = "message_id"
        case providerId = "provider_content_id"
        case sourceUrl = "source_url"
        case posterUrl = "poster_url"
        case previewUrl = "preview_url"
        case mediaUrl = "media_url"
    }

    var domain: ChatGif {
        ChatGif(
            provider: provider,
            providerId: providerId,
            title: title,
            description: description,
            sourceUrl: sourceUrl,
            posterUrl: posterUrl,
            previewUrl: previewUrl,
            mediaUrl: mediaUrl,
            width: width,
            height: height
        )
    }
}

struct ChatAttachmentWire: Decodable {
    let id: String
    let status: String
    let kind: ChatAttachment.Kind
    let originalName: String
    let mimeType: String?
    let byteSize: Int?
    let width: Int?
    let height: Int?
    let thumbnailPath: String?
    let displayPath: String
    let thumbnailUrl: URL?
    let displayUrl: URL?

    enum CodingKeys: String, CodingKey {
        case id, status, kind, width, height
        case originalName = "original_name"
        case mimeType = "stored_mime_type"
        case byteSize = "stored_byte_size"
        case thumbnailPath = "thumbnail_path"
        case displayPath = "display_path"
        case thumbnailUrl = "thumbnail_url"
        case displayUrl = "display_url"
    }

    var domain: ChatAttachment {
        ChatAttachment(
            id: id,
            status: status,
            kind: kind,
            originalName: originalName,
            mimeType: mimeType,
            byteSize: byteSize,
            width: width,
            height: height,
            thumbnailPath: thumbnailPath,
            displayPath: displayPath,
            thumbnailUrl: thumbnailUrl,
            displayUrl: displayUrl
        )
    }
}

struct ChatReadStateWire: Decodable {
    let userId: String
    let lastDeliveredMessageId: String?
    let deliveredAt: String?
    let lastReadMessageId: String?
    let readAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case lastDeliveredMessageId = "last_delivered_message_id"
        case deliveredAt = "delivered_at"
        case lastReadMessageId = "last_read_message_id"
        case readAt = "read_at"
    }

    var domain: ChatReadState {
        ChatReadState(
            userId: userId,
            lastDeliveredMessageId: lastDeliveredMessageId,
            deliveredAt: deliveredAt,
            lastReadMessageId: lastReadMessageId,
            readAt: readAt
        )
    }
}

enum ChatWireDecoder {
    static func make() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            guard let date = ChatTimestamp.date(value) else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Invalid ISO-8601 date"
                )
            }
            return date
        }
        return decoder
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
