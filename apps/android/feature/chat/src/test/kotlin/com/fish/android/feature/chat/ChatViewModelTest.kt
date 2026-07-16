package com.fish.android.feature.chat

import androidx.lifecycle.SavedStateHandle
import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatMessageCursor
import com.fish.android.data.chat.model.ChatReadState
import com.fish.android.data.chat.model.UserRole
import com.fish.android.data.chat.AuthorizedConversation
import com.fish.android.data.chat.ChatAuthState
import com.fish.android.data.chat.ChatRealtimeEvent
import com.fish.android.data.chat.ChatRepository
import com.fish.android.data.chat.ChatResult
import com.fish.android.data.chat.ConversationSnapshot
import com.fish.android.data.chat.MessagePage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `loads authorized conversation and preserves draft changes`() =
        runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeChatRepository()
        val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)

        advanceUntilIdle()
        val loaded = viewModel.uiState.value as ChatRouteUiState.Conversation
        assertEquals("Coach Jordan", loaded.model.participant?.displayName)

        viewModel.draftChanged("My practice answer")
        advanceUntilIdle()

        assertEquals("My practice answer", repository.savedDraft)
        assertEquals(
            "My practice answer",
            (viewModel.uiState.value as ChatRouteUiState.Conversation).draft,
        )
    }

    @Test
    fun `send failure restores draft without duplicating message`() =
        runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeChatRepository(sendFails = true)
        val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
        advanceUntilIdle()

        viewModel.draftChanged("Please check this sentence.")
        viewModel.sendMessage()
        advanceUntilIdle()

        val state = viewModel.uiState.value as ChatRouteUiState.Conversation
        assertEquals("Please check this sentence.", state.draft)
        assertTrue(state.model.messages.single().delivery == MessageDeliveryUiState.Failed)

        repository.sendFails = false
        viewModel.sendMessage()
        advanceUntilIdle()

        val retried = viewModel.uiState.value as ChatRouteUiState.Conversation
        assertEquals(1, retried.model.messages.size)
        assertEquals("", retried.draft)
        assertEquals(MessageDeliveryUiState.Sent, retried.model.messages.single().delivery)
    }

    @Test
    fun `conversation list remains open while background chat state changes`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 2)
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.showConversationList()
            repository.emitMessages(emptyList())
            advanceUntilIdle()

            val list = viewModel.uiState.value as ChatRouteUiState.ConversationList
            assertEquals(2, list.conversations.size)

            viewModel.selectConversation("conversation-2")
            advanceUntilIdle()
            val selected = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals("Coach Mina", selected.model.participant?.displayName)
        }

    @Test
    fun `offline draft stays editable and is not sent`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeChatRepository()
        val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
        advanceUntilIdle()

        repository.realtime.value = ChatRealtimeEvent.Disconnected
        viewModel.draftChanged("Keep this draft")
        viewModel.sendMessage()
        advanceUntilIdle()

        val state = viewModel.uiState.value as ChatRouteUiState.Conversation
        assertEquals("Keep this draft", state.draft)
        assertEquals(0, repository.sendCalls)
    }

    @Test
    fun `process recreation restores active conversation and saved draft`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 2)
            val savedState = SavedStateHandle()
            val original = ChatViewModel(repository, savedState, TestFormatter)
            advanceUntilIdle()
            original.selectConversation("conversation-2")
            original.draftChanged("Saved between meetings")
            advanceUntilIdle()

            val recreated = ChatViewModel(repository, savedState, TestFormatter)
            advanceUntilIdle()

            val state = recreated.uiState.value as ChatRouteUiState.Conversation
            assertEquals("Coach Mina", state.model.participant?.displayName)
            assertEquals("Saved between meetings", state.draft)
        }

    @Test
    fun `unsupported bodyless messages do not render as blank bubbles`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            repository.emitMessages(
                listOf(
                    ChatMessage(
                        id = "media-only",
                        conversationId = "conversation-1",
                        senderId = "coach-1",
                        senderRole = UserRole.Coach,
                        body = "",
                        clientRequestId = "media-request",
                        createdAt = "2026-07-16T00:00:00Z",
                    ),
                ),
            )
            advanceUntilIdle()

            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertTrue(state.model.messages.isEmpty())
        }

    @Test
    fun `failed read receipt retries when the transcript updates`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            val incoming = ChatMessage(
                id = "incoming-1",
                conversationId = "conversation-1",
                senderId = "coach-1",
                senderRole = UserRole.Coach,
                body = "Try this sentence.",
                clientRequestId = "incoming-request",
                createdAt = "2026-07-16T00:00:00Z",
            )

            repository.readFails = true
            repository.emitMessages(listOf(incoming))
            advanceUntilIdle()
            assertEquals(1, repository.markReadCalls)

            repository.readFails = false
            repository.emitMessages(
                listOf(
                    incoming,
                    incoming.copy(
                        id = "outgoing-1",
                        senderId = "client-1",
                        senderRole = UserRole.Client,
                        body = "I will.",
                    ),
                ),
            )
            advanceUntilIdle()

            assertEquals(2, repository.markReadCalls)
        }

    @Test
    fun `revoked conversation leaves no cached transcript visible`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            repository.realtime.value = ChatRealtimeEvent.ConversationUnavailable
            advanceUntilIdle()

            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals(ChatScreenState.Unavailable, state.model.screenState)
            assertEquals("This conversation isn't available.", state.notice)
        }
}

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(
    val dispatcher: TestDispatcher = UnconfinedTestDispatcher(),
) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)
    override fun finished(description: Description) = Dispatchers.resetMain()
}

