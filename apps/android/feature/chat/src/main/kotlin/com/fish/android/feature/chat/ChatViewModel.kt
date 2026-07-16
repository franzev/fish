package com.fish.android.feature.chat

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fish.android.feature.chat.state.ChatEvent
import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.feature.chat.state.ChatState
import com.fish.android.data.chat.model.LocalMessageStatus
import com.fish.android.feature.chat.state.OutgoingMessageStatus
import com.fish.android.feature.chat.state.RealtimeConnectionStatus
import com.fish.android.feature.chat.state.applyChatEvents
import com.fish.android.feature.chat.state.outgoingMessageStatus
import com.fish.android.feature.chat.state.reduceChatState
import com.fish.android.feature.chat.state.unreadMessageSummary
import com.fish.android.data.chat.AuthorizedConversation
import com.fish.android.data.chat.ChatAuthState
import com.fish.android.data.chat.ChatRealtimeEvent
import com.fish.android.data.chat.ChatRepository
import com.fish.android.data.chat.ChatResult
import java.time.Instant
import java.time.Duration
import java.time.ZoneId
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class ChatViewModel(
    private val repository: ChatRepository,
    private val savedStateHandle: SavedStateHandle,
    private val formatter: ChatTextFormatter,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow<ChatRouteUiState>(ChatRouteUiState.Loading)
    val uiState: StateFlow<ChatRouteUiState> = mutableUiState.asStateFlow()

    private var chatState = ChatState()
    private var conversations: List<AuthorizedConversation> = emptyList()
    private var activeConversation: AuthorizedConversation? = null
    private var activeCollection: Job? = null
    private var draftSave: Job? = null
    private var latestNotice: String? = null
    private var lastMarkedReadMessageId: String? = null
    private var markingReadMessageId: String? = null
    private var readMarkJob: Job? = null
    private var sending = false
    private var showingConversationList = false

    init {
        viewModelScope.launch {
            repository.authState.collectLatest { auth ->
                when (auth) {
                    ChatAuthState.Loading -> mutableUiState.value = ChatRouteUiState.Loading
                    ChatAuthState.SignedOut -> {
                        activeCollection?.cancel()
                        mutableUiState.value = ChatRouteUiState.SignedOut()
                    }
                    is ChatAuthState.SignedIn -> loadConversations()
                }
            }
        }
    }

    fun updateEmail(value: String) = updateSignedOut { copy(email = value, notice = null) }
    fun updatePassword(value: String) = updateSignedOut { copy(password = value, notice = null) }

    fun signIn() {
        val state = mutableUiState.value as? ChatRouteUiState.SignedOut ?: return
        if (state.email.isBlank() || state.password.isBlank()) {
            mutableUiState.value = state.copy(notice = formatter.missingSignInCredentials)
            return
        }
        mutableUiState.value = state.copy(submitting = true, notice = null)
        viewModelScope.launch {
            when (val result = repository.signIn(state.email, state.password)) {
                is ChatResult.Success -> Unit
                is ChatResult.Failure -> mutableUiState.value = state.copy(notice = result.message)
            }
        }
    }

    fun signOut() {
        viewModelScope.launch { repository.signOut() }
    }

    fun selectConversation(conversationId: String) {
        val conversation = conversations.firstOrNull { it.conversationId == conversationId } ?: return
        showingConversationList = false
        savedStateHandle[ActiveConversationKey] = conversationId
        openConversation(conversation)
    }

    fun showConversationList() {
        if (conversations.size <= 1) return
        showingConversationList = true
        mutableUiState.value = ChatRouteUiState.ConversationList(
            conversations = conversationPreviews(),
            selectedConversationId = activeConversation?.conversationId,
            notice = latestNotice,
        )
    }

    fun retryConversation() {
        if (repository.authState.value !is ChatAuthState.SignedIn) return
        viewModelScope.launch { loadConversations() }
    }

    fun draftChanged(draft: String) {
        val conversation = activeConversation ?: return
        chatState = reduceChatState(
            chatState,
            ChatEvent.DraftChanged(conversation.conversationId, draft),
        )
        publish()
        draftSave?.cancel()
        draftSave = viewModelScope.launch {
            delay(DraftSaveDebounceMs)
            repository.saveDraft(conversation.conversationId, draft)
        }
    }

    fun sendMessage() {
        val conversation = activeConversation ?: return
        val state = chatState.conversations[conversation.conversationId] ?: return
        val body = state.composer.draft.trim()
        if (body.isEmpty() || sending || state.realtime.status == RealtimeConnectionStatus.Disconnected) return
        val failedRetry = state.messages.lastOrNull {
            it.localStatus == LocalMessageStatus.Failed && it.body == body
        }
        val requestId = failedRetry?.clientRequestId ?: UUID.randomUUID().toString()
        val optimistic = ChatMessage(
            id = failedRetry?.id ?: "local-$requestId",
            conversationId = conversation.conversationId,
            senderId = conversation.currentUserId,
            senderRole = conversation.currentUserRole,
            senderDisplayName = conversation.currentUserDisplayName,
            body = body,
            clientRequestId = requestId,
            createdAt = Instant.now().toString(),
            localStatus = LocalMessageStatus.Sending,
        )
        chatState = applyChatEvents(
            chatState,
            listOf(
                ChatEvent.SendOptimisticMessage(optimistic),
                ChatEvent.ClearComposer(conversation.conversationId),
            ),
        )
        sending = true
        publish()
        viewModelScope.launch {
            repository.saveDraft(conversation.conversationId, "")
            when (val result = repository.sendMessage(
                conversation.conversationId,
                body,
                requestId,
            )) {
                is ChatResult.Success -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.ConfirmSentMessage(result.value, requestId),
                    )
                    latestNotice = null
                }
                is ChatResult.Failure -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.MarkMessageFailed(
                            conversation.conversationId,
                            requestId,
                            result.message,
                        ),
                    )
                    latestNotice = result.message
                }
            }
            sending = false
            publish()
        }
    }

    fun loadEarlier() {
        val conversation = activeConversation ?: return
        val current = chatState.conversations[conversation.conversationId] ?: return
        val cursor = current.pagination.oldestLoadedCursor ?: return
        if (current.pagination.isLoadingOlder) return
        chatState = reduceChatState(
            chatState,
            ChatEvent.OlderMessagesRequested(conversation.conversationId),
        )
        publish()
        viewModelScope.launch {
            when (val result = repository.loadOlder(conversation.conversationId, cursor)) {
                is ChatResult.Success -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.OlderPageLoaded(
                            conversationId = conversation.conversationId,
                            messages = result.value.messages,
                            hasMoreOlder = result.value.hasMoreOlder,
                            oldestCursor = result.value.oldestCursor,
                        ),
                    )
                }
                is ChatResult.Failure -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.OlderPageLoadFailed(conversation.conversationId),
                    )
                }
            }
            publish()
        }
    }

    private suspend fun loadConversations() {
        mutableUiState.value = ChatRouteUiState.Loading
        when (val result = repository.listAuthorizedConversations()) {
            is ChatResult.Failure -> {
                latestNotice = result.message
                mutableUiState.value = ChatRouteUiState.Conversation(
                    model = ChatUiModel(ChatScreenState.Unavailable),
                    draft = "",
                    notice = result.message,
                )
            }
            is ChatResult.Success -> {
                conversations = result.value
                val restoredId = savedStateHandle.get<String>(ActiveConversationKey)
                val selected = conversations.firstOrNull { it.conversationId == restoredId }
                    ?: conversations.firstOrNull()
                if (selected == null) {
                    mutableUiState.value = ChatRouteUiState.Conversation(
                        model = ChatUiModel(ChatScreenState.Unavailable),
                        draft = "",
                    )
                } else {
                    selectConversation(selected.conversationId)
                }
            }
        }
    }

    private fun openConversation(conversation: AuthorizedConversation) {
        activeCollection?.cancel()
        readMarkJob?.cancel()
        showingConversationList = false
        activeConversation = conversation
        lastMarkedReadMessageId = null
        markingReadMessageId = null
        mutableUiState.value = ChatRouteUiState.Conversation(
            model = baseModel(conversation).copy(screenState = ChatScreenState.Loading),
            draft = "",
        )
        activeCollection = viewModelScope.launch {
            launch {
                repository.observeMessages(conversation.conversationId).collectLatest { messages ->
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.HydrateConversation(
                            conversation.conversationId,
                            messages,
                            chatState.conversations[conversation.conversationId]?.readStates.orEmpty(),
                        ),
                    )
                    publish()
                    markLatestRead(conversation, messages)
                }
            }
            launch {
                repository.observeReadStates(conversation.conversationId).collectLatest { readStates ->
                    readStates.forEach { readState ->
                        chatState = reduceChatState(
                            chatState,
                            ChatEvent.MergeReadState(conversation.conversationId, readState),
                        )
                    }
                    publish()
                }
            }
            launch {
                repository.observeDraft(conversation.conversationId).collectLatest { draft ->
                    val currentDraft = chatState.conversations[conversation.conversationId]?.composer?.draft
                    if (currentDraft.isNullOrEmpty() && draft.isNotEmpty()) {
                        chatState = reduceChatState(
                            chatState,
                            ChatEvent.DraftChanged(conversation.conversationId, draft),
                        )
                        publish()
                    }
                }
            }
            launch {
                repository.observeRealtime(conversation.conversationId).collectLatest { event ->
                    val status = when (event) {
                        ChatRealtimeEvent.Connecting -> RealtimeConnectionStatus.Connecting
                        ChatRealtimeEvent.Connected -> RealtimeConnectionStatus.Connected
                        ChatRealtimeEvent.Disconnected -> RealtimeConnectionStatus.Disconnected
                        ChatRealtimeEvent.ConversationUnavailable -> null
                        else -> null
                    }
                    if (event == ChatRealtimeEvent.ConversationUnavailable) {
                        handleConversationUnavailable(conversation.conversationId)
                        return@collectLatest
                    }
                    if (status != null) {
                        chatState = reduceChatState(
                            chatState,
                            ChatEvent.SetRealtimeStatus(conversation.conversationId, status),
                        )
                        publish()
                        if (status == RealtimeConnectionStatus.Connected) {
                            markLatestRead(
                                conversation,
                                chatState.conversations[conversation.conversationId]?.messages.orEmpty(),
                            )
                        }
                    }
                }
            }
            launch {
                when (val result = repository.syncNewest(conversation.conversationId)) {
                    is ChatResult.Success -> {
                        chatState = reduceChatState(
                            chatState,
                            ChatEvent.HydrateWindow(
                                conversationId = conversation.conversationId,
                                messages = result.value.messages,
                                readStates = result.value.readStates,
                                hasMoreOlder = result.value.hasMoreOlder,
                                oldestCursor = result.value.oldestCursor,
                            ),
                        )
                        latestNotice = null
                    }
                    is ChatResult.Failure -> latestNotice = result.message
                }
                publish()
            }
        }
    }

    private fun markLatestRead(conversation: AuthorizedConversation, messages: List<ChatMessage>) {
        val latestIncoming = messages.lastOrNull { it.senderId != conversation.currentUserId } ?: return
        if (latestIncoming.id == lastMarkedReadMessageId || latestIncoming.id == markingReadMessageId) return
        markingReadMessageId = latestIncoming.id
        readMarkJob = viewModelScope.launch {
            try {
                when (repository.markRead(
                    conversation.conversationId,
                    lastDeliveredMessageId = latestIncoming.id,
                    lastReadMessageId = latestIncoming.id,
                )) {
                    is ChatResult.Success -> lastMarkedReadMessageId = latestIncoming.id
                    is ChatResult.Failure -> Unit
                }
            } finally {
                if (markingReadMessageId == latestIncoming.id) {
                    markingReadMessageId = null
                }
            }
        }
    }

    private fun handleConversationUnavailable(conversationId: String) {
        draftSave?.cancel()
        readMarkJob?.cancel()
        conversations = conversations.filterNot { it.conversationId == conversationId }
        savedStateHandle.remove<String>(ActiveConversationKey)
        activeConversation = null
        lastMarkedReadMessageId = null
        markingReadMessageId = null
        latestNotice = formatter.conversationUnavailable
        val next = conversations.firstOrNull()
        if (next != null) {
            savedStateHandle[ActiveConversationKey] = next.conversationId
            openConversation(next)
        } else {
            mutableUiState.value = ChatRouteUiState.Conversation(
                model = ChatUiModel(ChatScreenState.Unavailable),
                draft = "",
                notice = latestNotice,
            )
            activeCollection?.cancel()
        }
    }

    private fun publish() {
        if (showingConversationList) {
            mutableUiState.value = ChatRouteUiState.ConversationList(
                conversations = conversationPreviews(),
                selectedConversationId = activeConversation?.conversationId,
                notice = latestNotice,
            )
            return
        }
        val conversation = activeConversation ?: return
        val current = chatState.conversations[conversation.conversationId]
        val model = baseModel(conversation).copy(
            screenState = ChatScreenState.Available,
            messages = current?.messages.toUiMessages(conversation, current?.readStates.orEmpty()),
            connection = when (current?.realtime?.status) {
                RealtimeConnectionStatus.Connecting -> ChatConnectionUiState.Connecting
                RealtimeConnectionStatus.Disconnected -> ChatConnectionUiState.Offline
                else -> ChatConnectionUiState.Connected
            },
            pagination = when {
                current?.pagination?.isLoadingOlder == true -> OlderMessagesUiState.Loading
                current?.pagination?.hasLoadError == true -> OlderMessagesUiState.Failed
                else -> OlderMessagesUiState.Idle
            },
            isSending = sending,
            notice = latestNotice,
        )
        mutableUiState.value = ChatRouteUiState.Conversation(
            model = model,
            draft = current?.composer?.draft.orEmpty(),
            notice = latestNotice,
        )
    }

    private fun baseModel(conversation: AuthorizedConversation): ChatUiModel =
        ChatUiModel(
            screenState = ChatScreenState.Available,
            participant = ParticipantUiModel(
                id = conversation.participantId,
                displayName = conversation.participantDisplayName,
                contextLabel = formatter.participantContext(conversation.participantRole),
            ),
            conversations = conversationPreviews(),
            selectedConversationId = conversation.conversationId,
            hasPreviousDestination = conversations.size > 1,
        )

    private fun List<ChatMessage>?.toUiMessages(
        conversation: AuthorizedConversation,
        readStates: List<com.fish.android.data.chat.model.ChatReadState>,
    ): List<MessageUiModel> {
        val messages = this.orEmpty().filter { it.body.isNotBlank() || it.deletedAt != null }
        if (messages.isEmpty()) return emptyList()
        val participantRead = readStates.firstOrNull { it.userId == conversation.participantId }
        val currentRead = readStates.firstOrNull { it.userId == conversation.currentUserId }
        val oldestUnreadId = unreadMessageSummary(messages, conversation.currentUserId, currentRead)
            .let { summary -> messages.firstOrNull { it.createdAt == summary.oldestUnreadAt }?.id }
        val latestOutgoingId = messages.lastOrNull { it.senderId == conversation.currentUserId }?.id
        return messages.mapIndexed { index, message ->
            val previous = messages.getOrNull(index - 1)
            val next = messages.getOrNull(index + 1)
            val outgoing = message.senderId == conversation.currentUserId
            MessageUiModel(
                id = message.id,
                senderName = message.senderDisplayName ?: if (outgoing) {
                    conversation.currentUserDisplayName
                } else {
                    conversation.participantDisplayName
                },
                body = message.body,
                timeLabel = formatter.timeLabel(message.createdAt),
                isOutgoing = outgoing,
                delivery = if (outgoing && message.id == latestOutgoingId) {
                    when (message.localStatus) {
                        LocalMessageStatus.Sending,
                        LocalMessageStatus.Pending,
                        -> MessageDeliveryUiState.Sending
                        LocalMessageStatus.Failed -> MessageDeliveryUiState.Failed
                        else -> when (outgoingMessageStatus(message, messages, participantRead)) {
                            OutgoingMessageStatus.Sent -> MessageDeliveryUiState.Sent
                            OutgoingMessageStatus.Delivered -> MessageDeliveryUiState.Delivered
                            OutgoingMessageStatus.Read -> MessageDeliveryUiState.Read
                        }
                    }
                } else {
                    null
                },
                groupedWithPrevious = previous?.senderId == message.senderId &&
                    previous.createdAt.isNear(message.createdAt),
                groupedWithNext = next?.senderId == message.senderId &&
                    message.createdAt.isNear(next.createdAt),
                dateLabel = if (previous == null || !previous.createdAt.sameDayAs(message.createdAt)) {
                    formatter.dateLabel(message.createdAt)
                } else {
                    null
                },
                startsUnread = message.id == oldestUnreadId,
                deleted = message.deletedAt != null,
            )
        }
    }

    private fun conversationPreviews(): List<ConversationPreviewUiModel> = conversations.map { item ->
        ConversationPreviewUiModel(
            conversationId = item.conversationId,
            participantName = item.participantDisplayName,
            snippet = item.latestMessageText.orEmpty(),
            timeLabel = item.latestMessageCreatedAt?.let(formatter::timeLabel).orEmpty(),
            unreadCount = item.unreadCount,
        )
    }

    private fun String.sameDayAs(other: String): Boolean = runCatching {
        val zone = ZoneId.systemDefault()
        Instant.parse(this).atZone(zone).toLocalDate() == Instant.parse(other).atZone(zone).toLocalDate()
    }.getOrDefault(false)

    private fun String.isNear(other: String): Boolean = runCatching {
        sameDayAs(other) && Duration.between(Instant.parse(this), Instant.parse(other)).abs() <= GroupingWindow
    }.getOrDefault(false)

    private fun updateSignedOut(transform: ChatRouteUiState.SignedOut.() -> ChatRouteUiState.SignedOut) {
        val state = mutableUiState.value as? ChatRouteUiState.SignedOut ?: return
        mutableUiState.value = state.transform()
    }

    private companion object {
        const val ActiveConversationKey = "active_conversation_id"
        const val DraftSaveDebounceMs = 300L
        val GroupingWindow: Duration = Duration.ofMinutes(5)
    }
}
