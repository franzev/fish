package space.fishhub.android.messaging

import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChatPushMessageTest {
    @Test
    fun `parses a complete direct message push`() {
        val push = ChatPushMessage.parse(
            mapOf(
                "version" to "1",
                "type" to "chat_message",
                "conversationId" to "conversation-1",
                "messageId" to "message-1",
                "senderId" to "sender-1",
                "senderName" to "  Coach Jordan  ",
                "unreadCount" to "7",
            ),
        )

        assertEquals("conversation-1", push?.conversationId)
        assertEquals("message-1", push?.messageId)
        assertEquals("Coach Jordan", push?.senderName)
        assertEquals(7, push?.unreadCount)
    }

    @Test
    fun `rejects unknown or incomplete push payloads`() {
        assertNull(ChatPushMessage.parse(mapOf("version" to "2", "type" to "chat_message")))
        assertNull(
            ChatPushMessage.parse(
                mapOf(
                    "version" to "1",
                    "type" to "chat_message",
                    "conversationId" to "conversation-1",
                    "senderId" to "sender-1",
                ),
            ),
        )
    }

    @Test
    fun `parses notification and external message destinations`() {
        assertEquals(
            ChatDestination("conversation-1", "message-1"),
            ChatIntents.destination(
                action = ChatIntents.ActionOpenMessage,
                conversationId = "conversation-1",
                messageId = "message-1",
                uri = null,
            ),
        )
        assertEquals(
            ChatDestination("conversation-2", "message-2"),
            ChatIntents.destination(
                action = Intent.ACTION_VIEW,
                conversationId = null,
                messageId = null,
                uri = "fish://messages/conversation-2/message-2",
            ),
        )
    }

    @Test
    fun `rejects malformed and unrelated destinations`() {
        assertNull(ChatIntents.destination(Intent.ACTION_VIEW, null, null, "https://example.test"))
        assertNull(ChatIntents.destination(Intent.ACTION_VIEW, null, null, "fish://messages/one"))
        assertNull(ChatIntents.destination(ChatIntents.ActionOpenMessage, "", "message-1", null))
    }

    @Test
    fun `message notification id is stable per conversation`() {
        assertEquals(
            ChatNotificationFactory.notificationId("conversation-1"),
            ChatNotificationFactory.notificationId("conversation-1"),
        )
    }
}
