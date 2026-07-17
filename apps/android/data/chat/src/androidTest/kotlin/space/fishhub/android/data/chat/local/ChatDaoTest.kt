package space.fishhub.android.data.chat.local

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.AuthorizedConversation
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatDaoTest {
    private lateinit var database: ChatDatabase
    private lateinit var dao: ChatDao

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        dao = database.chatDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun authoritativeMessageReplacesOptimisticRequestWithoutDuplicate() = runTest {
        dao.reconcileMessage(message(id = "local-request", body = "optimistic", status = "sending"))
        dao.reconcileMessage(message(id = "server-message", body = "confirmed", status = "sent"))

        val messages = dao.observeMessages("conversation-1").first()
        assertEquals(1, messages.size)
        assertEquals("server-message", messages.single().id)
        assertEquals("confirmed", messages.single().body)
    }

    @Test
    fun draftIsScopedToConversationAndUser() = runTest {
        dao.upsertDraft(DraftEntity("conversation-1", "user-1", "Keep this draft", "2026-07-16T00:00:00Z"))

        assertEquals("Keep this draft", dao.observeDraft("conversation-1", "user-1").first())
        assertEquals(null, dao.observeDraft("conversation-1", "user-2").first())
    }

    @Test
    fun cachedConversationsAreScopedToTheSignedInUser() = runTest {
        dao.upsertConversation(
            AuthorizedConversation(
                conversationId = "conversation-1",
                currentUserId = "client-1",
                currentUserRole = UserRole.Client,
                currentUserDisplayName = "Franz",
                participantId = "coach-1",
                participantRole = UserRole.Coach,
                participantDisplayName = "Coach Jordan",
                latestMessageText = null,
                latestMessageCreatedAt = null,
                unreadCount = 0,
            ).toEntity(),
        )

        assertEquals(1, dao.conversations("client-1").size)
        assertEquals(0, dao.conversations("another-user").size)
    }

    private fun message(id: String, body: String, status: String) = MessageEntity(
        id = id,
        conversationId = "conversation-1",
        senderId = "user-1",
        senderRole = "client",
        senderDisplayName = "Franz",
        body = body,
        clientRequestId = "request-1",
        createdAt = "2026-07-16T00:00:00Z",
        editedAt = null,
        deletedAt = null,
        replyToMessageId = null,
        localStatus = status,
        failureReason = null,
    )
}
