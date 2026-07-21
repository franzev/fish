package space.fishhub.android.messaging

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

internal data class PendingChatReply(
    val id: String,
    val conversationId: String,
    val body: String,
)

/** Small durable inbox used by notification actions before chat auth is ready. */
internal object ChatReplyStore {
    private const val PreferencesName = "fish-chat-notification-replies"
    private const val RepliesKey = "replies"
    private val lock = Any()

    fun enqueue(context: Context, conversationId: String, body: String) {
        synchronized(lock) {
            val replies = load(context).toMutableList()
            replies += PendingChatReply(
                id = UUID.randomUUID().toString().lowercase(),
                conversationId = conversationId,
                body = body,
            )
            save(context, replies)
        }
    }

    fun pending(context: Context): List<PendingChatReply> = synchronized(lock) { load(context) }

    fun remove(context: Context, id: String) {
        synchronized(lock) { save(context, load(context).filterNot { it.id == id }) }
    }

    fun clear(context: Context) {
        synchronized(lock) { context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE).edit().remove(RepliesKey).commit() }
    }

    private fun load(context: Context): List<PendingChatReply> {
        val raw = context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
            .getString(RepliesKey, null) ?: return emptyList()
        val json = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (index in 0 until json.length()) {
                val item = json.optJSONObject(index) ?: continue
                val id = item.optString("id").takeIf(String::isNotBlank) ?: continue
                val conversationId = item.optString("conversationId").takeIf(String::isNotBlank) ?: continue
                val body = item.optString("body").trim().takeIf(String::isNotBlank) ?: continue
                add(PendingChatReply(id, conversationId, body))
            }
        }
    }

    private fun save(context: Context, replies: List<PendingChatReply>) {
        val json = JSONArray()
        replies.forEach { reply ->
            json.put(
                JSONObject()
                    .put("id", reply.id)
                    .put("conversationId", reply.conversationId)
                    .put("body", reply.body),
            )
        }
        context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)
            .edit()
            .putString(RepliesKey, json.toString())
            .commit()
    }
}
