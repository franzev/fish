package space.fishhub.android.data.chat

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.remote.ChatRemoteDataSource
import space.fishhub.android.data.chat.local.ChatDatabase
import space.fishhub.android.data.chat.local.toEntity
import java.io.IOException
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DefaultChatRepositoryTest {
    private lateinit var database: ChatDatabase
    private lateinit var remote: FakeRemote
    private lateinit var repository: DefaultChatRepository

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        remote = FakeRemote()
        repository = DefaultChatRepository(remote, database.chatDao())
    }

    @After
    fun tearDown() = database.close()

    @Test
    fun cachedConversationRemainsAvailableWhenRefreshFails() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.failConversationList = true

        val result = repository.listAuthorizedConversations()

        assertTrue(result is ChatResult.Success)
        assertEquals(
            remote.conversation.conversationId,
            (result as ChatResult.Success).value.conversations.single().conversationId,
        )
        assertEquals("Franz", result.value.currentUser.displayName)
    }

    @Test
    fun manualRetryReconcilesFailedRequestWithoutDuplicate() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.failSend = true

        val failed = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent("Practice sentence"),
            "request-1",
        )
        assertTrue(failed is ChatResult.Failure)

        remote.failSend = false
        val sent = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent("Practice sentence"),
            "request-1",
        )
        assertTrue(sent is ChatResult.Success)

        val messages = repository.observeMessages("conversation-1").first()
        assertEquals(1, messages.size)
        assertEquals("server-message", messages.single().id)
        assertEquals(LocalMessageStatus.Sent, messages.single().localStatus)
    }

    @Test
    fun bodylessGifSurvivesBareSendAcknowledgement() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val gif = ChatGif(
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

        val result = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent(body = "", gif = gif),
            "gif-request",
        )

        assertTrue(result is ChatResult.Success)
        val cached = repository.observeMessages("conversation-1").first().single()
        assertEquals("gif-1", cached.gif?.providerId)
        assertEquals("", cached.body)
    }

    @Test
    fun realtimeRetriesAfterTransportFailure() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.realtimeFailuresRemaining = 1
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            realtimeRetryDelayMs = 0,
        )

        val connected = repository.observeRealtime("conversation-1")
            .first { it == ChatRealtimeEvent.Connected }

        assertEquals(ChatRealtimeEvent.Connected, connected)
        assertEquals(2, remote.realtimeAttempts)
    }

    @Test
    fun reconnectPurgesConversationWhenAuthorizationWasRevoked() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        database.chatDao().upsertMessage(
            ChatMessage(
                id = "cached-message",
                conversationId = "conversation-1",
                senderId = "coach-1",
                senderRole = UserRole.Coach,
                body = "Previously authorized",
                clientRequestId = "cached-request",
                createdAt = "2026-07-16T00:00:00Z",
            ).toEntity(),
        )
        remote.authorized = false

        val event = repository.observeRealtime("conversation-1")
            .first { it == ChatRealtimeEvent.ConversationUnavailable }

        assertEquals(ChatRealtimeEvent.ConversationUnavailable, event)
        assertNull(database.chatDao().conversation("conversation-1"))
        assertTrue(repository.observeMessages("conversation-1").first().isEmpty())
        repository.saveDraft("conversation-1", "Must not survive revocation")
        assertEquals("", repository.observeDraft("conversation-1").first())
    }
}

private class FakeRemote : ChatRemoteDataSource {
    val conversation = AuthorizedConversation(
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
    )
    override val authState = MutableStateFlow<ChatAuthState>(
        ChatAuthState.SignedIn("client-1", "client@example.com"),
    )
    var failConversationList = false
    var failSend = false
    var realtimeFailuresRemaining = 0
    var realtimeAttempts = 0
    var authorized = true

    override suspend fun signIn(email: String, password: String) = Unit
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations(): AuthorizedChatDirectory {
        if (failConversationList) throw IOException("offline")
        return AuthorizedChatDirectory(
            currentUser = AuthorizedChatIdentity(
                conversation.currentUserId,
                conversation.currentUserRole,
                conversation.currentUserDisplayName,
            ),
            conversations = if (authorized) listOf(conversation) else emptyList(),
        )
    }
    override suspend fun loadMessages(
        conversation: AuthorizedConversation,
        cursor: ChatMessageCursor?,
    ) = MessagePage(emptyList(), false, null)
    override suspend fun loadReadStates(conversationId: String) = emptyList<ChatReadState>()
    override suspend fun sendMessage(
        conversation: AuthorizedConversation,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatMessage {
        if (failSend) throw IOException("offline")
        return ChatMessage(
            id = "server-message",
            conversationId = conversation.conversationId,
            senderId = conversation.currentUserId,
            senderRole = conversation.currentUserRole,
            senderDisplayName = conversation.currentUserDisplayName,
            body = content.normalizedBody,
            clientRequestId = clientRequestId,
            createdAt = "2026-07-16T00:00:00Z",
            localStatus = LocalMessageStatus.Sent,
        )
    }
    override suspend fun reportGif(messageId: String) = Unit
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ) = ChatReadState("client-1", lastDeliveredMessageId, null, lastReadMessageId, null)
    override fun realtime(conversation: AuthorizedConversation): Flow<ChatRealtimeEvent> = flow {
        realtimeAttempts += 1
        if (realtimeFailuresRemaining > 0) {
            realtimeFailuresRemaining -= 1
            throw IOException("socket closed")
        }
        emit(ChatRealtimeEvent.Connected)
        awaitCancellation()
    }
}
