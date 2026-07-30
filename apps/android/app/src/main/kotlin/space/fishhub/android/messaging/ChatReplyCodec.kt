package space.fishhub.android.messaging

import org.json.JSONArray
import org.json.JSONObject

/** Pure JSON codec for the notification reply store; keeps migration testable. */
internal object ChatReplyCodec {
    fun encode(replies: List<PendingChatReply>): String {
        val json = JSONArray()
        replies.forEach { reply ->
            val item = JSONObject()
                .put("id", reply.id)
                .put("conversationId", reply.conversationId)
                .put("body", reply.body)
            reply.messageId?.let { item.put("messageId", it) }
            json.put(item)
        }
        return json.toString()
    }

    fun decode(raw: String?): List<PendingChatReply> {
        if (raw == null) return emptyList()
        val json = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (index in 0 until json.length()) {
                val item = json.optJSONObject(index) ?: continue
                val id = item.nonNullString("id") ?: continue
                val conversationId = item.nonNullString("conversationId") ?: continue
                val body = item.nonNullString("body")?.trim()?.takeIf(String::isNotBlank) ?: continue
                val messageId = item.nonNullString("messageId")
                add(PendingChatReply(id, conversationId, body, messageId))
            }
        }
    }

    private fun JSONObject.nonNullString(key: String): String? =
        if (isNull(key)) null else optString(key).takeIf(String::isNotBlank)
}
