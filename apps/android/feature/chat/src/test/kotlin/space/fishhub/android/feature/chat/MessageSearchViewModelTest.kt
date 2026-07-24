package space.fishhub.android.feature.chat

import space.fishhub.android.data.chat.AttachmentDelivery
import space.fishhub.android.data.chat.AttachmentImportResult
import space.fishhub.android.data.chat.AttachmentImportSource
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.BlockedPerson
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.ConversationSnapshot
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.MessageSearchCursor
import space.fishhub.android.data.chat.MessageSearchHit
import space.fishhub.android.data.chat.MessageSearchPage
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.SharedContentDataPage
import space.fishhub.android.data.chat.SharedContentRequestToken
import space.fishhub.android.data.chat.sharedcontent.StoredSharedContentSnapshot
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalAttachmentDraft
import space.fishhub.android.data.chat.model.UserRole
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MessageSearchViewModelTest {
    @get:org.junit.Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `initial and blank query states never call the repository`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = RecordingSearchRepository()
        val viewModel = MessageSearchViewModel(repository, SearchTestFormatter)

        assertFalse(viewModel.uiState.value.visible)
        viewModel.open(conversation())
        viewModel.updateQuery("   ")
        advanceTimeBy(400)
        runCurrent()

        assertTrue(viewModel.uiState.value.visible)
        assertEquals("   ", viewModel.uiState.value.query)
        assertEquals(0, repository.requests.size)
    }

    @Test
    fun `debounces trimmed query and IME submit runs immediately`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = RecordingSearchRepository()
        val viewModel = MessageSearchViewModel(repository, SearchTestFormatter)
        viewModel.open(conversation())

        viewModel.updateQuery("  practice!  ")
        advanceTimeBy(299)
        runCurrent()
        assertTrue(repository.requests.isEmpty())

        advanceTimeBy(1)
        runCurrent()
        assertEquals(listOf("practice!"), repository.requests.map { it.query })

        viewModel.updateQuery("new phrase")
        viewModel.submitQuery()
        runCurrent()
        advanceTimeBy(300)
        runCurrent()

        assertEquals(listOf("practice!", "new phrase"), repository.requests.map { it.query })
    }

    @Test
    fun `new query clears old results and stale response cannot repopulate them`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = RecordingSearchRepository()
            val oldResponse = CompletableDeferred<ChatResult<MessageSearchPage>>()
            val newResponse = CompletableDeferred<ChatResult<MessageSearchPage>>()
            repository.responses["old"] = oldResponse
            repository.responses["new"] = newResponse
            val viewModel = MessageSearchViewModel(repository, SearchTestFormatter)
            viewModel.open(conversation())

            viewModel.updateQuery("old")
            advanceTimeBy(300)
            runCurrent()
            viewModel.updateQuery("new")
            assertTrue(viewModel.uiState.value.results.isEmpty())
            advanceTimeBy(300)
            runCurrent()

            oldResponse.complete(ChatResult.Success(page(hit("old-result"))))
            newResponse.complete(ChatResult.Success(page(hit("new-result"))))
            runCurrent()

            assertEquals(listOf("new-result"), viewModel.uiState.value.results.map { it.id })
        }

    @Test
    fun `pagination appends unique results and ignores repeated load more`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = RecordingSearchRepository()
            repository.pages += page(hit("one"), hit("two"), next = cursor("two"))
            repository.pages += page(hit("two"), hit("three"))
            val viewModel = MessageSearchViewModel(repository, SearchTestFormatter)
            viewModel.open(conversation())
            viewModel.updateQuery("practice")
            advanceTimeBy(300)
            runCurrent()

            viewModel.loadMore()
            viewModel.loadMore()
            runCurrent()

            assertEquals(listOf("one", "two", "three"), viewModel.uiState.value.results.map { it.id })
            assertEquals("You", viewModel.uiState.value.results.first().senderLabel)
            assertEquals(2, repository.requests.size)
            assertEquals(null, viewModel.uiState.value.nextCursor)
            viewModel.loadMore()
            assertEquals(2, repository.requests.size)
        }

    @Test
    fun `failure keeps query for retry and close resets session state`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = RecordingSearchRepository()
            repository.results += ChatResult.Failure(
                "Search is taking a little longer. Check your connection and try again.",
                recoverable = true,
                category = space.fishhub.android.data.chat.FailureCategory.Network,
            )
            repository.results += ChatResult.Success(page(hit("after-retry")))
            val viewModel = MessageSearchViewModel(repository, SearchTestFormatter)
            viewModel.open(conversation())
            viewModel.updateQuery("practice")
            advanceTimeBy(300)
            runCurrent()

            assertEquals("practice", viewModel.uiState.value.submittedQuery)
            assertTrue(viewModel.uiState.value.notice?.startsWith("Search is taking") == true)
            viewModel.retry()
            runCurrent()
            assertEquals(listOf("after-retry"), viewModel.uiState.value.results.map { it.id })
            assertEquals("Coach Jordan", viewModel.uiState.value.results.single().senderLabel)
            assertEquals("Today, 10:30 AM", viewModel.uiState.value.results.single().dateTimeLabel)
            assertEquals("Try this wording.", viewModel.uiState.value.results.single().excerpt)
            assertEquals(
                "Coach Jordan. Try this wording. Today, 10:30 AM",
                viewModel.uiState.value.results.single().accessibilityLabel,
            )

            viewModel.close()
            assertEquals(MessageSearchUiState(), viewModel.uiState.value)
        }

    @Test
    fun `opening another conversation clears the current search session`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = RecordingSearchRepository()
            val viewModel = MessageSearchViewModel(repository, SearchTestFormatter)
            viewModel.open(conversation())
            viewModel.updateQuery("practice")
            advanceTimeBy(300)
            runCurrent()

            viewModel.open(conversation().copy(conversationId = "conversation-2"))

            assertEquals(
                MessageSearchUiState(visible = true),
                viewModel.uiState.value,
            )
        }

    private fun conversation() = AuthorizedConversation(
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

    private fun hit(id: String) = MessageSearchHit(
        id = id,
        conversationId = "conversation-1",
        senderId = if (id == "one") "client-1" else "coach-1",
        body = "  Try\nthis   wording.  ",
        createdAt = "2026-07-16T00:00:00Z",
    )

    private fun page(
        vararg items: MessageSearchHit,
        next: MessageSearchCursor? = null,
    ) = MessageSearchPage(items.toList(), next)

    private fun cursor(id: String) = MessageSearchCursor("2026-07-16T00:00:00Z", id)
}

