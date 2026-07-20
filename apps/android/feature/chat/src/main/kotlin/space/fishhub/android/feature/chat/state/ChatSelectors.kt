package space.fishhub.android.feature.chat.state

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import java.time.Instant

val ChatMessageComparator: Comparator<ChatMessage> = Comparator { left, right ->
    val byTime = runCatching {
        Instant.parse(left.createdAt).compareTo(Instant.parse(right.createdAt))
    }.getOrElse {
        left.createdAt.compareTo(right.createdAt)
    }
    if (byTime == 0) left.id.compareTo(right.id) else byTime
}

fun mergeChatMessage(
    current: List<ChatMessage>,
    incoming: ChatMessage,
    localRequestId: String = incoming.clientRequestId,
): List<ChatMessage> {
    val existingIndex = current.indexOfFirst { message ->
        message.id == incoming.id ||
            message.clientRequestId == incoming.clientRequestId ||
            message.clientRequestId == localRequestId
    }
    if (existingIndex == -1) return (current + incoming).sortedWith(ChatMessageComparator)

    val existing = current[existingIndex]
    val merged = incoming.copy(
        senderDisplayName = incoming.senderDisplayName ?: existing.senderDisplayName,
        attachments = incoming.attachments.ifEmpty { existing.attachments },
        gif = incoming.gif ?: existing.gif,
        gifUnavailable = when {
            incoming.gif != null -> false
            incoming.gifUnavailable -> true
            else -> existing.gifUnavailable
        },
        stickerId = incoming.stickerId ?: existing.stickerId,
    )
    if (existing == merged) return current

    return current.toMutableList().apply { this[existingIndex] = merged }
        .sortedWith(ChatMessageComparator)
}

fun mergeReadState(
    current: List<ChatReadState>,
    incoming: ChatReadState,
): List<ChatReadState> {
    val existingIndex = current.indexOfFirst { it.userId == incoming.userId }
    if (existingIndex == -1) return current + incoming
    val existing = current[existingIndex]
    if (isEarlierTimestamp(incoming.deliveredAt, existing.deliveredAt) ||
        isEarlierTimestamp(incoming.readAt, existing.readAt) ||
        existing == incoming
    ) {
        return current
    }
    return current.toMutableList().apply { this[existingIndex] = incoming }
}

private fun isEarlierTimestamp(incoming: String?, current: String?): Boolean {
    if (current == null) return false
    if (incoming == null) return true
    return runCatching { Instant.parse(incoming).isBefore(Instant.parse(current)) }
        .getOrElse { incoming < current }
}

fun outgoingMessageStatus(
    message: ChatMessage,
    messages: List<ChatMessage>,
    participantReadState: ChatReadState?,
): OutgoingMessageStatus = when {
    isAtOrAfterMessage(participantReadState?.lastReadMessageId, message.id, messages) ->
        OutgoingMessageStatus.Read
    isAtOrAfterMessage(participantReadState?.lastDeliveredMessageId, message.id, messages) ->
        OutgoingMessageStatus.Delivered
    else -> OutgoingMessageStatus.Sent
}

private fun isAtOrAfterMessage(
    markerMessageId: String?,
    targetMessageId: String,
    messages: List<ChatMessage>,
): Boolean {
    if (markerMessageId == null) return false
    val targetIndex = messages.indexOfFirst { it.id == targetMessageId }
    val markerIndex = messages.indexOfFirst { it.id == markerMessageId }
    return markerIndex >= 0 && targetIndex >= 0 && markerIndex >= targetIndex
}

fun unreadMessageSummary(
    messages: List<ChatMessage>,
    currentUserId: String,
    currentUserReadState: ChatReadState?,
): UnreadMessageSummary {
    val lastReadIndex = currentUserReadState?.lastReadMessageId?.let { marker ->
        messages.indexOfFirst { it.id == marker }
    } ?: -1
    val unread = messages.filterIndexed { index, message ->
        index > lastReadIndex && message.senderId != currentUserId && message.deletedAt == null
    }
    return UnreadMessageSummary(
        count = unread.size,
        oldestUnreadAt = unread.firstOrNull()?.createdAt,
        latestUnreadMessageId = unread.lastOrNull()?.id,
    )
}

fun countUnreadMessages(
    messages: List<ChatMessage>,
    currentUserId: String,
    currentUserReadState: ChatReadState?,
): Int = unreadMessageSummary(messages, currentUserId, currentUserReadState).count

private const val MaxSnippetCodePoints = 96

fun messageSnippet(message: ChatMessage): String {
    if (message.deletedAt != null) return "Message deleted"
    val body = message.body.trim()
    if (body.isEmpty() && message.stickerId != null) return "Sticker"
    if (body.isEmpty() && message.gif != null) return "GIF"
    if (body.isEmpty() && message.gifUnavailable) return "GIF"
    if (body.isEmpty() && message.attachments.isNotEmpty()) {
        if (message.attachments.size == 1) {
            val attachment = message.attachments.first()
            return when (attachment.kind) {
                ChatAttachmentKind.Image -> "Photo"
                ChatAttachmentKind.File -> if (attachment.mimeType == "audio/mp4") {
                    "Voice message"
                } else {
                    "File"
                }
                ChatAttachmentKind.Unavailable -> "Attachment"
            }
        }
        return if (message.attachments.all { it.kind == ChatAttachmentKind.Image }) {
            "${message.attachments.size} photos"
        } else {
            "${message.attachments.size} attachments"
        }
    }
    val codePoints = body.codePoints().toArray()
    if (codePoints.size <= MaxSnippetCodePoints) return body
    return buildString {
        codePoints.take(MaxSnippetCodePoints - 1).forEach { appendCodePoint(it) }
        append('…')
    }
}

fun replyPreview(
    message: ChatMessage,
    currentUserId: String,
    participantName: String,
    currentUserName: String,
): ReplyPreview = ReplyPreview(
    id = message.id,
    authorName = if (message.senderId == currentUserId) currentUserName else participantName,
    snippet = messageSnippet(message),
)
