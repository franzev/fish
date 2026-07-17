package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatGif
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
internal data class ProfileDto(
    val id: String,
    val role: String,
    @SerialName("display_name") val displayName: String,
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
