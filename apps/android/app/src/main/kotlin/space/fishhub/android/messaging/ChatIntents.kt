package space.fishhub.android.messaging

import android.content.Intent
import java.net.URI

internal data class ChatDestination(
    val conversationId: String,
    val messageId: String,
)

internal object ChatIntents {
    const val ActionOpenMessage = "space.fishhub.android.action.OPEN_CHAT_MESSAGE"
    const val ExtraConversationId = "space.fishhub.android.extra.CONVERSATION_ID"
    const val ExtraMessageId = "space.fishhub.android.extra.MESSAGE_ID"

    fun destination(intent: Intent?): ChatDestination? = intent?.let {
        destination(
            action = it.action,
            conversationId = it.getStringExtra(ExtraConversationId),
            messageId = it.getStringExtra(ExtraMessageId),
            uri = it.data?.toString(),
        )
    }

    internal fun destination(
        action: String?,
        conversationId: String?,
        messageId: String?,
        uri: String?,
    ): ChatDestination? {
        val explicit = if (action == ActionOpenMessage) {
            ChatDestination(
                conversationId = conversationId.orEmpty(),
                messageId = messageId.orEmpty(),
            )
        } else {
            if (action != Intent.ACTION_VIEW || uri == null) return null
            val data = runCatching { URI(uri) }.getOrNull() ?: return null
            if (data.scheme != "fish" || data.host != "messages") {
                return null
            }
            val segments = data.path.orEmpty().split('/').filter(String::isNotBlank)
            if (segments.size != 2) return null
            ChatDestination(segments[0], segments[1])
        }
        return explicit.takeIf {
            it.conversationId.isNotBlank() && it.messageId.isNotBlank()
        }
    }
}
