package space.fishhub.android.messaging

import java.time.Instant
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.model.ChatMessage

/** Waits out [ChatAuthState.Loading]; cold-started processes settle asynchronously. */
internal suspend fun StateFlow<ChatAuthState>.settled(): ChatAuthState =
    first { it !is ChatAuthState.Loading }

/**
 * Resolves the pushed message's content over the authorized chat-command read
 * (an Edge Function invoke plus its hydration queries — several sequential
 * round trips, bounded by the caller's timeout). Payloads stay content-free;
 * any failure falls back to the generic notification line.
 */
internal object ChatPushContentResolver {
    suspend fun resolve(push: ChatPushMessage, repository: ChatRepository): ChatNotificationMessage? =
        resolve(
            push,
            isSignedIn = { repository.authState.settled() is ChatAuthState.SignedIn },
            refreshMessages = repository::refreshMessages,
        )

    internal suspend fun resolve(
        push: ChatPushMessage,
        isSignedIn: suspend () -> Boolean,
        refreshMessages: suspend (String, List<String>) -> ChatResult<List<ChatMessage>>,
    ): ChatNotificationMessage? {
        if (!isSignedIn()) return null
        val result = refreshMessages(push.conversationId, listOf(push.messageId))
        val message = (result as? ChatResult.Success)?.value
            ?.firstOrNull { it.id == push.messageId && it.conversationId == push.conversationId }
            ?: return null
        if (message.deletedAt != null) return null
        val text = message.body.takeIf(String::isNotBlank) ?: return null
        return ChatNotificationMessage(
            text = text,
            sentAtMillis = runCatching { Instant.parse(message.createdAt).toEpochMilli() }.getOrNull(),
        )
    }
}
