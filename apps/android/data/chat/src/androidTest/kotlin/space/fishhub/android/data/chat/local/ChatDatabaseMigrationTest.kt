package space.fishhub.android.data.chat.local

import android.content.Context
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.ChatReaction
import space.fishhub.android.data.chat.model.UserRole
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatDatabaseMigrationTest {
    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        ChatDatabase::class.java,
        emptyList(),
        FrameworkSQLiteOpenHelperFactory(),
    )

    @Test
    fun migrationOneToTwoPreservesTextAndAddsNullableMedia() {
        helper.createDatabase(DatabaseName, 1).apply {
            execSQL(
                """
                INSERT INTO messages (
                    id, conversation_id, sender_id, sender_role, sender_display_name,
                    body, client_request_id, created_at, edited_at, deleted_at,
                    reply_to_message_id, local_status, failure_reason
                ) VALUES (
                    'message-1', 'conversation-1', 'client-1', 'client', 'Franz',
                    'Saved text', 'request-1', '2026-07-16T00:00:00Z', NULL, NULL,
                    NULL, 'sent', NULL
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 2, true, MIGRATION_1_2).use { database ->
            database.query("SELECT body, sticker_id, gif_json FROM messages").use { cursor ->
                cursor.moveToFirst()
                assertEquals("Saved text", cursor.getString(0))
                assertNull(cursor.getString(1))
                assertNull(cursor.getString(2))
            }
        }
    }

    @Test
    fun versionTwoRoundTripsGifAndUnknownSticker() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = Room.inMemoryDatabaseBuilder(context, ChatDatabase::class.java).build()
        try {
            val gifMessage = message(id = "gif", gif = gif())
            val unknownSticker = message(id = "sticker", stickerId = "aquatic-future-sticker")
            val unavailableGif = message(id = "unavailable", gifUnavailable = true)
            database.chatDao().upsertMessage(gifMessage.toEntity())
            database.chatDao().upsertMessage(unknownSticker.toEntity())
            database.chatDao().upsertMessage(unavailableGif.toEntity())

            val messages = database.chatDao().observeMessages("conversation-1").first().map { it.toDomain() }
            assertEquals("gif-1", messages.first { it.id == "gif" }.gif?.providerId)
            assertEquals(
                "aquatic-future-sticker",
                messages.first { it.id == "sticker" }.stickerId,
            )
            assertEquals(true, messages.first { it.id == "unavailable" }.gifUnavailable)
        } finally {
            database.close()
        }
    }

    @Test
    fun migrationTwoToThreeAddsNormalizedAttachmentCacheWithoutChangingMessages() {
        helper.createDatabase(DatabaseName, 2).apply {
            execSQL(
                """
                INSERT INTO messages (
                    id, conversation_id, sender_id, sender_role, sender_display_name,
                    body, sticker_id, gif_json, client_request_id, created_at, edited_at,
                    deleted_at, reply_to_message_id, local_status, failure_reason
                ) VALUES (
                    'message-attachment', 'conversation-1', 'client-1', 'client', 'Franz',
                    '', NULL, NULL, 'request-attachment', '2026-07-16T00:00:00Z', NULL,
                    NULL, NULL, 'sent', NULL
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 3, true, MIGRATION_2_3).use { database ->
            database.query("SELECT count(*) FROM messages WHERE id = 'message-attachment'").use { cursor ->
                cursor.moveToFirst()
                assertEquals(1, cursor.getInt(0))
            }
            database.query("SELECT count(*) FROM message_attachments").use { cursor ->
                cursor.moveToFirst()
                assertEquals(0, cursor.getInt(0))
            }
        }
    }

    @Test
    fun versionThreeRoundTripsOrderedAttachmentsWithoutSignedUrls() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = Room.inMemoryDatabaseBuilder(context, ChatDatabase::class.java).build()
        try {
            val original = message(id = "attachment-message").copy(
                attachments = listOf(
                    attachment("file", 1, ChatAttachmentKind.File),
                    attachment("photo", 0, ChatAttachmentKind.Image),
                ),
            )
            database.chatDao().reconcileMessage(
                original.toEntity(),
                original.attachments.map { it.toEntity(original.id, original.conversationId) },
            )

            val entities = database.chatDao().observeMessageAttachments("conversation-1").first()
            val restored = database.chatDao().observeMessages("conversation-1").first().single()
                .toDomain(entities)

            assertEquals(listOf("photo", "file"), restored.attachments.map { it.id })
            assertTrue(restored.attachments.all { it.thumbnailUrl == null && it.displayUrl == null })
        } finally {
            database.close()
        }
    }

    @Test
    fun migrationThreeToFourAddsPrivateAttachmentDraftQueue() {
        helper.createDatabase(DatabaseName, 3).close()

        helper.runMigrationsAndValidate(DatabaseName, 4, true, MIGRATION_3_4).use { database ->
            database.execSQL(
                """
                INSERT INTO attachment_drafts (
                    id, conversation_id, user_id, position, kind, scope, display_name,
                    source_mime_type, stored_mime_type, byte_size, width, height,
                    local_path, thumbnail_path, sha256, created_at, updated_at, expires_at
                ) VALUES (
                    'draft-1', 'conversation-1', 'client-1', 0, 'image', 'composer', 'Photo',
                    'image/jpeg', 'image/webp', 1200, 1200, 800,
                    '/private/photo.webp', '/private/thumb.webp', 'abc',
                    '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z', '2026-07-24T00:00:00Z'
                )
                """.trimIndent(),
            )
            database.query("SELECT display_name, scope, position FROM attachment_drafts").use { cursor ->
                cursor.moveToFirst()
                assertEquals("Photo", cursor.getString(0))
                assertEquals("composer", cursor.getString(1))
                assertEquals(0, cursor.getInt(2))
            }
        }
    }

    @Test
    fun migrationFourToFiveAddsDurableTransferStateWithoutPersistingCredentials() {
        helper.createDatabase(DatabaseName, 4).apply {
            execSQL(
                """
                INSERT INTO attachment_drafts (
                    id, conversation_id, user_id, position, kind, scope, display_name,
                    source_mime_type, stored_mime_type, byte_size, width, height,
                    local_path, thumbnail_path, sha256, created_at, updated_at, expires_at
                ) VALUES (
                    'draft-queue', 'conversation-1', 'client-1', 0, 'file', 'composer', 'notes.pdf',
                    'application/pdf', 'application/pdf', 2048, NULL, NULL,
                    '/private/notes.pdf', NULL, 'abc',
                    '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z', '2026-07-24T00:00:00Z'
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 5, true, MIGRATION_4_5).use { database ->
            database.query(
                """
                SELECT client_upload_id, source_byte_size, transfer_state, progress_bytes,
                       attempt_count, server_attachment_id, tus_upload_url
                FROM attachment_drafts WHERE id = 'draft-queue'
                """.trimIndent(),
            ).use { cursor ->
                cursor.moveToFirst()
                assertEquals("draft-queue", cursor.getString(0))
                assertEquals(2048L, cursor.getLong(1))
                assertEquals("selected", cursor.getString(2))
                assertEquals(0L, cursor.getLong(3))
                assertEquals(0, cursor.getInt(4))
                assertNull(cursor.getString(5))
                assertNull(cursor.getString(6))
            }
        }
    }

    @Test
    fun migrationFiveToSixAddsReactionCacheWithoutChangingMessages() {
        helper.createDatabase(DatabaseName, 5).apply {
            execSQL(
                """
                INSERT INTO messages (
                    id, conversation_id, sender_id, sender_role, sender_display_name,
                    body, sticker_id, gif_json, client_request_id, created_at, edited_at,
                    deleted_at, reply_to_message_id, local_status, failure_reason
                ) VALUES (
                    'message-reaction', 'conversation-1', 'client-1', 'client', 'Franz',
                    'Saved text', NULL, NULL, 'request-reaction', '2026-07-18T00:00:00Z', NULL,
                    NULL, NULL, 'sent', NULL
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 6, true, MIGRATION_5_6).use { database ->
            database.query(
                "SELECT body, reactions_json FROM messages WHERE id = 'message-reaction'",
            ).use { cursor ->
                cursor.moveToFirst()
                assertEquals("Saved text", cursor.getString(0))
                assertNull(cursor.getString(1))
            }
        }
    }

    @Test
    fun currentVersionRoundTripsReactionAggregates() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = Room.inMemoryDatabaseBuilder(context, ChatDatabase::class.java).build()
        try {
            val original = message(id = "reacted").copy(
                reactions = listOf(
                    ChatReaction(emoji = "👍", count = 3, byMe = true),
                    ChatReaction(emoji = "🎉", count = 1, byMe = false),
                ),
            )
            database.chatDao().upsertMessage(original.toEntity())

            val restored = database.chatDao().observeMessages("conversation-1")
                .first()
                .single()
                .toDomain()
            assertEquals(original.reactions, restored.reactions)
        } finally {
            database.close()
        }
    }

    private fun message(
        id: String,
        gif: ChatGif? = null,
        stickerId: String? = null,
        gifUnavailable: Boolean = false,
    ) = ChatMessage(
        id = id,
        conversationId = "conversation-1",
        senderId = "client-1",
        senderRole = UserRole.Client,
        body = "",
        gif = gif,
        gifUnavailable = gifUnavailable,
        stickerId = stickerId,
        clientRequestId = "request-$id",
        createdAt = "2026-07-16T00:00:00Z",
    )

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

    private fun attachment(id: String, position: Int, kind: ChatAttachmentKind) = ChatAttachment(
        id = id,
        position = position,
        kind = kind,
        originalName = if (kind == ChatAttachmentKind.Image) "Photo" else "notes.pdf",
        mimeType = if (kind == ChatAttachmentKind.Image) "image/webp" else "application/pdf",
        byteSize = 1024,
        width = 1200.takeIf { kind == ChatAttachmentKind.Image },
        height = 800.takeIf { kind == ChatAttachmentKind.Image },
        thumbnailPath = "thumb.webp".takeIf { kind == ChatAttachmentKind.Image },
        displayPath = "display",
        thumbnailUrl = "https://should-not-persist.test/thumb",
        displayUrl = "https://should-not-persist.test/display",
    )

    private companion object {
        const val DatabaseName = "chat-migration-test"
    }
}
