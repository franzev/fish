package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatGif
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
internal data class ProfileDto(
    val id: String,
    val role: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null,
)

@Serializable
internal data class ConversationMemberProfileDto(
    @SerialName("conversation_id") val conversationId: String,
    val id: String,
    val role: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null,
)

@Serializable
internal data class ResolveAvatarUrlsRequest(
    val action: String = "resolve-urls",
    val profileIds: List<String>,
    val variant: String = "thumbnail",
)

@Serializable
internal data class ResolveAvatarUrlsResponse(
    val items: List<AvatarUrlDto> = emptyList(),
)

@Serializable
internal data class AvatarUrlDto(
    val profileId: String,
    val url: String,
    val expiresAt: String? = null,
)

@Serializable
internal data class FriendCommandRequest(
    val action: String,
    val targetId: String,
)

@Serializable
internal data class BlockedPersonDto(
    @SerialName("user_id") val userId: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    val username: String? = null,
)

@Serializable
internal data class ConversationPreviewDto(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("participant_id") val participantId: String,
    @SerialName("participant_role") val participantRole: String,
    @SerialName("participant_display_name") val participantDisplayName: String,
    @SerialName("latest_message_sender_id") val latestMessageSenderId: String? = null,
    @SerialName("latest_message_text") val latestMessageText: String? = null,
    @SerialName("latest_message_created_at") val latestMessageCreatedAt: String? = null,
    @SerialName("unread_count") val unreadCount: Int = 0,
)

@Serializable
internal data class MessageDto(
    val id: String,
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("sender_id") val senderId: String,
    @SerialName("sender_role") val senderRole: String,
    val body: String,
    @SerialName("sticker_id") val stickerId: String? = null,
    @SerialName("client_request_id") val clientRequestId: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("edited_at") val editedAt: String? = null,
    @SerialName("deleted_at") val deletedAt: String? = null,
    @SerialName("reply_to_message_id") val replyToMessageId: String? = null,
    val reactions: List<ReactionDto> = emptyList(),
    @SerialName("message_attachments") val attachments: List<MessageAttachmentDto> = emptyList(),
)

@Serializable
internal data class ReactionDto(
    val emoji: String,
    val count: Int = 0,
    @SerialName("by_me") val byMe: Boolean = false,
)

@Serializable
internal data class ReactionSummaryDto(
    @SerialName("message_id") val messageId: String,
    val emoji: String,
    val count: Int,
    @SerialName("by_me") val byMe: Boolean,
    @SerialName("first_created_at") val firstCreatedAt: String,
)

@Serializable
internal data class ReactionChangeDto(
    @SerialName("message_id") val messageId: String,
)

@Serializable
internal data class MessageAttachmentDto(
    val id: String? = null,
    @SerialName("message_id") val messageId: String? = null,
    @SerialName("conversation_id") val conversationId: String? = null,
    val position: Int? = null,
    val kind: String? = null,
    val status: String? = null,
    @SerialName("original_name") val originalName: String? = null,
    @SerialName("stored_mime_type") val storedMimeType: String? = null,
    @SerialName("stored_byte_size") val storedByteSize: Long? = null,
    val width: Int? = null,
    val height: Int? = null,
    @SerialName("thumbnail_path") val thumbnailPath: String? = null,
    @SerialName("display_path") val displayPath: String? = null,
    val thumbnailUrl: String? = null,
    val displayUrl: String? = null,
)

@Serializable
internal data class RefreshAttachmentUrlsRequest(
    val action: String = "refresh-attachment-urls",
    val attachmentIds: List<String>,
)

@Serializable
internal data class RefreshAttachmentUrlsResponse(
    val expiresAt: String? = null,
    val attachments: List<AttachmentDeliveryDto> = emptyList(),
)

@Serializable
internal data class AttachmentDeliveryDto(
    val attachmentId: String,
    val thumbnailUrl: String? = null,
    val displayUrl: String? = null,
)

@Serializable
internal data class ReadStateDto(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("user_id") val userId: String,
    @SerialName("last_delivered_message_id") val lastDeliveredMessageId: String? = null,
    @SerialName("delivered_at") val deliveredAt: String? = null,
    @SerialName("last_read_message_id") val lastReadMessageId: String? = null,
    @SerialName("read_at") val readAt: String? = null,
)

@Serializable
internal data class SendMessageRequest(
    val conversationId: String,
    val body: String,
    val clientRequestId: String,
    val gif: ChatGif? = null,
    val stickerId: String? = null,
    val attachmentIds: List<String> = emptyList(),
    val replyToMessageId: String? = null,
)

@Serializable
internal data class EditMessageRequest(
    val action: String = "edit-message",
    val messageId: String,
    val body: String,
)

@Serializable
internal data class DeleteMessageRequest(
    val action: String = "delete-message",
    val messageId: String,
)

@Serializable
internal data class SetReactionRequest(
    val action: String = "set-reaction",
    val messageId: String,
    val emoji: String,
    val active: Boolean,
)

@Serializable
internal data class RefreshMessagesRequest(
    val action: String = "refresh-messages",
    val messageIds: List<String>,
)

@Serializable
internal data class TypingBroadcastDto(
    val userId: String,
    val typing: Boolean,
)

@Serializable
internal data class InitializeAttachmentUploadRequest(
    val action: String = "initialize-upload",
    val conversationId: String,
    val clientUploadId: String,
    val originalName: String,
    val sourceMimeType: String,
    val sourceByteSize: Long,
    val uploadSha256: String,
)

@Serializable
internal data class AttachmentUploadAuthorizationDto(
    val attachmentId: String,
    val status: String = "pending",
    val bucket: String? = null,
    val objectPath: String? = null,
    val uploadToken: String? = null,
    val uploadMimeType: String? = null,
    val tusEndpoint: String? = null,
    val signedUploadUrl: String? = null,
    val expiresAt: String? = null,
)

@Serializable
internal data class CompleteAttachmentUploadRequest(
    val action: String = "complete-upload",
    val attachmentId: String,
)

@Serializable
internal data class CancelAttachmentUploadRequest(
    val action: String = "cancel-upload",
    val attachmentId: String,
)

@Serializable
internal data class CompletedAttachmentUploadResponse(
    val attachment: CompletedAttachmentDto,
)

@Serializable
internal data class CompletedAttachmentDto(
    val id: String,
    val status: String,
)

@Serializable
internal data class MessageGifDto(
    @SerialName("message_id") val messageId: String,
    val provider: String,
    @SerialName("provider_content_id") val providerId: String,
    val title: String,
    val description: String,
    @SerialName("source_url") val sourceUrl: String,
    @SerialName("poster_url") val posterUrl: String,
    @SerialName("preview_url") val previewUrl: String,
    @SerialName("media_url") val mediaUrl: String,
    val width: Int,
    val height: Int,
)

@Serializable
internal data class MarkReadRequest(
    val action: String = "mark-read-state",
    val conversationId: String,
    val lastDeliveredMessageId: String?,
    val lastReadMessageId: String?,
)

@Serializable
internal data class ReportGifRequest(
    val action: String = "report-gif",
    val messageId: String,
)
