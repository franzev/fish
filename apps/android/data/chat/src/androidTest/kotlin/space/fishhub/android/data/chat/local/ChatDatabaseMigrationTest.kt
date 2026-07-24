package space.fishhub.android.data.chat.local

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
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
import space.fishhub.android.data.chat.model.ChatLinkPreview
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
    fun migrationSixToSevenAddsNullableLinkPreviewCache() {
        helper.createDatabase(DatabaseName, 6).apply {
            execSQL(
                """
                INSERT INTO messages (
                    id, conversation_id, sender_id, sender_role, sender_display_name,
                    body, sticker_id, gif_json, client_request_id, created_at, edited_at,
                    deleted_at, reply_to_message_id, reactions_json, local_status, failure_reason
                ) VALUES (
                    'message-link-preview', 'conversation-1', 'client-1', 'client', 'Franz',
                    'Saved link', NULL, NULL, 'request-link-preview', '2026-07-18T00:00:00Z', NULL,
                    NULL, NULL, NULL, 'sent', NULL
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 7, true, MIGRATION_6_7).use { database ->
            database.query(
                "SELECT body, link_preview_json FROM messages WHERE id = 'message-link-preview'",
            ).use { cursor ->
                cursor.moveToFirst()
                assertEquals("Saved link", cursor.getString(0))
                assertNull(cursor.getString(1))
            }
        }
    }

    @Test
    fun migrationEightToNinePreservesChatRowsStartsCacheEmptyAndHasNoAuthorityColumns() {
        helper.createDatabase(DatabaseName, 8).apply {
            execSQL(
                """
                INSERT INTO conversations (
                    conversation_id, current_user_id, current_user_role, current_user_display_name,
                    participant_id, participant_role, participant_display_name,
                    latest_message_text, latest_message_created_at, unread_count
                ) VALUES (
                    'migration-conversation', 'owner-a', 'client', 'Franz',
                    'coach-a', 'coach', 'Coach Jordan', 'Saved',
                    '2026-07-23T00:00:00Z', 2
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO messages (
                    id, conversation_id, sender_id, sender_role, sender_display_name,
                    body, sticker_id, gif_json, link_preview_json, client_request_id,
                    created_at, edited_at, deleted_at, reply_to_message_id,
                    reactions_json, local_status, failure_reason
                ) VALUES (
                    'migration-message', 'migration-conversation', 'owner-a', 'client', 'Franz',
                    'Saved chat row', NULL, NULL, NULL, 'migration-request',
                    '2026-07-23T00:00:00Z', NULL, NULL, NULL, NULL, 'sent', NULL
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO message_attachments (
                    id, message_id, conversation_id, position, kind, available,
                    original_name, stored_mime_type, stored_byte_size, width, height,
                    thumbnail_path, display_path
                ) VALUES (
                    'migration-attachment', 'migration-message', 'migration-conversation', 0,
                    'file', 1, 'notes.pdf', 'application/pdf', 20, NULL, NULL, NULL, NULL
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO read_states (
                    conversation_id, user_id, last_delivered_message_id, delivered_at,
                    last_read_message_id, read_at
                ) VALUES (
                    'migration-conversation', 'owner-a', 'migration-message',
                    '2026-07-23T00:00:00Z', 'migration-message', '2026-07-23T00:00:00Z'
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO drafts (conversation_id, user_id, body, updated_at)
                VALUES ('migration-conversation', 'owner-a', 'Saved draft', '2026-07-23T00:00:00Z')
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO pending_text_sends (
                    conversation_id, user_id, client_request_id, body, reply_to_message_id, created_at
                ) VALUES (
                    'migration-conversation', 'owner-a', 'pending-migration', 'Pending', NULL,
                    '2026-07-23T00:00:00Z'
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO attachment_drafts (
                    id, conversation_id, user_id, position, kind, scope, display_name,
                    source_mime_type, stored_mime_type, byte_size, source_byte_size,
                    width, height, local_path, thumbnail_path, sha256, created_at,
                    updated_at, expires_at, client_upload_id, server_attachment_id,
                    transfer_state, progress_bytes, attempt_count, failure_code,
                    retry_after, tus_upload_url, tus_upload_offset, tus_expires_at
                ) VALUES (
                    'migration-draft', 'migration-conversation', 'owner-a', 0, 'file', 'composer',
                    'notes.pdf', 'application/pdf', 'application/pdf', 20, 20, NULL, NULL,
                    '/private/notes.pdf', NULL, 'migration-sha', '2026-07-23T00:00:00Z',
                    '2026-07-23T00:00:00Z', '2026-07-24T00:00:00Z', 'migration-upload', NULL,
                    'selected', 0, 0, NULL, NULL, NULL, 0, NULL
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 9, true, MIGRATION_8_9).use { database ->
            assertRowCount(database, "conversations", 1)
            assertRowCount(database, "messages", 1)
            assertRowCount(database, "message_attachments", 1)
            assertRowCount(database, "read_states", 1)
            assertRowCount(database, "drafts", 1)
            assertRowCount(database, "pending_text_sends", 1)
            assertRowCount(database, "attachment_drafts", 1)
            assertRowCount(database, "shared_content_cache_owners", 0)
            assertRowCount(database, "shared_content_cache_pages", 0)
            assertRowCount(database, "shared_content_cache_items", 0)

            listOf(
                "shared_content_cache_owners",
                "shared_content_cache_pages",
                "shared_content_cache_items",
            ).forEach { table ->
                database.query("PRAGMA table_info(`$table`)").use { cursor ->
                    val columns = buildList {
                        val nameIndex = cursor.getColumnIndex("name")
                        while (cursor.moveToNext()) add(cursor.getString(nameIndex))
                    }
                    assertTrue(
                        "$table must be owner and conversation scoped",
                        "owner_identity_id" in columns && "conversation_id" in columns,
                    )
                    assertTrue(
                        "$table must not persist delivery authority or runtime references",
                        columns.none { column -> FORBIDDEN_CACHE_COLUMN.containsMatchIn(column) },
                    )
                }
            }
        }
    }

    @Test
    fun phaseThirteenDatabaseAdvancesToVersionTen() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = Room.inMemoryDatabaseBuilder(context, ChatDatabase::class.java).build()
        try {
            database.openHelper.readableDatabase.query("PRAGMA user_version").use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertEquals(
                    "RED: Phase 13 ChatDatabase must advance from version 9 to version 10",
                    10,
                    cursor.getInt(0),
                )
            }
        } finally {
            database.close()
        }
    }

    @Test
    fun migrationNineToTenPreservesLegacyRowsAndAddsOnlyNullableDurationMetadata() {
        helper.createDatabase(DatabaseName, 9).apply {
            execSQL(
                """
                INSERT INTO shared_content_cache_owners (
                    owner_identity_id, conversation_id, schema_version, saved_at,
                    last_authoritative_at, last_accessed_at, authoritative_empty_confirmed,
                    retained_oldest_cursor, retained_history_complete, newest_window_protected
                ) VALUES (
                    'owner-a', 'conversation-a', 1, '2026-07-24T00:00:00Z',
                    '2026-07-24T00:00:00Z', '2026-07-24T00:00:00Z', 0,
                    NULL, 1, 1
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO shared_content_cache_pages (
                    owner_identity_id, conversation_id, page_id, page_ordinal,
                    retained_cursor, last_accessed_at, is_newest_window
                ) VALUES (
                    'owner-a', 'conversation-a', 'newest', 0,
                    NULL, '2026-07-24T00:00:00Z', 1
                )
                """.trimIndent(),
            )
            execSQL(
                """
                INSERT INTO shared_content_cache_items (
                    owner_identity_id, conversation_id, item_id, source_message_id,
                    sender_id, source_created_at, source_rank, category, kind,
                    attachment_id, attachment_original_name, attachment_mime_type,
                    attachment_byte_size, attachment_width, attachment_height,
                    gif_provider, gif_provider_content_id, gif_title, gif_description,
                    sticker_id, link_metadata_json, page_id
                ) VALUES (
                    'owner-a', 'conversation-a', 'voice-a', 'message-a',
                    'sender-a', '2026-07-24T00:00:00Z', 0, 'voice', 'voice',
                    'attachment-a', 'Voice message', 'audio/mp4',
                    2048, NULL, NULL,
                    NULL, NULL, NULL, NULL,
                    NULL, NULL, 'newest'
                )
                """.trimIndent(),
            )
            close()
        }

        helper.runMigrationsAndValidate(DatabaseName, 10, true, migrationNineToTen()).use { database ->
            database.query(
                """
                SELECT item_id, duration_ms
                FROM shared_content_cache_items
                WHERE owner_identity_id = 'owner-a'
                  AND conversation_id = 'conversation-a'
                """.trimIndent(),
            ).use { cursor ->
                assertTrue("legacy shared-content row must survive 9→10", cursor.moveToFirst())
                assertEquals("voice-a", cursor.getString(0))
                assertNull("legacy duration must remain nullable", cursor.getString(1))
            }

            database.query("PRAGMA table_info(`shared_content_cache_items`)").use { cursor ->
                val columns = buildList {
                    val nameIndex = cursor.getColumnIndex("name")
                    while (cursor.moveToNext()) add(cursor.getString(nameIndex))
                }
                assertTrue("duration_ms must be added to the cache item", "duration_ms" in columns)
                assertTrue(
                    "9→10 must not add delivery URLs, paths, tokens, or action authority",
                    columns.none { FORBIDDEN_CACHE_COLUMN.containsMatchIn(it) },
                )
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

    @Test
    fun currentVersionRoundTripsLinkPreviewMetadata() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = Room.inMemoryDatabaseBuilder(context, ChatDatabase::class.java).build()
        try {
            val original = message(id = "linked").copy(
                body = "Read this",
                linkPreview = ChatLinkPreview(
                    url = "https://example.com/article",
                    hostname = "example.com",
                    title = "A calm title",
                    description = "A useful description",
                    siteName = "Example",
                ),
            )
            database.chatDao().upsertMessage(original.toEntity())

            val restored = database.chatDao().observeMessages("conversation-1")
                .first()
                .single()
                .toDomain()
            assertEquals(original.linkPreview, restored.linkPreview)
        } finally {
            database.close()
        }
    }

    private fun message(
        id: String,
        gif: ChatGif? = null,
        linkPreview: ChatLinkPreview? = null,
        stickerId: String? = null,
        gifUnavailable: Boolean = false,
    ) = ChatMessage(
        id = id,
        conversationId = "conversation-1",
        senderId = "client-1",
        senderRole = UserRole.Client,
        body = "",
        gif = gif,
        linkPreview = linkPreview,
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

    private fun assertRowCount(
        database: androidx.sqlite.db.SupportSQLiteDatabase,
        table: String,
        expected: Int,
    ) {
        database.query("SELECT count(*) FROM `$table`").use { cursor ->
            cursor.moveToFirst()
            assertEquals(expected, cursor.getInt(0))
        }
    }

    private fun migrationNineToTen(): Migration = runCatching {
        val holder = Class.forName(
            "space.fishhub.android.data.chat.local.ChatDatabaseKt",
        )
        holder.getDeclaredMethod("getMIGRATION_9_10").invoke(null) as Migration
    }.getOrElse { cause ->
        throw AssertionError(
            "RED: missing Phase 13 Room MIGRATION_9_10 nullable duration contract",
            cause,
        )
    }

    private companion object {
        const val DatabaseName = "chat-migration-test"
        val FORBIDDEN_CACHE_COLUMN = Regex(
            "url|token|delivery_reference|temporary_reference|error|preview_bytes|can_delete|can_export",
            RegexOption.IGNORE_CASE,
        )
    }
}
