package space.fishhub.android.feature.chat

import androidx.lifecycle.SavedStateHandle
import java.time.Instant
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import space.fishhub.android.data.chat.AttachmentImportResult
import space.fishhub.android.data.chat.AttachmentImportSource
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ConversationMute
import space.fishhub.android.data.chat.ConversationPin
import space.fishhub.android.data.chat.ConversationQuietPeriod
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.ConversationSnapshot
import space.fishhub.android.data.chat.GifPage
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.chat.GifSearchItem
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.MessageSearchCursor
import space.fishhub.android.data.chat.MessageSearchPage
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.SharedContentDataPage
import space.fishhub.android.data.chat.SharedContentRequestToken
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalAttachmentDraft
import space.fishhub.android.data.chat.model.LocalAttachmentKind
import space.fishhub.android.data.chat.model.LocalAttachmentScope
import space.fishhub.android.data.chat.model.LocalAttachmentTransferState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.sharedcontent.StoredSharedContentSnapshot
import space.fishhub.android.feature.chat.logic.ChatMediaCatalog
import space.fishhub.android.feature.chat.logic.ChatTextFormatter
import space.fishhub.android.feature.chat.logic.StickerCatalogItem
import space.fishhub.android.feature.chat.model.BlockedPeopleUiState
import space.fishhub.android.feature.chat.model.ChatRouteUiState
import space.fishhub.android.feature.chat.model.ChatScreenState
import space.fishhub.android.feature.chat.model.ComposerMediaUiModel
import space.fishhub.android.feature.chat.model.MessageDeliveryUiState
import space.fishhub.android.feature.chat.model.ReactionUiModel
import space.fishhub.android.feature.chat.state.replyPreview
import space.fishhub.android.feature.chat.viewmodels.ChatViewModel

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
    fun `a conversation opens with the stored quiet state`() =
        runTest(mainDispatcherRule.dispatcher) {
            val until = Instant.parse("2026-07-25T11:00:00Z")
            val repository = FakeChatRepository().apply {
                storedMute = ConversationMute(isMuted = true, mutedUntil = until)
            }
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            assertEquals(
                ConversationMute(isMuted = true, mutedUntil = until),
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute,
            )
        }

    @Test
    fun `an unreadable quiet state reads as notifications on`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository().apply {
                storedMute = ConversationMute(isMuted = true, mutedUntil = null)
                muteReadFails = true
            }
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            assertEquals(ConversationMute.On, (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute)
            assertEquals(null, (viewModel.uiState.value as ChatRouteUiState.Conversation).model.notice)
        }

    @Test
    fun `a quiet period shows before the server confirms then takes the server's word`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            repository.muteGate = CompletableDeferred()
            viewModel.setQuiet(ConversationQuietPeriod.OneHour)
            val optimistic = (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute
            assertTrue(optimistic.isMuted)
            assertTrue(optimistic.mutedUntil!! < FakeChatRepository.ConfirmedMuteBase)

            repository.muteGate?.complete(Unit)
            advanceUntilIdle()
            assertEquals(
                FakeChatRepository.ConfirmedMuteBase.plusSeconds(3_600),
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute.mutedUntil,
            )
            assertEquals(listOf(ConversationQuietPeriod.OneHour), repository.quietRequests)
        }

    @Test
    fun `the open ended quiet period carries no expiry`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.setQuiet(ConversationQuietPeriod.UntilTurnedBackOn)
            advanceUntilIdle()

            assertEquals(
                ConversationMute(isMuted = true, mutedUntil = null),
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute,
            )
        }

    @Test
    fun `turning notifications back on clears the quiet period`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.setQuiet(ConversationQuietPeriod.OneDay)
            advanceUntilIdle()
            viewModel.setQuiet(null)
            advanceUntilIdle()

            assertEquals(ConversationMute.On, (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute)
            assertEquals(
                listOf(ConversationQuietPeriod.OneDay, null),
                repository.quietRequests,
            )
        }

    @Test
    fun `a failed quiet command puts the old state back and explains`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            viewModel.setQuiet(ConversationQuietPeriod.OneHour)
            advanceUntilIdle()
            val before = (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute

            repository.muteWriteFails = true
            viewModel.setQuiet(null)
            advanceUntilIdle()

            assertEquals(before, (viewModel.uiState.value as ChatRouteUiState.Conversation).model.mute)
            assertEquals(
                "That did not save yet. Keep this open and try again.",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.notice,
            )
        }

    @Test
    fun `the list marks the open conversation quiet as soon as it is silenced`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            val before = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.conversations.single()
            viewModel.setQuiet(ConversationQuietPeriod.OneHour)
            advanceUntilIdle()
            val after = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.conversations.single()

            assertEquals(false, before.isQuiet)
            assertEquals(true, after.isQuiet)
            // Quiet withholds the alert, not the count.
            assertEquals(before.unreadCount, after.unreadCount)
        }

    @Test
    fun `a lapsed quiet period stops marking the list row`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository().apply {
                storedMute = ConversationMute(
                    isMuted = true,
                    mutedUntil = Instant.now().minusSeconds(1),
                )
            }
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            val row = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.conversations.single()
            assertEquals(false, row.isQuiet)
        }

    @Test
    fun `pinning a message shows it immediately then keeps the server's confirmed value`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitMessages(listOf(incomingMessage("message-1")))
            advanceUntilIdle()

            viewModel.onPin("message-1")
            advanceUntilIdle()

            assertEquals(
                "message-1",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage?.messageId,
            )
            assertEquals(listOf("message-1"), repository.pinRequests)
        }

    @Test
    fun `pinning a second message replaces the first`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitMessages(listOf(incomingMessage("message-1"), incomingMessage("message-2")))
            advanceUntilIdle()
            viewModel.onPin("message-1")
            advanceUntilIdle()

            viewModel.onPin("message-2")
            advanceUntilIdle()

            assertEquals(
                "message-2",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage?.messageId,
            )
            assertEquals(listOf("message-1", "message-2"), repository.pinRequests)
        }

    @Test
    fun `a failed pin command puts the previous pin back and explains`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitMessages(listOf(incomingMessage("message-1"), incomingMessage("message-2")))
            advanceUntilIdle()
            viewModel.onPin("message-1")
            advanceUntilIdle()

            repository.pinWriteFails = true
            viewModel.onPin("message-2")
            advanceUntilIdle()

            assertEquals(
                "message-1",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage?.messageId,
            )
            assertEquals(
                "That did not save yet. Keep this open and try again.",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.notice,
            )
        }

    @Test
    fun `unpinning clears the banner and keeps the server's confirmed value`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitMessages(listOf(incomingMessage("message-1")))
            advanceUntilIdle()
            viewModel.onPin("message-1")
            advanceUntilIdle()

            viewModel.onUnpin("message-1")
            advanceUntilIdle()

            assertEquals(
                null,
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage,
            )
            assertEquals(listOf("message-1", null), repository.pinRequests)
        }

    @Test
    fun `a failed unpin command restores the pinned banner`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitMessages(listOf(incomingMessage("message-1")))
            advanceUntilIdle()
            viewModel.onPin("message-1")
            advanceUntilIdle()

            repository.pinWriteFails = true
            viewModel.onUnpin("message-1")
            advanceUntilIdle()

            assertEquals(
                "message-1",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage?.messageId,
            )
        }

    @Test
    fun `a Room reconciled pin change updates the banner without a view model command`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            repository.emitMessages(listOf(incomingMessage("message-1")))
            advanceUntilIdle()

            // Stands in for what DefaultChatRepository does after a realtime
            // PinChanged event: it reconciles Room and this flow republishes.
            repository.emitPinnedMessage(
                ConversationPin("conversation-1", "message-1", "coach-1", "2026-07-31T00:00:00Z"),
            )
            advanceUntilIdle()

            assertEquals(
                "message-1",
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage?.messageId,
            )
        }

    @Test
    fun `a pin whose message is not loaded yet renders no banner`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            repository.emitPinnedMessage(
                ConversationPin("conversation-1", "message-missing", "coach-1", "2026-07-31T00:00:00Z"),
            )
            advanceUntilIdle()

            assertEquals(
                null,
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.pinnedMessage,
            )
        }

    @Test
    fun `blocked people load once and an unblock removes only after success`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository().apply {
                blockedPeople = listOf(
                    space.fishhub.android.data.chat.BlockedPerson("blocked-1", "Sam", "sam"),
                )
            }
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()

            viewModel.loadBlockedPeople()
            advanceUntilIdle()
            viewModel.loadBlockedPeople()
            assertEquals(1, repository.listBlockedCalls)

            viewModel.unblockBlockedPerson("blocked-1")
            viewModel.unblockBlockedPerson("blocked-1")
            advanceUntilIdle()

            assertEquals(listOf("blocked-1"), repository.unblockCalls)
            val state = viewModel.blockedPeople.value as BlockedPeopleUiState.Loaded
            assertTrue(state.people.isEmpty())
            assertEquals("Sam is no longer blocked.", state.notice)
        }

    @Test
    fun `failed unblock keeps blocked person visible`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository().apply {
                blockedPeople = listOf(
                    space.fishhub.android.data.chat.BlockedPerson("blocked-1", "Sam", "sam"),
                )
                unblockResult = ChatResult.Failure(
                    "That person is still blocked. Try again.",
                    true,
                    space.fishhub.android.data.chat.FailureCategory.Network,
                )
            }
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            viewModel.loadBlockedPeople()
            advanceUntilIdle()
            viewModel.unblockBlockedPerson("blocked-1")
            advanceUntilIdle()

            val state = viewModel.blockedPeople.value as BlockedPeopleUiState.Loaded
            assertEquals(listOf("blocked-1"), state.people.map { it.userId })
            assertEquals("That person is still blocked. Try again.", state.notice)
        }

    @Test
    fun `armed voice draft auto sends exactly once when upload is ready`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("voice", 0, LocalAttachmentScope.Composer).copy(
                        kind = LocalAttachmentKind.File,
                        displayName = "Voice message.m4a",
                        sourceMimeType = "audio/mp4",
                        storedMimeType = "audio/mp4",
                        serverAttachmentId = "server-voice",
                        transferState = LocalAttachmentTransferState.Ready,
                        progressBytes = 12_000,
                        byteSize = 12_000,
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.armVoiceAutoSend("voice")
            advanceUntilIdle()

            assertEquals(1, repository.sendCalls)
            assertEquals(listOf("server-voice"), repository.lastSentContent?.attachmentIds)
            assertEquals("", repository.lastSentContent?.body)
        }

    @Test
    fun `offline attachment send queues instead of refusing`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.realtime.value = ChatRealtimeEvent.Disconnected
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("photo", 0, LocalAttachmentScope.Composer).copy(
                        transferState = LocalAttachmentTransferState.Uploading,
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.sendMessage()
            advanceUntilIdle()

            assertEquals(1, repository.sendCalls)
            assertEquals(listOf("draft-photo"), repository.lastSentContent?.attachmentIds)
        }

    @Test
    fun `voice recorded offline sends into the queue without waiting for the upload`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.realtime.value = ChatRealtimeEvent.Disconnected
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("voice", 0, LocalAttachmentScope.Composer).copy(
                        kind = LocalAttachmentKind.File,
                        displayName = "Voice message.m4a",
                        sourceMimeType = "audio/mp4",
                        storedMimeType = "audio/mp4",
                        transferState = LocalAttachmentTransferState.WaitingForNetwork,
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.armVoiceAutoSend("voice")
            advanceUntilIdle()

            assertEquals(1, repository.sendCalls)
            assertEquals(listOf("draft-voice"), repository.lastSentContent?.attachmentIds)
        }

    @Test
    fun `queued upload turning ready triggers an outbox flush`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            val before = repository.flushCalls

            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("queued", 0, LocalAttachmentScope.Queued).copy(
                        serverAttachmentId = "server-queued",
                        transferState = LocalAttachmentTransferState.Ready,
                        progressBytes = 100,
                    ),
                ),
            )
            advanceUntilIdle()

            assertTrue(repository.flushCalls > before)
        }

    @Test
    fun `queued drafts stay out of the composer strip and the next send`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitAttachmentDrafts(
                listOf(
                    localDraft("parked", 0, LocalAttachmentScope.Queued).copy(
                        transferState = LocalAttachmentTransferState.Uploading,
                    ),
                    localDraft("current", 0, LocalAttachmentScope.Composer).copy(
                        serverAttachmentId = "server-current",
                        transferState = LocalAttachmentTransferState.Ready,
                        progressBytes = 100,
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.sendMessage()
            advanceUntilIdle()

            assertEquals(listOf("server-current"), repository.lastSentContent?.attachmentIds)
        }

    @Test
    fun `retry with unrecoverable attachments explains instead of sending text only`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitMessages(
                listOf(
                    incomingMessage("failed-1").copy(
                        senderId = "client-1",
                        body = "Here it is",
                        clientRequestId = "request-dead",
                        localStatus = LocalMessageStatus.Failed,
                        failureReason = "That file did not send. Pick it again to retry.",
                        attachments = listOf(
                            ChatAttachment(
                                id = "draft-gone",
                                position = 0,
                                kind = ChatAttachmentKind.Image,
                                originalName = "Photo",
                                mimeType = "image/webp",
                                byteSize = 100,
                            ),
                        ),
                    ),
                ),
            )
            advanceUntilIdle()

            viewModel.retryMessage("failed-1")
            advanceUntilIdle()

            assertEquals(0, repository.sendCalls)
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
    fun `offline text send is accepted for durable delivery`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeChatRepository()
        val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
        advanceUntilIdle()

        repository.realtime.value = ChatRealtimeEvent.Disconnected
        viewModel.draftChanged("Keep this draft")
        viewModel.sendMessage()
        advanceUntilIdle()

        val state = viewModel.uiState.value as ChatRouteUiState.Conversation
        assertEquals("Keep this draft", state.draft)
        assertEquals(1, repository.sendCalls)
        assertEquals(MessageDeliveryUiState.Sending, state.model.messages.first().delivery)
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
    fun `reaction writes use desired state and block duplicate taps while pending`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository()
            repository.reactionGate = CompletableDeferred()
            val viewModel = ChatViewModel(repository, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            repository.emitMessages(listOf(incomingMessage("reaction-message")))
            advanceUntilIdle()

            viewModel.toggleReaction("reaction-message", "👍")
            viewModel.toggleReaction("reaction-message", "👍")
            runCurrent()

            var message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertEquals(listOf(true), repository.reactionStates)
            assertTrue(!message.reactionsEnabled)

            repository.reactionGate?.complete(Unit)
            advanceUntilIdle()
            message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertTrue(message.reactionsEnabled)
            assertEquals(ReactionUiModel("👍", 1, true), message.reactions.single())

            viewModel.toggleReaction("reaction-message", "👍")
            advanceUntilIdle()
            message = (viewModel.uiState.value as ChatRouteUiState.Conversation)
                .model.messages.single()
            assertEquals(listOf(true, false), repository.reactionStates)
            assertTrue(message.reactions.isEmpty())
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

    @Test
    fun `refreshing the directory shows a conversation that did not exist before`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 2)
            val viewModel = friendsViewModel(repository)
            advanceUntilIdle()
            viewModel.showConversationList()
            advanceUntilIdle()

            repository.addConversation("conversation-3", "Sam Lee")
            viewModel.refreshDirectory()
            advanceUntilIdle()

            val state = viewModel.uiState.value as ChatRouteUiState.ConversationList
            assertEquals(
                listOf("conversation-1", "conversation-2", "conversation-3"),
                state.conversations.map { it.conversationId },
            )
            assertEquals("Sam Lee", state.conversations.last().participantName)
        }

    @Test
    fun `a first conversation opens when the directory refresh finds it`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 0)
            val viewModel = friendsViewModel(repository)
            advanceUntilIdle()
            assertEquals(
                ChatScreenState.Unavailable,
                (viewModel.uiState.value as ChatRouteUiState.Conversation).model.screenState,
            )

            repository.addConversation("conversation-9", "Sam Lee")
            viewModel.refreshDirectory()
            advanceUntilIdle()

            val state = viewModel.uiState.value as ChatRouteUiState.Conversation
            assertEquals("conversation-9", state.model.selectedConversationId)
        }

    @Test
    fun `refreshes that pile up during one fetch coalesce into one more`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 2)
            val viewModel = friendsViewModel(repository)
            advanceUntilIdle()
            viewModel.showConversationList()
            advanceUntilIdle()
            val before = repository.directoryCalls

            val gate = CompletableDeferred<Unit>()
            repository.directoryGate = gate
            viewModel.refreshDirectory()
            viewModel.refreshDirectory()
            viewModel.refreshDirectory()
            assertEquals(before + 1, repository.directoryCalls)

            repository.directoryGate = null
            gate.complete(Unit)
            advanceUntilIdle()
            // The answer in flight was asked for before those events, so one
            // more pass follows it — one, however many events arrived.
            assertEquals(before + 2, repository.directoryCalls)
        }

    @Test
    fun `a friendship that lands while the list is loading still arrives`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeChatRepository(conversationCount = 2)
            val viewModel = friendsViewModel(repository)
            advanceUntilIdle()

            val gate = CompletableDeferred<Unit>()
            repository.directoryGate = gate
            viewModel.showConversationList()
            val before = repository.directoryCalls

            // The accept commits while the list's own fetch is still out, so
            // that answer can never contain the new conversation.
            repository.addConversation("conversation-3", "Sam Lee")
            viewModel.refreshDirectory()
            assertEquals(before, repository.directoryCalls)

            repository.directoryGate = null
            gate.complete(Unit)
            advanceUntilIdle()

            assertEquals(before + 1, repository.directoryCalls)
            val state = viewModel.uiState.value as ChatRouteUiState.ConversationList
            assertEquals(
                listOf("conversation-1", "conversation-2", "conversation-3"),
                state.conversations.map { it.conversationId },
            )
        }

    @Test
    fun `the conversation list stays out of reach until friends or a second conversation`() =
        runTest(mainDispatcherRule.dispatcher) {
            listOf(0, 1).forEach { count ->
                val closed = FakeChatRepository(conversationCount = count)
                val withoutFriends = ChatViewModel(closed, SavedStateHandle(), TestFormatter)
                advanceUntilIdle()
                withoutFriends.showConversationList()
                advanceUntilIdle()
                assertTrue(
                    "$count conversations without friends must not reach the list",
                    withoutFriends.uiState.value !is ChatRouteUiState.ConversationList,
                )

                val open = FakeChatRepository(conversationCount = count)
                val withFriends = friendsViewModel(open)
                advanceUntilIdle()
                withFriends.showConversationList()
                advanceUntilIdle()
                assertTrue(
                    "$count conversations with friends must reach the list",
                    withFriends.uiState.value is ChatRouteUiState.ConversationList,
                )
            }

            val two = FakeChatRepository(conversationCount = 2)
            val viewModel = ChatViewModel(two, SavedStateHandle(), TestFormatter)
            advanceUntilIdle()
            viewModel.showConversationList()
            advanceUntilIdle()
            assertTrue(viewModel.uiState.value is ChatRouteUiState.ConversationList)

            // A coach has no friends surface to reach, so the flag buys them
            // nothing: only a second conversation still opens the list, exactly
            // as it does today.
            listOf(0 to false, 1 to false, 2 to true).forEach { (count, reachable) ->
                val coachRepository = FakeChatRepository(
                    conversationCount = count,
                    participantRole = UserRole.Client,
                    currentUserRole = UserRole.Coach,
                )
                val coach = friendsViewModel(coachRepository)
                advanceUntilIdle()
                assertEquals(
                    "coach back destination at $count conversations",
                    reachable,
                    (coach.uiState.value as ChatRouteUiState.Conversation)
                        .model
                        .hasPreviousDestination,
                )

                coach.showConversationList()
                advanceUntilIdle()
                assertEquals(
                    "coach list reachability at $count conversations",
                    reachable,
                    coach.uiState.value is ChatRouteUiState.ConversationList,
                )
            }
        }

    @Test
    fun `back to the list appears for a sole conversation only with friends on`() =
        runTest(mainDispatcherRule.dispatcher) {
            fun destinationFor(count: Int, friendsEnabled: Boolean): Boolean {
                val repository = FakeChatRepository(conversationCount = count)
                val viewModel = if (friendsEnabled) {
                    friendsViewModel(repository)
                } else {
                    ChatViewModel(repository, SavedStateHandle(), TestFormatter)
                }
                advanceUntilIdle()
                return (viewModel.uiState.value as ChatRouteUiState.Conversation)
                    .model
                    .hasPreviousDestination
            }

            // Nothing to go back to yet, so the empty state keeps its one action.
            assertTrue(!destinationFor(count = 0, friendsEnabled = false))
            assertTrue(!destinationFor(count = 0, friendsEnabled = true))
            assertTrue(!destinationFor(count = 1, friendsEnabled = false))
            assertTrue(destinationFor(count = 1, friendsEnabled = true))
            assertTrue(destinationFor(count = 2, friendsEnabled = false))
            assertTrue(destinationFor(count = 2, friendsEnabled = true))
        }

    private fun friendsViewModel(repository: FakeChatRepository) = ChatViewModel(
        repository,
        SavedStateHandle(),
        TestFormatter,
        friendsEnabled = true,
    )
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
    private val currentUserRole: UserRole = UserRole.Client,
) : ChatRepository {
    private val conversation = AuthorizedConversation(
        conversationId = "conversation-1",
        currentUserId = "client-1",
        currentUserRole = currentUserRole,
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
    var authorizedConversations = buildList {
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
    var directoryCalls: Int = 0
    var directoryGate: CompletableDeferred<Unit>? = null
    var sendCalls: Int = 0
    var flushCalls: Int = 0
    var readFails: Boolean = false
    var markReadCalls: Int = 0
    var storedMute: ConversationMute = ConversationMute.On
    var muteReadFails: Boolean = false
    var muteWriteFails: Boolean = false
    var muteGate: CompletableDeferred<Unit>? = null
    val quietRequests = mutableListOf<ConversationQuietPeriod?>()
    private val pinnedMessages = MutableStateFlow<ConversationPin?>(null)
    var pinWriteFails: Boolean = false
    val pinRequests = mutableListOf<String?>()

    companion object {
        /**
         * Deliberately far from "now", so a test can tell the optimistic quiet
         * expiry from the one the server confirms.
         */
        val ConfirmedMuteBase: Instant = Instant.parse("2030-01-01T00:00:00Z")
    }
    var lastSentContent: OutgoingMessageContent? = null
    var reportCalls: Int = 0
    var sendGate: CompletableDeferred<Unit>? = null
    var reactionGate: CompletableDeferred<Unit>? = null
    val reactionStates = mutableListOf<Boolean>()
    var refreshCalls: Int = 0
    var refreshMessageCalls: Int = 0
    var refreshedMessages: List<ChatMessage> = emptyList()
    val typingEvents = mutableListOf<Boolean>()
    val removedUserIds = mutableListOf<String>()
    val blockedUserIds = mutableListOf<String>()
    var blockedPeople: List<space.fishhub.android.data.chat.BlockedPerson> = emptyList()
    var listBlockedCalls: Int = 0
    val unblockCalls = mutableListOf<String>()
    var unblockResult: ChatResult<Unit> = ChatResult.Success(Unit)

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = messages
    override fun observeReadStates(conversationId: String): Flow<List<ChatReadState>> = readStates
    override fun observeDraft(conversationId: String): Flow<String> = drafts
    override fun observeAttachmentDrafts(conversationId: String): Flow<List<LocalAttachmentDraft>> =
        attachmentDrafts
    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> = realtime
    override suspend fun signIn(email: String, password: String): ChatResult<Unit> = ChatResult.Success(Unit)
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations():
        ChatResult<space.fishhub.android.data.chat.AuthorizedChatDirectory> {
        directoryCalls += 1
        // The server answers with the directory as it stood when it was asked,
        // so a conversation created during the flight is not in this answer.
        val answered = authorizedConversations
        directoryGate?.await()
        return ChatResult.Success(
            space.fishhub.android.data.chat.AuthorizedChatDirectory(
                currentUser = space.fishhub.android.data.chat.AuthorizedChatIdentity(
                    userId = "client-1",
                    role = currentUserRole,
                    displayName = "Franz",
                ),
                conversations = answered,
            ),
        )
    }

    /** Stands in for a friendship that just created a conversation server-side. */
    fun addConversation(conversationId: String, participantName: String) {
        authorizedConversations = authorizedConversations + conversation.copy(
            conversationId = conversationId,
            participantId = "friend-$conversationId",
            participantRole = UserRole.Client,
            participantDisplayName = participantName,
        )
    }
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
    override suspend fun refreshMessages(
        conversationId: String,
        messageIds: List<String>,
    ): ChatResult<List<ChatMessage>> {
        refreshMessageCalls += 1
        return ChatResult.Success(
            refreshedMessages.filter { it.conversationId == conversationId && it.id in messageIds },
        )
    }
    override suspend fun searchMessages(
        conversationId: String,
        query: String,
        cursor: MessageSearchCursor?,
        limit: Int,
    ): ChatResult<MessageSearchPage> = ChatResult.Success(MessageSearchPage(emptyList(), null))
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
                localStatus = if (realtime.value == ChatRealtimeEvent.Disconnected) {
                    LocalMessageStatus.Pending
                } else {
                    null
                },
            ),
        )
        }
    }
    override suspend fun flushTextOutbox(conversationId: String): ChatResult<Unit> {
        flushCalls += 1
        return ChatResult.Success(Unit)
    }

    override suspend fun reportGif(messageId: String): ChatResult<Unit> {
        reportCalls += 1
        return ChatResult.Success(Unit)
    }
    override suspend fun editMessage(messageId: String, body: String): ChatResult<ChatMessage> =
        commandMessage(messageId) { copy(body = body, editedAt = "2026-07-16T00:01:00Z") }

    override suspend fun deleteMessage(messageId: String): ChatResult<ChatMessage> =
        commandMessage(messageId) { copy(body = "", deletedAt = "2026-07-16T00:01:00Z") }

    override suspend fun setReaction(
        messageId: String,
        emoji: String,
        active: Boolean,
    ): ChatResult<ChatMessage> {
        reactionStates += active
        reactionGate?.await()
        return commandMessage(messageId) {
            copy(
                reactions = if (active) {
                    listOf(space.fishhub.android.data.chat.model.ChatReaction(emoji, 1, true))
                } else {
                    emptyList()
                },
            )
        }
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
    override suspend fun listBlockedPeople(): ChatResult<List<space.fishhub.android.data.chat.BlockedPerson>> =
        ChatResult.Success(blockedPeople).also { listBlockedCalls += 1 }
    override suspend fun unblockUser(userId: String): ChatResult<Unit> {
        unblockCalls += userId
        return unblockResult
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
    override suspend fun conversationMute(conversationId: String): ChatResult<ConversationMute> =
        if (muteReadFails) {
            ChatResult.Failure(
                "That did not save yet. Keep this open and try again.",
                true,
                space.fishhub.android.data.chat.FailureCategory.Network,
            )
        } else {
            ChatResult.Success(storedMute)
        }

    override suspend fun setConversationMute(
        conversationId: String,
        quietPeriod: ConversationQuietPeriod?,
    ): ChatResult<ConversationMute> {
        quietRequests += quietPeriod
        muteGate?.await()
        if (muteWriteFails) {
            return ChatResult.Failure(
                "That did not save yet. Keep this open and try again.",
                true,
                space.fishhub.android.data.chat.FailureCategory.Network,
            )
        }
        // A different base from the view model's pinned clock, so a test can
        // tell the optimistic value from the confirmed one.
        storedMute = ConversationMute(
            isMuted = quietPeriod != null,
            mutedUntil = quietPeriod?.durationSeconds?.let {
                ConfirmedMuteBase.plusSeconds(it.toLong())
            },
        )
        return ChatResult.Success(storedMute)
    }

    override fun observePinnedMessage(conversationId: String): Flow<ConversationPin?> = pinnedMessages

    override suspend fun setPinnedMessage(
        conversationId: String,
        messageId: String?,
    ): ChatResult<ConversationPin?> {
        pinRequests += messageId
        if (pinWriteFails) {
            return ChatResult.Failure(
                "That did not save yet. Keep this open and try again.",
                true,
                space.fishhub.android.data.chat.FailureCategory.Network,
            )
        }
        val pin = messageId?.let { ConversationPin(conversationId, it, "client-1", "2026-07-16T00:00:00Z") }
        pinnedMessages.value = pin
        return ChatResult.Success(pin)
    }

    fun emitPinnedMessage(pin: ConversationPin?) {
        pinnedMessages.value = pin
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
