package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatGif
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupabaseContractTest {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    @Test
    fun messageRowUsesCurrentDatabaseFieldNames() {
        val row = json.decodeFromString<MessageDto>(
            """
            {
              "id":"message-1",
              "conversation_id":"conversation-1",
              "sender_id":"client-1",
              "sender_role":"client",
              "body":"Practice sentence",
              "client_request_id":"request-1",
              "created_at":"2026-07-16T00:00:00Z",
              "edited_at":null,
              "deleted_at":null,
              "reply_to_message_id":null,
              "sticker_id":null
            }
            """.trimIndent(),
        )

        assertEquals("conversation-1", row.conversationId)
        assertEquals("request-1", row.clientRequestId)
        assertEquals(null, row.stickerId)
    }

    @Test
    fun markReadCommandIncludesEdgeFunctionDiscriminator() {
        val payload = json.encodeToString(
            MarkReadRequest(
                conversationId = "conversation-1",
                lastDeliveredMessageId = "message-1",
                lastReadMessageId = "message-1",
            ),
        )

        assertTrue(payload.contains("\"action\":\"mark-read-state\""))
        assertTrue(payload.contains("\"conversationId\":\"conversation-1\""))
    }

    @Test
    fun sendCommandUsesExactMediaFieldNames() {
        val payload = json.encodeToString(
            SendMessageRequest(
                conversationId = "conversation-1",
                body = "",
                clientRequestId = "request-1",
                gif = gif(),
            ),
        )

        assertTrue(payload.contains("\"conversationId\":\"conversation-1\""))
        assertTrue(payload.contains("\"clientRequestId\":\"request-1\""))
        assertTrue(payload.contains("\"providerId\":\"gif-1\""))
        assertTrue(payload.contains("\"previewUrl\":\"https://static.klipy.com/preview.mp4\""))
        assertTrue(!payload.contains("stickerId"))
    }

    @Test
    fun joinedGifRowUsesCurrentDatabaseFieldNames() {
        val row = json.decodeFromString<MessageGifDto>(
            """
            {
              "message_id":"message-1",
              "provider":"klipy",
              "provider_content_id":"gif-1",
              "title":"Fish",
              "description":"A fish nodding",
              "source_url":"https://klipy.com/gifs/gif-1",
              "poster_url":"https://static.klipy.com/poster.gif",
              "preview_url":"https://static.klipy.com/preview.mp4",
              "media_url":"https://static.klipy.com/media.mp4",
              "width":480,
              "height":360
            }
            """.trimIndent(),
        )

        assertEquals("message-1", row.messageId)
        assertEquals("gif-1", row.providerId)
    }

    @Test
    fun reportCommandUsesExistingChatCommandAction() {
        val payload = json.encodeToString(ReportGifRequest(messageId = "message-1"))

        assertEquals("{\"action\":\"report-gif\",\"messageId\":\"message-1\"}", payload)
    }

    private fun gif() = ChatGif(
        provider = "klipy",
        providerId = "gif-1",
        title = "Fish",
        description = "A fish nodding",
        sourceUrl = "https://klipy.com/gifs/gif-1",
        posterUrl = "https://static.klipy.com/poster.gif",
        previewUrl = "https://static.klipy.com/preview.mp4",
        mediaUrl = "https://static.klipy.com/media.mp4",
        width = 480,
        height = 360,
    )
}
