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
import space.fishhub.android.data.chat.model.UserRole
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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

    private companion object {
        const val DatabaseName = "chat-migration-test"
    }
}
