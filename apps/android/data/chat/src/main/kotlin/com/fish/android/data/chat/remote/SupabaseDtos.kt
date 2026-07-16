package com.fish.android.data.chat.remote

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
)

@Serializable
internal data class MarkReadRequest(
    val action: String = "mark-read-state",
    val conversationId: String,
    val lastDeliveredMessageId: String?,
    val lastReadMessageId: String?,
)
