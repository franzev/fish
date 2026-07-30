package space.fishhub.android.messaging

import android.content.Context
import java.util.UUID

internal data class PendingChatReply(
    val id: String,
    val conversationId: String,
    val body: String,
    val messageId: String? = null,
    val attempts: Int = 0,
)

/** Small durable inbox used by notification actions before chat auth is ready. */
internal object ChatReplyStore {
    private const val PreferencesName = "fish-chat-notification-replies"
    private const val RepliesKey = "replies"
    private val lock = Any()

    fun enqueue(context: Context, conversationId: String, body: String, messageId: String?) {
        synchronized(lock) {
            val replies = load(context).toMutableList()
            replies += PendingChatReply(
                id = UUID.randomUUID().toString().lowercase(),
                conversationId = conversationId,
                body = body,
                messageId = messageId,
            )
            save(context, replies)
        }
    }

    fun pending(context: Context): List<PendingChatReply> = synchronized(lock) { load(context) }

    fun remove(context: Context, id: String) {
        synchronized(lock) { save(context, load(context).filterNot { it.id == id }) }
    }

    fun recordAttempt(context: Context, id: String) {
        synchronized(lock) {
            save(
                context,
                load(context).map { reply ->
                    if (reply.id == id) reply.copy(attempts = reply.attempts + 1) else reply
                },
            )
        }
    }

    fun clear(context: Context) {
        synchronized(lock) { context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE).edit().remove(RepliesKey).commit() }
    }

    private fun load(context: Context): List<PendingChatReply> =
        ChatReplyCodec.decode(
            context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
                .getString(RepliesKey, null),
        )

    private fun save(context: Context, replies: List<PendingChatReply>) {
        context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
            .edit()
            .putString(RepliesKey, ChatReplyCodec.encode(replies))
            .commit()
    }
}
