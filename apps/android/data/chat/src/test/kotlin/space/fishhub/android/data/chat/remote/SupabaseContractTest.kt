package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.AttachmentDelivery
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
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

    @Test
    fun orderedAttachmentRowMapsStableMetadataAndEphemeralUrls() {
        val row = json.decodeFromString<MessageAttachmentDto>(
            """
            {
              "id":"attachment-1",
              "message_id":"message-1",
              "conversation_id":"conversation-1",
              "position":2,
              "kind":"image",
              "status":"ready",
              "original_name":"Photo",
              "stored_mime_type":"image/webp",
              "stored_byte_size":1200,
              "width":1200,
              "height":800,
              "thumbnail_path":"conversation-1/attachment-1/thumb.webp",
              "display_path":"conversation-1/attachment-1/display.webp"
            }
            """.trimIndent(),
        )
        val attachment = row.toDomain(
            fallbackId = "fallback",
            fallbackPosition = 0,
            delivery = AttachmentDelivery(
                "attachment-1",
                "https://example.test/thumb?token=private",
                "https://example.test/display?token=private",
                "2026-07-16T00:15:00Z",
            ),
        )

        assertEquals(ChatAttachmentKind.Image, attachment.kind)
        assertEquals(2, attachment.position)
        assertEquals("Photo", attachment.originalName)
        assertEquals("https://example.test/thumb?token=private", attachment.thumbnailUrl)
    }

    @Test
    fun malformedAttachmentBecomesVisibleUnavailablePlaceholder() {
        val attachment = MessageAttachmentDto(
            id = "attachment-unknown",
            messageId = "message-1",
            position = 0,
            kind = "future-kind",
            status = "ready",
            originalName = "",
        ).toDomain("fallback", 0, null)

        assertEquals(ChatAttachmentKind.Unavailable, attachment.kind)
        assertEquals(false, attachment.available)
        assertEquals("Attachment", attachment.originalName)
    }

    @Test
    fun refreshResponseIsKeyedByAttachmentId() {
        val response = json.decodeFromString<RefreshAttachmentUrlsResponse>(
            """
            {
              "expiresAt":"2026-07-16T00:15:00Z",
              "attachments":[
                {
                  "attachmentId":"attachment-2",
                  "thumbnailUrl":null,
                  "displayUrl":"https://example.test/file?token=private"
                }
              ]
            }
            """.trimIndent(),
        )

        assertEquals("attachment-2", response.attachments.single().attachmentId)
        assertEquals("2026-07-16T00:15:00Z", response.expiresAt)
    }

    @Test
    fun initializeResponseCanReconcileAnAlreadyReadyAttachmentWithoutUploadFields() {
        val response = json.decodeFromString<AttachmentUploadAuthorizationDto>(
            """{"status":"ready","attachmentId":"attachment-1","attachment":{},"urls":{}}""",
        )

        assertEquals("ready", response.status)
        assertEquals("attachment-1", response.attachmentId)
        assertEquals(null, response.uploadToken)
    }

    @Test
    fun retryAfterSupportsBothDeltaSecondsAndHttpDates() {
        val now = Instant.parse("2026-07-18T00:00:00Z")

        assertEquals(30L, parseRetryAfterSeconds("30", now))
        assertEquals(60L, parseRetryAfterSeconds("Sat, 18 Jul 2026 00:01:00 GMT", now))
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
