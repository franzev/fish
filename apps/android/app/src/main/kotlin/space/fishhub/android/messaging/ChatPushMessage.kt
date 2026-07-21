package space.fishhub.android.messaging

internal data class ChatPushMessage(
    val conversationId: String,
    val messageId: String,
    val senderId: String,
    val senderName: String,
    val unreadCount: Int,
) {
    companion object {
        fun parse(data: Map<String, String>): ChatPushMessage? {
            if (data["version"] != "1" || data["type"] != "chat_message") return null
            val conversationId = data["conversationId"]?.takeIf(String::isNotBlank) ?: return null
            val messageId = data["messageId"]?.takeIf(String::isNotBlank) ?: return null
            val senderId = data["senderId"]?.takeIf(String::isNotBlank) ?: return null
            val senderName = data["senderName"]?.trim()?.takeIf(String::isNotBlank)
                ?: "Someone in FISH"
            val unreadCount = data["unreadCount"]?.toIntOrNull()?.coerceAtLeast(0) ?: 0
            return ChatPushMessage(conversationId, messageId, senderId, senderName, unreadCount)
        }
    }
}
