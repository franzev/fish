package space.fishhub.android.feature.chat

import androidx.lifecycle.SavedStateHandle
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.ConversationSnapshot
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.chat.GifPage
import space.fishhub.android.data.chat.GifSearchItem
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentDraft
import space.fishhub.android.data.chat.model.LocalAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentScope
import space.fishhub.android.data.chat.model.LocalAttachmentTransferState
import space.fishhub.android.data.chat.AttachmentImportResult
import space.fishhub.android.data.chat.AttachmentImportSource
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.runCurrent
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
    fun `attachment only send uses ready server ids in displayed order`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("second", 1, LocalAttachmentScope.Composer).copy(
                        serverAttachmentId = "server-second",
                        transferState = LocalAttachmentTransferState.Ready,
                        progressBytes = 100,
                    ),
                    localDraft("first", 0, LocalAttachmentScope.Composer).copy(
                        serverAttachmentId = "server-first",
                        transferState = LocalAttachmentTransferState.Ready,
                        progressBytes = 100,
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.sendMessage()
            advanceUntilIdle()

            assertEquals(listOf("server-first", "server-second"), repository.lastSentContent?.attachmentIds)
            assertEquals("", repository.lastSentContent?.body)
            assertEquals(1, repository.sendCalls)
        }

    @Test
    fun `one failed attachment blocks subset send and keeps every row`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("ready", 0, LocalAttachmentScope.Composer).copy(
                        serverAttachmentId = "server-ready",
                        transferState = LocalAttachmentTransferState.Ready,
                        progressBytes = 100,
                    ),
                    localDraft("failed", 1, LocalAttachmentScope.Composer).copy(
                        transferState = LocalAttachmentTransferState.FailedRecoverable,
                        failureCode = "retry_limit",
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.sendMessage()
            advanceUntilIdle()

            assertEquals(0, repository.sendCalls)
            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals(listOf("ready", "failed"), state.attachmentDrafts.sortedBy { it.position }.map { it.id })
            assertTrue(state.notice.orEmpty().contains("Wait for each attachment"))
        }

    @Test
    fun `room backed attachment drafts survive view model recreation and keep order`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("photo-2", 1, LocalAttachmentScope.Composer),
                    localDraft("photo-1", 0, LocalAttachmentScope.Composer),
                ),
            )

            val first = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            val firstState = first.uiState.value as ChatRouteUiState.Conversation
            assertEquals(listOf("photo-1", "photo-2"), firstState.attachmentDrafts.sortedBy { it.position }.map { it.id })

            val recreated = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            val recreatedState = recreated.uiState.value as ChatRouteUiState.Conversation
            assertEquals(listOf("photo-1", "photo-2"), recreatedState.attachmentDrafts.sortedBy { it.position }.map { it.id })
        }

    @Test
    fun `current user identity survives an empty conversation directory`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 0)
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)

            advanceUntilIdle()

            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals(ChatScreenState.Unavailable, state.model.screenState)
            assertEquals("Franz", state.model.currentUserDisplayName)
        }

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
    fun `sends sticker-only content and replaces a pending GIF`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val gifs = RecordingGifRepository()
            val catalog = mediaCatalog()
            val viewModel = ChatViewModel(
                repository,
                SavedStateHandle(),
                TestFormatter,
                gifs,
                catalog,
            )
            advanceUntilIdle()

            viewModel.selectGif(gifItem(), "fish!")
            viewModel.selectSticker(catalog.stickers.first())
            viewModel.sendMessage()
            advanceUntilIdle()

            assertEquals("", repository.lastSentContent?.normalizedBody)
            assertEquals("sticker-1", repository.lastSentContent?.stickerId)
            assertEquals(null, repository.lastSentContent?.gif)
            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals(null, state.pendingMedia)
            assertEquals("sticker-1", state.model.messages.single().sticker?.id)
        }

    @Test
    fun `registers a GIF share after confirmation and reports without confirmation UI`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val gifs = RecordingGifRepository()
            val viewModel = ChatViewModel(
                repository,
                SavedStateHandle(),
                TestFormatter,
                gifs,
                mediaCatalog(),
            )
            advanceUntilIdle()

            viewModel.selectGif(gifItem(), "fish!")
            viewModel.sendMessage()
            advanceUntilIdle()
            viewModel.reportGif("message-1")
            advanceUntilIdle()

            assertEquals(listOf("gif-1" to "fish!"), gifs.shares)
            assertEquals(1, repository.reportCalls)
            assertEquals(
                "GIF reported. Thank you.",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).notice,
            )
        }

    @Test
    fun `failed send does not restore media over a newer selection`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(sendFails = true)
            repository.sendGate = CompletableDeferred()
            val catalog = mediaCatalog()
            val viewModel = ChatViewModel(
                repository,
                SavedStateHandle(),
                TestFormatter,
                RecordingGifRepository(),
                catalog,
            )
            advanceUntilIdle()

            viewModel.selectSticker(catalog.stickers[0])
            viewModel.sendMessage()
            viewModel.selectSticker(catalog.stickers[1])
            repository.sendGate?.complete(Unit)
            advanceUntilIdle()

            val pending = (viewModel.uiState.value as ChatRouteUiState.Conversation).pendingMedia
                as ComposerMediaUiModel.Sticker
            assertEquals("sticker-2", pending.value.id)
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

    @Test
    fun `attachment only mixed message remains visible in stored order`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            repository.emitMessages(
                listOf(
                    ChatMessage(
                        id = "attachments",
                        conversationId = "conversation-1",
                        senderId = "coach-1",
                        senderRole = UserRole.Coach,
                        body = "",
                        attachments = listOf(
                            attachment("photo-2", 2, ChatAttachmentKind.Image),
                            attachment("photo-1", 0, ChatAttachmentKind.Image),
                            attachment("file", 1, ChatAttachmentKind.File),
                        ),
                        clientRequestId = "attachment-request",
                        createdAt = "2026-07-16T00:00:00Z",
                    ),
                ),
            )
            advanceUntilIdle()

            val message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertEquals(listOf("photo-1", "file", "photo-2"), message.attachments.map { it.id })
        }

    @Test
    fun `file open refreshes signed url before emitting app request`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitMessages(
                listOf(
                    ChatMessage(
                        id = "file-message",
                        conversationId = "conversation-1",
                        senderId = "coach-1",
                        senderRole = UserRole.Coach,
                        body = "",
                        attachments = listOf(attachment("file", 0, ChatAttachmentKind.File)),
                        clientRequestId = "file-request",
                        createdAt = "2026-07-16T00:00:00Z",
                    ),
                ),
            )
            advanceUntilIdle()

            val request = async { viewModel.attachmentOpenRequests.first() }
            viewModel.openFileAttachment("file")
            advanceUntilIdle()

            assertEquals("https://example.test/file/display", request.await().signedUrl)
            assertEquals(1, repository.refreshCalls)
        }

    @Test
    fun `reply send carries target and clears reply composer state`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitMessages(listOf(incomingMessage("incoming-1")))
            advanceUntilIdle()

            viewModel.replyToMessage("incoming-1")
            viewModel.draftChanged("I will try that.")
            viewModel.sendMessage()
            advanceUntilIdle()

            assertEquals("incoming-1", repository.lastSentContent?.replyToMessageId)
            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals(null, state.model.replyTarget)
            assertEquals("incoming-1", state.model.messages.last().replyPreview?.messageId)
        }

    @Test
    fun `message commands publish edits deletion and reactions`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitMessages(
                listOf(
                    incomingMessage("mine").copy(
                        senderId = "client-1",
                        senderRole = UserRole.Client,
                        senderDisplayName = "Franz",
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.editMessage("mine", "A clearer sentence")
            advanceUntilIdle()
            var message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertEquals("A clearer sentence", message.body)
            assertTrue(message.edited)

            viewModel.toggleReaction("mine", "👍")
            advanceUntilIdle()
            message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertEquals(ReactionUiModel("👍", 1, true), message.reactions.single())

            viewModel.deleteMessage("mine")
            advanceUntilIdle()
            message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertTrue(message.deleted)
            assertTrue(!message.actionsEnabled)
        }

    @Test
    fun `typing signals start once and stop after inactivity`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.draftChanged("H")
            viewModel.draftChanged("He")
            advanceTimeBy(2_999)
            assertEquals(listOf(true), repository.typingEvents)
            advanceTimeBy(1)
            advanceUntilIdle()

            assertEquals(listOf(true, false), repository.typingEvents)
        }

    @Test
    fun `incoming typing expires when the stop signal is lost`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            repository.realtime.value = ChatRealtimeEvent.TypingChanged(true)
            runCurrent()
            assertEquals(
                "Coach Jordan",
                (viewModel.uiState.value as ChatRouteUiState.Conversation)
                    .model.typingParticipantName,
            )
            advanceTimeBy(5_000)
            advanceUntilIdle()
            assertEquals(
                null,
                (viewModel.uiState.value as ChatRouteUiState.Conversation)
                    .model.typingParticipantName,
            )
        }

    @Test
    fun `notification focus selects conversation and refreshes an older target`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 2)
            repository.refreshedMessages = listOf(
                incomingMessage("older-target", conversationId = "conversation-2").copy(
                    senderId = "coach-2",
                    senderDisplayName = "Coach Mina",
                ),
            )
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.focusMessage("conversation-2", "older-target")
            advanceUntilIdle()

            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals("conversation-2", state.model.selectedConversationId)
            assertEquals("older-target", state.model.focusedMessageId)
            assertEquals("older-target", state.model.messages.single().id)
            assertEquals(1, repository.refreshMessageCalls)
        }

    @Test
    fun `client friend profile exposes avatar details and removal closes conversation`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(
                participantRole = UserRole.Client,
                participantUsername = "sam",
                participantAvatarUrl = "https://example.test/avatar.webp",
            )
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            var state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals("sam", state.model.participant?.username)
            assertEquals("https://example.test/avatar.webp", state.model.participant?.avatarUrl)
            assertTrue(state.model.participant?.friendSafetyAvailable == true)

            viewModel.removeFriend()
            advanceUntilIdle()

            assertEquals(listOf("coach-1"), repository.removedUserIds)
            state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals(ChatScreenState.Unavailable, state.model.screenState)
        }

    @Test
    fun `coach relationship does not expose friend safety commands`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.blockParticipant()
            advanceUntilIdle()

            assertTrue(repository.blockedUserIds.isEmpty())
            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertTrue(state.model.participant?.friendSafetyAvailable == false)
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
    participantRole: UserRole = UserRole.Coach,
    participantUsername: String? = null,
    participantAvatarUrl: String? = null,
) : ChatRepository {
    private val conversation = AuthorizedConversation(
        conversationId = "conversation-1",
        currentUserId = "client-1",
        currentUserRole = UserRole.Client,
        currentUserDisplayName = "Franz",
        participantId = "coach-1",
        participantRole = participantRole,
        participantDisplayName = "Coach Jordan",
        latestMessageText = null,
        latestMessageCreatedAt = null,
        unreadCount = 0,
        participantUsername = participantUsername,
        participantAvatarUrl = participantAvatarUrl,
    )
    private val messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    private val readStates = MutableStateFlow<List<ChatReadState>>(emptyList())
    private val drafts = MutableStateFlow("")
    private val attachmentDrafts = MutableStateFlow<List<LocalAttachmentDraft>>(emptyList())
    val realtime = MutableStateFlow<ChatRealtimeEvent>(ChatRealtimeEvent.Connected)
    private val authorizedConversations = buildList {
        if (conversationCount > 0) add(conversation)
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
    var lastSentContent: OutgoingMessageContent? = null
    var reportCalls: Int = 0
    var sendGate: CompletableDeferred<Unit>? = null
    var refreshCalls: Int = 0
    var refreshMessageCalls: Int = 0
    var refreshedMessages: List<ChatMessage> = emptyList()
    val typingEvents = mutableListOf<Boolean>()
    val removedUserIds = mutableListOf<String>()
    val blockedUserIds = mutableListOf<String>()

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = messages
    override fun observeReadStates(conversationId: String): Flow<List<ChatReadState>> = readStates
    override fun observeDraft(conversationId: String): Flow<String> = drafts
    override fun observeAttachmentDrafts(conversationId: String): Flow<List<LocalAttachmentDraft>> =
        attachmentDrafts
    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> = realtime
    override suspend fun signIn(email: String, password: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations() = ChatResult.Success(
        space.fishhub.android.data.chat.AuthorizedChatDirectory(
            currentUser = space.fishhub.android.data.chat.AuthorizedChatIdentity(
                userId = "client-1",
                role = space.fishhub.android.data.chat.model.UserRole.Client,
                displayName = "Franz",
            ),
            conversations = authorizedConversations,
        ),
    )
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
    override suspend fun refreshMessages(
        conversationId: String,
        messageIds: List<String>,
    ): ChatResult<List<ChatMessage>> {
        refreshMessageCalls += 1
        return ChatResult.Success(
            refreshedMessages.filter { it.conversationId == conversationId && it.id in messageIds },
        )
    }
    override suspend fun refreshAttachmentUrls(
        attachmentIds: List<String>,
    ): ChatResult<List<space.fishhub.android.data.chat.AttachmentDelivery>> {
        refreshCalls += 1
        return ChatResult.Success(attachmentIds.map {
            space.fishhub.android.data.chat.AttachmentDelivery(
                attachmentId = it,
                thumbnailUrl = "https://example.test/$it/thumb",
                displayUrl = "https://example.test/$it/display",
                expiresAt = null,
            )
        })
    }
    override suspend fun sendMessage(
        conversationId: String,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatResult<ChatMessage> {
        sendCalls += 1
        lastSentContent = content
        sendGate?.await()
        return if (sendFails) {
        ChatResult.Failure(
            "That did not send yet. Keep this open and try again.",
            true,
            space.fishhub.android.data.chat.FailureCategory.Network,
        )
        } else {
        ChatResult.Success(
            ChatMessage(
                id = "message-1",
                conversationId = conversationId,
                senderId = conversation.currentUserId,
                senderRole = conversation.currentUserRole,
                body = content.normalizedBody,
                gif = content.gif,
                stickerId = content.stickerId,
                replyToMessageId = content.replyToMessageId,
                clientRequestId = clientRequestId,
                createdAt = "2026-07-16T00:00:00Z",
            ),
        )
        }
    }
    override suspend fun reportGif(messageId: String): ChatResult<Unit> {
        reportCalls += 1
        return ChatResult.Success(Unit)
    }
    override suspend fun editMessage(messageId: String, body: String): ChatResult<ChatMessage> =
        commandMessage(messageId) { copy(body = body, editedAt = "2026-07-16T00:01:00Z") }

    override suspend fun deleteMessage(messageId: String): ChatResult<ChatMessage> =
        commandMessage(messageId) { copy(body = "", deletedAt = "2026-07-16T00:01:00Z") }

    override suspend fun toggleReaction(messageId: String, emoji: String): ChatResult<ChatMessage> =
        commandMessage(messageId) {
            copy(reactions = listOf(space.fishhub.android.data.chat.model.ChatReaction(emoji, 1, true)))
        }

    override suspend fun sendTyping(conversationId: String, typing: Boolean) {
        typingEvents += typing
    }
    override suspend fun removeFriend(userId: String): ChatResult<Unit> {
        removedUserIds += userId
        return ChatResult.Success(Unit)
    }
    override suspend fun blockUser(userId: String): ChatResult<Unit> {
        blockedUserIds += userId
        return ChatResult.Success(Unit)
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
                space.fishhub.android.data.chat.FailureCategory.Network,
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
    override suspend fun importAttachments(
        conversationId: String,
        sources: List<AttachmentImportSource>,
    ) = AttachmentImportResult(0)
    override suspend fun commitAttachmentPreview(conversationId: String) = Unit
    override suspend fun discardAttachmentPreview(conversationId: String) = Unit
    override suspend fun removeAttachmentDraft(conversationId: String, attachmentId: String) = Unit
    override suspend fun retryAttachmentDraft(conversationId: String, attachmentId: String) = Unit
    override suspend fun clearCachedUserData() = Unit

    fun emitMessages(value: List<ChatMessage>) {
        messages.value = value
    }

    fun emitAttachmentDrafts(value: List<LocalAttachmentDraft>) {
        attachmentDrafts.value = value
    }

    private fun commandMessage(
        messageId: String,
        transform: ChatMessage.() -> ChatMessage,
    ): ChatResult<ChatMessage> {
        val updated = messages.value.firstOrNull { it.id == messageId }?.transform()
            ?: return ChatResult.Failure(
                "That message is not available.",
                false,
                space.fishhub.android.data.chat.FailureCategory.Authorization,
            )
        messages.value = messages.value.map { if (it.id == messageId) updated else it }
        return ChatResult.Success(updated)
    }
}

private fun localDraft(
    id: String,
    position: Int,
    scope: LocalAttachmentScope,
) = LocalAttachmentDraft(
    id = id,
    conversationId = "conversation-1",
    userId = "client-1",
    position = position,
    kind = LocalAttachmentKind.Image,
    scope = scope,
    displayName = "Photo",
    sourceMimeType = "image/jpeg",
    storedMimeType = "image/webp",
    byteSize = 100,
    width = 100,
    height = 80,
    localPath = "/private/$id.webp",
    thumbnailPath = "/private/$id-thumb.webp",
    sha256 = id.padEnd(64, '0').take(64),
    createdAt = "2026-07-17T00:00:00Z",
    updatedAt = "2026-07-17T00:00:00Z",
    expiresAt = "2026-07-24T00:00:00Z",
)

private fun incomingMessage(
    id: String,
    conversationId: String = "conversation-1",
) = ChatMessage(
    id = id,
    conversationId = conversationId,
    senderId = "coach-1",
    senderRole = UserRole.Coach,
    senderDisplayName = "Coach Jordan",
    body = "Try this sentence.",
    clientRequestId = "request-$id",
    createdAt = "2026-07-16T00:00:00Z",
)

private class RecordingGifRepository : GifRepository {
    override val available: Boolean = true
    val shares = mutableListOf<Pair<String, String?>>()
    override suspend fun trending(cursor: String?, limit: Int) = GifPage(emptyList(), null)
    override suspend fun search(query: String, cursor: String?, limit: Int) = GifPage(emptyList(), null)
    override suspend fun registerShare(gif: ChatGif, query: String?) {
        shares += gif.providerId to query
    }
}

private fun gifItem() = GifSearchItem(
    chatGif = ChatGif(
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
    ),
    animatedPreviewUrl = "https://static.klipy.com/tiny.gif",
)

private fun attachment(id: String, position: Int, kind: ChatAttachmentKind) = ChatAttachment(
    id = id,
    position = position,
    kind = kind,
    originalName = if (kind == ChatAttachmentKind.File) "notes.pdf" else "Photo",
    mimeType = if (kind == ChatAttachmentKind.File) "application/pdf" else "image/webp",
    byteSize = 1024,
    width = 1200.takeIf { kind == ChatAttachmentKind.Image },
    height = 800.takeIf { kind == ChatAttachmentKind.Image },
    thumbnailPath = "thumb.webp".takeIf { kind == ChatAttachmentKind.Image },
    displayPath = "display",
)

private fun mediaCatalog() = ChatMediaCatalog(
    emojiGroups = emptyList(),
    stickers = listOf(
        StickerCatalogItem(
            id = "sticker-1",
            phrase = "Hello",
            animal = "otter",
            description = "An otter waving",
            sourcePath = "/stickers/aquatic/hello.webp",
            styles = listOf("cute"),
            keywords = listOf("hello"),
        ),
        StickerCatalogItem(
            id = "sticker-2",
            phrase = "Thanks",
            animal = "octopus",
            description = "An octopus saying thanks",
            sourcePath = "/stickers/aquatic/thanks.webp",
            styles = listOf("cute"),
            keywords = listOf("thanks"),
        ),
    ),
)

private object TestFormatter : ChatTextFormatter {
    override val missingSignInCredentials = "Add your email and password to sign in."
    override val conversationUnavailable = "This conversation isn't available."
    override val attachmentsNotReady = "Wait for each attachment to finish, or remove it."
    override val attachmentUnavailable = "That attachment did not load yet. Try again."
    override val messageUnavailable = "Earlier message unavailable"
    override fun participantContext(role: UserRole) = when (role) {
        UserRole.Coach -> "Your English coach"
        UserRole.Client -> "Personal coaching conversation"
    }
    override fun timeLabel(timestamp: String) = timestamp
    override fun dateLabel(timestamp: String) = timestamp
}
