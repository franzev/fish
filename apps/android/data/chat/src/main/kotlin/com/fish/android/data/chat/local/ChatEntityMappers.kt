package com.fish.android.data.chat.local

import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatReadState
import com.fish.android.data.chat.model.LocalMessageStatus
import com.fish.android.data.chat.model.UserRole
import com.fish.android.data.chat.model.ChatGif
import com.fish.android.data.chat.AuthorizedConversation
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val mediaJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = true
}

internal fun MessageEntity.toDomain(): ChatMessage = ChatMessage(
    id = id,
    conversationId = conversationId,
    senderId = senderId,
    senderRole = senderRole.toUserRole(),
    senderDisplayName = senderDisplayName,
    body = body,
    gif = gifJson?.takeUnless { it == UnavailableGifJson }?.let { encoded ->
        runCatching { mediaJson.decodeFromString<ChatGif>(encoded) }.getOrNull()
    },
    gifUnavailable = gifJson == UnavailableGifJson,
    stickerId = stickerId,
    clientRequestId = clientRequestId,
    createdAt = createdAt,
    editedAt = editedAt,
    deletedAt = deletedAt,
    replyToMessageId = replyToMessageId,
    localStatus = localStatus?.toLocalStatus(),
    failureReason = failureReason,
)

internal fun ChatMessage.toEntity(): MessageEntity = MessageEntity(
    id = id,
    conversationId = conversationId,
    senderId = senderId,
    senderRole = senderRole.wireValue,
    senderDisplayName = senderDisplayName,
    body = body,
    stickerId = stickerId,
    gifJson = gif?.let { mediaJson.encodeToString(it) }
        ?: UnavailableGifJson.takeIf { gifUnavailable },
    clientRequestId = clientRequestId,
    createdAt = createdAt,
    editedAt = editedAt,
    deletedAt = deletedAt,
    replyToMessageId = replyToMessageId,
    localStatus = localStatus?.wireValue,
    failureReason = failureReason,
)

internal fun ReadStateEntity.toDomain(): ChatReadState = ChatReadState(
    userId = userId,
    lastDeliveredMessageId = lastDeliveredMessageId,
    deliveredAt = deliveredAt,
    lastReadMessageId = lastReadMessageId,
    readAt = readAt,
)

internal fun ChatReadState.toEntity(conversationId: String): ReadStateEntity = ReadStateEntity(
    conversationId = conversationId,
    userId = userId,
    lastDeliveredMessageId = lastDeliveredMessageId,
    deliveredAt = deliveredAt,
    lastReadMessageId = lastReadMessageId,
    readAt = readAt,
)

internal fun AuthorizedConversation.toEntity(): ConversationEntity = ConversationEntity(
    conversationId = conversationId,
    currentUserId = currentUserId,
    currentUserRole = currentUserRole.wireValue,
    currentUserDisplayName = currentUserDisplayName,
    participantId = participantId,
    participantRole = participantRole.wireValue,
    participantDisplayName = participantDisplayName,
    latestMessageText = latestMessageText,
    latestMessageCreatedAt = latestMessageCreatedAt,
    unreadCount = unreadCount,
)

internal fun ConversationEntity.toDomain(): AuthorizedConversation = AuthorizedConversation(
    conversationId = conversationId,
    currentUserId = currentUserId,
    currentUserRole = currentUserRole.toUserRole(),
    currentUserDisplayName = currentUserDisplayName,
    participantId = participantId,
    participantRole = participantRole.toUserRole(),
    participantDisplayName = participantDisplayName,
    latestMessageText = latestMessageText,
    latestMessageCreatedAt = latestMessageCreatedAt,
    unreadCount = unreadCount,
)

internal val UserRole.wireValue: String
    get() = if (this == UserRole.Client) "client" else "coach"

internal fun String.toUserRole(): UserRole = if (this == "coach") UserRole.Coach else UserRole.Client

private val LocalMessageStatus.wireValue: String
    get() = when (this) {
        LocalMessageStatus.Pending -> "pending"
        LocalMessageStatus.Sending -> "sending"
        LocalMessageStatus.Sent -> "sent"
        LocalMessageStatus.Failed -> "failed"
    }

private fun String.toLocalStatus(): LocalMessageStatus = when (this) {
    "pending" -> LocalMessageStatus.Pending
    "sending" -> LocalMessageStatus.Sending
    "failed" -> LocalMessageStatus.Failed
    else -> LocalMessageStatus.Sent
}

private const val UnavailableGifJson = "{\"unavailable\":true}"
