package com.fish.android.data.chat.remote

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
}
