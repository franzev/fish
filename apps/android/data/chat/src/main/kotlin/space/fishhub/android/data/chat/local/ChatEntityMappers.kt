package space.fishhub.android.data.chat.local

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatReaction
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.AttachmentDelivery
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val mediaJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = true
}

internal fun MessageEntity.toDomain(
    attachments: List<MessageAttachmentEntity> = emptyList(),
    deliveries: Map<String, AttachmentDelivery> = emptyMap(),
): ChatMessage = ChatMessage(
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
    attachments = attachments
        .sortedWith(compareBy(MessageAttachmentEntity::position, MessageAttachmentEntity::id))
        .map { it.toDomain(deliveries[it.id]) },
    clientRequestId = clientRequestId,
    createdAt = createdAt,
    editedAt = editedAt,
    deletedAt = deletedAt,
    replyToMessageId = replyToMessageId,
    reactions = reactionsJson?.let { encoded ->
        runCatching { mediaJson.decodeFromString<List<ChatReaction>>(encoded) }.getOrNull()
    }.orEmpty(),
    localStatus = localStatus?.toLocalStatus(),
    failureReason = failureReason,
)

internal fun MessageAttachmentEntity.toDomain(delivery: AttachmentDelivery? = null): ChatAttachment =
    ChatAttachment(
        id = id,
        position = position,
        kind = kind.toAttachmentKind(available),
        available = available,
        originalName = originalName,
        mimeType = storedMimeType,
        byteSize = storedByteSize,
        width = width,
        height = height,
        thumbnailPath = thumbnailPath,
        displayPath = displayPath,
        thumbnailUrl = delivery?.thumbnailUrl,
        displayUrl = delivery?.displayUrl,
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
    reactionsJson = reactions.takeIf(List<ChatReaction>::isNotEmpty)?.let(mediaJson::encodeToString),
    localStatus = localStatus?.wireValue,
    failureReason = failureReason,
)

internal fun ChatAttachment.toEntity(
    messageId: String,
    conversationId: String,
): MessageAttachmentEntity = MessageAttachmentEntity(
    id = id,
    messageId = messageId,
    conversationId = conversationId,
    position = position,
    kind = when (kind) {
        ChatAttachmentKind.Image -> "image"
        ChatAttachmentKind.File -> "file"
        ChatAttachmentKind.Unavailable -> "unavailable"
    },
    available = available,
    originalName = originalName,
    storedMimeType = mimeType,
    storedByteSize = byteSize,
    width = width,
    height = height,
    thumbnailPath = thumbnailPath,
    displayPath = displayPath,
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

private fun String.toAttachmentKind(available: Boolean): ChatAttachmentKind = when {
    !available -> ChatAttachmentKind.Unavailable
    this == "image" -> ChatAttachmentKind.Image
    this == "file" -> ChatAttachmentKind.File
    else -> ChatAttachmentKind.Unavailable
}
