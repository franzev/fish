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
                val id = item.optString("id").takeIf(String::isNotBlank) ?: continue
                val conversationId = item.optString("conversationId").takeIf(String::isNotBlank) ?: continue
                val body = item.optString("body").trim().takeIf(String::isNotBlank) ?: continue
                val messageId = item.optString("messageId").takeIf(String::isNotBlank)
                add(PendingChatReply(id, conversationId, body, messageId))
            }
        }
    }
}