private data class SearchRequest(
    val conversationId: String,
    val query: String,
    val cursor: MessageSearchCursor?,
    val limit: Int,
)

private class RecordingSearchRepository : ChatRepository {
    override val authState: StateFlow<ChatAuthState> = MutableStateFlow(
        ChatAuthState.SignedIn("client-1", "client@example.com"),
    )
    val requests = mutableListOf<SearchRequest>()
    val responses = mutableMapOf<String, CompletableDeferred<ChatResult<MessageSearchPage>>>()
    val pages = ArrayDeque<MessageSearchPage>()
    val results = ArrayDeque<ChatResult<MessageSearchPage>>()

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = flowOf(emptyList())
    override fun observeReadStates(conversationId: String): Flow<List<ChatReadState>> = flowOf(emptyList())
    override fun observeDraft(conversationId: String): Flow<String> = flowOf("")
    override fun observeAttachmentDrafts(conversationId: String): Flow<List<LocalAttachmentDraft>> =
        flowOf(emptyList())
    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> =
        flowOf(ChatRealtimeEvent.Disconnected)
    override suspend fun signIn(email: String, password: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations(): ChatResult<AuthorizedChatDirectory> =
        ChatResult.Success(
            AuthorizedChatDirectory(
                AuthorizedChatIdentity("client-1", UserRole.Client, "Franz"),
                emptyList(),
            ),
        )
    override suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot> =
        error("not used")
    override suspend fun loadOlder(
        conversationId: String,
        cursor: ChatMessageCursor,
    ): ChatResult<MessagePage> = error("not used")
    override fun observeSharedContentSnapshot(
        conversationId: String,
    ): Flow<StoredSharedContentSnapshot?> = flowOf(null)
    override suspend fun refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?,
    ): ChatResult<SharedContentDataPage> = ChatResult.Success(SharedContentDataPage(emptyList(), false, null))
    override suspend fun refreshSharedContentCategories(
        token: SharedContentRequestToken,
    ): ChatResult<List<String>> = ChatResult.Success(emptyList())
    override suspend fun refreshAttachmentUrls(
        attachmentIds: List<String>,
    ): ChatResult<List<AttachmentDelivery>> = ChatResult.Success(emptyList())
    override suspend fun searchMessages(
        conversationId: String,
        query: String,
        cursor: MessageSearchCursor?,
        limit: Int,
    ): ChatResult<MessageSearchPage> {
        requests += SearchRequest(conversationId, query, cursor, limit)
        responses[query]?.let { return it.await() }
        results.removeFirstOrNull()?.let { return it }
        return pages.removeFirstOrNull()?.let { ChatResult.Success(it) }
            ?: ChatResult.Success(MessageSearchPage(emptyList(), null))
    }
    override suspend fun sendMessage(
        conversationId: String,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatResult<ChatMessage> = error("not used")
    override suspend fun editMessage(messageId: String, body: String): ChatResult<ChatMessage> =
        error("not used")
    override suspend fun deleteMessage(messageId: String): ChatResult<ChatMessage> = error("not used")
    override suspend fun setReaction(
        messageId: String,
        emoji: String,
        active: Boolean,
    ): ChatResult<ChatMessage> = error("not used")
    override suspend fun sendTyping(conversationId: String, typing: Boolean) = Unit
    override suspend fun removeFriend(userId: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun blockUser(userId: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun listBlockedPeople(): ChatResult<List<BlockedPerson>> = ChatResult.Success(emptyList())
    override suspend fun unblockUser(userId: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun reportGif(messageId: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState> = ChatResult.Success(ChatReadState("client-1"))
    override suspend fun saveDraft(conversationId: String, draft: String) = Unit
    override suspend fun importAttachments(
        conversationId: String,
        sources: List<AttachmentImportSource>,
    ) = AttachmentImportResult(0)
    override suspend fun commitAttachmentPreview(conversationId: String) = Unit
    override suspend fun discardAttachmentPreview(conversationId: String) = Unit
    override suspend fun removeAttachmentDraft(conversationId: String, attachmentId: String) = Unit
    override suspend fun retryAttachmentDraft(conversationId: String, attachmentId: String) = Unit
    override suspend fun clearCachedUserData() = Unit
}

private object SearchTestFormatter : ChatTextFormatter {
    override val missingSignInCredentials = "Add your email and password to sign in."
    override val conversationUnavailable = "This conversation isn't available."
    override val attachmentsNotReady = "Wait for each attachment to finish, or remove it."
    override val attachmentUnavailable = "That attachment did not load yet. Try again."
    override val messageUnavailable = "Earlier message unavailable"
    override fun participantContext(role: UserRole) = "Context"
    override fun timeLabel(timestamp: String) = "10:30 AM"
    override fun dateLabel(timestamp: String) = "Today"
}