private class FakeChatRepository(
    var sendFails: Boolean = false,
    conversationCount: Int = 1,
) : ChatRepository {
    private val conversation = AuthorizedConversation(
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
    private val messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    private val readStates = MutableStateFlow<List<ChatReadState>>(emptyList())
    private val drafts = MutableStateFlow("")
    val realtime = MutableStateFlow<ChatRealtimeEvent>(ChatRealtimeEvent.Connected)
    private val authorizedConversations = buildList {
        add(conversation)
        if (conversationCount > 1) {
            add(
                conversation.copy(
                    conversationId = "conversation-2",
                    participantId = "coach-2",
                    participantDisplayName = "Coach Mina",
                ),
            )
        }
    }
    override val authState: StateFlow<ChatAuthState> = MutableStateFlow(
        ChatAuthState.SignedIn("client-1", "client@example.com"),
    )
    var savedDraft: String = ""
    var sendCalls: Int = 0
    var readFails: Boolean = false
    var markReadCalls: Int = 0

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = messages
    override fun observeReadStates(conversationId: String): Flow<List<ChatReadState>> = readStates
    override fun observeDraft(conversationId: String): Flow<String> = drafts
    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> = realtime
    override suspend fun signIn(email: String, password: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations() = ChatResult.Success(authorizedConversations)
    override suspend fun syncNewest(conversationId: String) = ChatResult.Success(
        ConversationSnapshot(
            authorizedConversations.first { it.conversationId == conversationId },
            emptyList(),
            emptyList(),
            false,
            null,
        ),
    )
    override suspend fun loadOlder(conversationId: String, cursor: ChatMessageCursor) =
        ChatResult.Success(MessagePage(emptyList(), false, null))
    override suspend fun sendMessage(
        conversationId: String,
        body: String,
        clientRequestId: String,
    ): ChatResult<ChatMessage> {
        sendCalls += 1
        return if (sendFails) {
        ChatResult.Failure(
            "That did not send yet. Keep this open and try again.",
            true,
            com.fish.android.data.chat.FailureCategory.Network,
        )
        } else {
        ChatResult.Success(
            ChatMessage(
                id = "message-1",
                conversationId = conversationId,
                senderId = conversation.currentUserId,
                senderRole = conversation.currentUserRole,
                body = body,
                clientRequestId = clientRequestId,
                createdAt = "2026-07-16T00:00:00Z",
            ),
        )
        }
    }
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState> {
        markReadCalls += 1
        return if (readFails) {
            ChatResult.Failure(
                "Your read position did not update yet.",
                true,
                com.fish.android.data.chat.FailureCategory.Network,
            )
        } else {
            ChatResult.Success(
                ChatReadState("client-1", lastDeliveredMessageId, null, lastReadMessageId, null),
            )
        }
    }
    override suspend fun saveDraft(conversationId: String, draft: String) {
        savedDraft = draft
        drafts.value = draft
    }
    override suspend fun clearCachedUserData() = Unit

    fun emitMessages(value: List<ChatMessage>) {
        messages.value = value
    }
}

private object TestFormatter : ChatTextFormatter {
    override val missingSignInCredentials = "Add your email and password to sign in."
    override val conversationUnavailable = "This conversation isn't available."
    override fun participantContext(role: UserRole) = when (role) {
        UserRole.Coach -> "Your English coach"
        UserRole.Client -> "Personal coaching conversation"
    }
    override fun timeLabel(timestamp: String) = timestamp
    override fun dateLabel(timestamp: String) = timestamp
}
