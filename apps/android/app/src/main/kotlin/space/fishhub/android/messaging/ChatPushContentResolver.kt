package space.fishhub.android.messaging

import java.time.Instant
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.model.ChatMessage

/**
 * Resolves the pushed message's content over the authorized RLS read.
 * Payloads stay content-free; any failure falls back to the generic
 * notification line.
 */
internal object ChatPushContentResolver {
    suspend fun resolve(push: ChatPushMessage, repository: ChatRepository): ChatNotificationMessage? =
        resolve(
            push,
            isSignedIn = { repository.authState.value is ChatAuthState.SignedIn },
            refreshMessages = repository::refreshMessages,
        )

    internal suspend fun resolve(
        push: ChatPushMessage,
        isSignedIn: () -> Boolean,
        refreshMessages: suspend (String, List<String>) -> ChatResult<List<ChatMessage>>,
    ): ChatNotificationMessage? {
        if (!isSignedIn()) return null
        val result = refreshMessages(push.conversationId, listOf(push.messageId))
        val message = (result as? ChatResult.Success)?.value
            ?.firstOrNull { it.id == push.messageId }
            ?: return null
        if (message.deletedAt != null) return null
        val text = message.body.takeIf(String::isNotBlank) ?: return null
        return ChatNotificationMessage(
            text = text,
            sentAtMillis = runCatching { Instant.parse(message.createdAt).toEpochMilli() }.getOrNull(),
        )
    }
}
