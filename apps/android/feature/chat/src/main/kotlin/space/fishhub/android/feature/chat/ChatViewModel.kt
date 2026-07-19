package space.fishhub.android.feature.chat

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import space.fishhub.android.feature.chat.state.ChatEvent
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.feature.chat.state.ChatState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.feature.chat.state.OutgoingMessageStatus
import space.fishhub.android.feature.chat.state.RealtimeConnectionStatus
import space.fishhub.android.feature.chat.state.applyChatEvents
import space.fishhub.android.feature.chat.state.outgoingMessageStatus
import space.fishhub.android.feature.chat.state.messageSnippet
import space.fishhub.android.feature.chat.state.reduceChatState
import space.fishhub.android.feature.chat.state.unreadMessageSummary
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.GifRepository
import space.fishhub.android.data.chat.GifSearchItem
import space.fishhub.android.data.chat.GifPage
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import java.time.Instant
import java.time.Duration
import java.time.ZoneId
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

class ChatViewModel(
    private val repository: ChatRepository,
    private val savedStateHandle: SavedStateHandle,
    private val formatter: ChatTextFormatter,
    private val gifRepository: GifRepository = NoOpGifRepository,
    private val mediaCatalog: ChatMediaCatalog = ChatMediaCatalog.Empty,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow<ChatRouteUiState>(ChatRouteUiState.Loading)
    val uiState: StateFlow<ChatRouteUiState> = mutableUiState.asStateFlow()
    private val mutableAttachmentOpenRequests = MutableSharedFlow<AttachmentOpenRequest>(extraBufferCapacity = 1)
    val attachmentOpenRequests: SharedFlow<AttachmentOpenRequest> =
        mutableAttachmentOpenRequests.asSharedFlow()

    private var chatState = ChatState()
    private var conversations: List<AuthorizedConversation> = emptyList()
    private var currentUser: AuthorizedChatIdentity? = null
    private var activeConversation: AuthorizedConversation? = null
    private var activeCollection: Job? = null
    private var directoryRefreshJob: Job? = null
    private var draftSave: Job? = null
    private var latestNotice: String? = null
    private var lastMarkedReadMessageId: String? = null
    private var markingReadMessageId: String? = null
    private var readMarkJob: Job? = null
    private var sending = false
    private var participantTyping = false
    private var participantTypingReset: Job? = null
    private var localTyping = false
    private var localTypingReset: Job? = null
    private var focusedMessageId: String? = null
    private var pendingFocusConversationId: String? = null
    private var pendingFocusMessageId: String? = null
    private var focusRequestJob: Job? = null
    private var showingConversationList = false
    private var pendingMedia: ComposerMediaUiModel? = null
    private var pendingGifQuery: String = ""
    private var attachmentDrafts: List<LocalAttachmentUiModel> = emptyList()
    private var selectionRevision = 0L
    private val mediaJson = Json { ignoreUnknownKeys = true }
    private val refreshingAttachmentIds = mutableSetOf<String>()
    private val pendingReactionMessageIds = mutableSetOf<String>()

    init {
        viewModelScope.launch {
            repository.authState.collectLatest { auth ->
                when (auth) {
                    ChatAuthState.Loading -> mutableUiState.value = ChatRouteUiState.Loading
                    ChatAuthState.SignedOut -> {
                        activeCollection?.cancel()
                        currentUser = null
                        conversations = emptyList()
                        clearPendingMedia(recordRevision = true)
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
        if (pendingFocusConversationId != conversationId) focusedMessageId = null
        showingConversationList = false
        savedStateHandle[ActiveConversationKey] = conversationId
        openConversation(conversation)
    }

    fun focusMessage(conversationId: String, messageId: String) {
        if (conversationId.isBlank() || messageId.isBlank()) return
        pendingFocusConversationId = conversationId
        pendingFocusMessageId = messageId
        focusedMessageId = messageId
        val conversation = conversations.firstOrNull { it.conversationId == conversationId }
            ?: return
        if (activeConversation?.conversationId != conversationId || showingConversationList) {
            selectConversation(conversationId)
        } else {
            requestFocusedMessage(conversation)
        }
    }

    fun focusCurrentMessage(messageId: String) {
        val conversationId = activeConversation?.conversationId ?: return
        focusMessage(conversationId, messageId)
    }

    fun showConversationList() {
        if (conversations.size <= 1) return
        showingConversationList = true
        mutableUiState.value = ChatRouteUiState.ConversationList(
            currentUserDisplayName = currentUser?.displayName.orEmpty(),
            conversations = conversationPreviews(),
            selectedConversationId = activeConversation?.conversationId,
            notice = latestNotice,
        )
        directoryRefreshJob?.cancel()
        directoryRefreshJob = viewModelScope.launch {
            val result = repository.listAuthorizedConversations()
            if (result !is ChatResult.Success) return@launch
            currentUser = result.value.currentUser
            conversations = result.value.conversations
            val activeId = activeConversation?.conversationId
            if (activeId != null && conversations.none { it.conversationId == activeId }) {
                handleConversationUnavailable(activeId)
                return@launch
            }
            activeConversation = conversations.firstOrNull { it.conversationId == activeId }
                ?: activeConversation
            publish()
        }
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
        updateLocalTyping(draft.isNotBlank())
    }

    fun replyToMessage(messageId: String) {
        val conversation = activeConversation ?: return
        val message = chatState.conversations[conversation.conversationId]
            ?.messages
            ?.firstOrNull { it.id == messageId && it.deletedAt == null }
            ?: return
        if (message.localStatus != LocalMessageStatus.Sent) return
        chatState = reduceChatState(
            chatState,
            ChatEvent.SetReplyTarget(conversation.conversationId, messageId),
        )
        publish()
    }

    fun clearReplyTarget() {
        val conversationId = activeConversation?.conversationId ?: return
        chatState = reduceChatState(chatState, ChatEvent.SetReplyTarget(conversationId, null))
        publish()
    }

    fun editMessage(messageId: String, body: String) {
        val conversation = activeConversation ?: return
        val message = chatState.conversations[conversation.conversationId]
            ?.messages
            ?.firstOrNull { it.id == messageId }
            ?: return
        val normalized = body.trim()
        if (message.senderId != conversation.currentUserId || message.deletedAt != null ||
            message.localStatus != LocalMessageStatus.Sent || normalized.isEmpty() ||
            normalized.codePoints().count() > MessageBodyLimit
        ) return
        viewModelScope.launch {
            latestNotice = when (val result = repository.editMessage(messageId, normalized)) {
                is ChatResult.Success -> null
                is ChatResult.Failure -> result.message
            }
            publish()
        }
    }

    fun deleteMessage(messageId: String) {
        val conversation = activeConversation ?: return
        val message = chatState.conversations[conversation.conversationId]
            ?.messages
            ?.firstOrNull { it.id == messageId }
            ?: return
        if (message.senderId != conversation.currentUserId || message.deletedAt != null ||
            message.localStatus != LocalMessageStatus.Sent
        ) return
        viewModelScope.launch {
            latestNotice = when (val result = repository.deleteMessage(messageId)) {
                is ChatResult.Success -> null
                is ChatResult.Failure -> result.message
            }
            publish()
        }
    }

    fun removeFriend() = runFriendSafetyAction(block = false)

    fun blockParticipant() = runFriendSafetyAction(block = true)

    private fun runFriendSafetyAction(block: Boolean) {
        val conversation = activeConversation ?: return
        if (conversation.currentUserRole != space.fishhub.android.data.chat.model.UserRole.Client ||
            conversation.participantRole != space.fishhub.android.data.chat.model.UserRole.Client
        ) return
        viewModelScope.launch {
            val result = if (block) {
                repository.blockUser(conversation.participantId)
            } else {
                repository.removeFriend(conversation.participantId)
            }
            when (result) {
                is ChatResult.Success -> handleConversationUnavailable(conversation.conversationId)
                is ChatResult.Failure -> {
                    latestNotice = result.message
                    publish()
                }
            }
        }
    }

    fun toggleReaction(messageId: String, emoji: String) {
        val message = activeConversation?.let { conversation ->
            chatState.conversations[conversation.conversationId]
                ?.messages
                ?.firstOrNull { it.id == messageId }
        } ?: return
        if (message.deletedAt != null || message.localStatus != LocalMessageStatus.Sent || emoji.isBlank()) return
        if (!pendingReactionMessageIds.add(messageId)) return
        val active = message.reactions.none { reaction ->
            reaction.emoji == emoji && reaction.byMe
        }
        publish()
        viewModelScope.launch {
            try {
                latestNotice = when (
                    val result = repository.setReaction(messageId, emoji, active)
                ) {
                    is ChatResult.Success -> null
                    is ChatResult.Failure -> result.message
                }
            } finally {
                pendingReactionMessageIds.remove(messageId)
                publish()
            }
        }
    }

    fun selectGif(item: GifSearchItem, query: String) {
        if (!canSelectMedia()) return
        selectionRevision += 1
        pendingMedia = ComposerMediaUiModel.Gif(GifUiModel.from(item.chatGif))
        pendingGifQuery = query
        persistPendingMedia()
        publish()
    }

    fun selectSticker(sticker: StickerCatalogItem) {
        if (!canSelectMedia() || !mediaCatalog.isKnownSticker(sticker.id)) return
        selectionRevision += 1
        pendingMedia = ComposerMediaUiModel.Sticker(sticker.toUiModel())
        pendingGifQuery = ""
        persistPendingMedia()
        publish()
    }

    fun removePendingMedia() {
        clearPendingMedia(recordRevision = true)
        publish()
    }

    fun commitAttachmentPreview() {
        val conversationId = activeConversation?.conversationId ?: return
        viewModelScope.launch { repository.commitAttachmentPreview(conversationId) }
    }

    fun retryAttachmentDraft(attachmentId: String) {
        val conversationId = activeConversation?.conversationId ?: return
        viewModelScope.launch { repository.retryAttachmentDraft(conversationId, attachmentId) }
    }

    fun discardAttachmentPreview() {
        val conversationId = activeConversation?.conversationId ?: return
        viewModelScope.launch { repository.discardAttachmentPreview(conversationId) }
    }

    fun removeAttachmentDraft(attachmentId: String) {
        val conversationId = activeConversation?.conversationId ?: return
        viewModelScope.launch { repository.removeAttachmentDraft(conversationId, attachmentId) }
    }

    fun sendMessage() {
        val conversation = activeConversation ?: return
        val state = chatState.conversations[conversation.conversationId] ?: return
        val body = state.composer.draft.trim()
        val selectedMedia = pendingMedia
        val selectedAttachments = attachmentDrafts
            .filterNot { it.inPreview }
            .sortedWith(compareBy({ it.position }, { it.id }))
        if ((body.isEmpty() && selectedMedia == null && selectedAttachments.isEmpty()) || sending ||
            state.realtime.status == RealtimeConnectionStatus.Disconnected
        ) return
        if (selectedAttachments.any { !it.ready } ||
            selectedAttachments.any { it.serverAttachmentId == null }
        ) {
            latestNotice = formatter.attachmentsNotReady
            publish()
            return
        }
        val selectedGif = (selectedMedia as? ComposerMediaUiModel.Gif)?.value?.toChatGif()
        val selectedStickerId = (selectedMedia as? ComposerMediaUiModel.Sticker)?.value?.id
        val selectedAttachmentIds = selectedAttachments.mapNotNull { it.serverAttachmentId }
        val replyTargetId = state.composer.replyTargetId
        val failedRetry = state.messages.lastOrNull {
            it.localStatus == LocalMessageStatus.Failed &&
                it.body == body &&
                it.gif?.providerId == selectedGif?.providerId &&
                it.stickerId == selectedStickerId &&
                it.attachments.map { attachment -> attachment.id } == selectedAttachmentIds &&
                it.replyToMessageId == replyTargetId
        }
        val requestId = failedRetry?.clientRequestId ?: UUID.randomUUID().toString()
        val sentRevision = selectionRevision
        val sentGifQuery = pendingGifQuery
        val optimistic = ChatMessage(
            id = failedRetry?.id ?: "local-$requestId",
            conversationId = conversation.conversationId,
            senderId = conversation.currentUserId,
            senderRole = conversation.currentUserRole,
            senderDisplayName = conversation.currentUserDisplayName,
            body = body,
            gif = selectedGif,
            stickerId = selectedStickerId,
            attachments = selectedAttachments.map { attachment ->
                ChatAttachment(
                    id = checkNotNull(attachment.serverAttachmentId),
                    position = attachment.position,
                    kind = if (attachment.isPhoto) ChatAttachmentKind.Image else ChatAttachmentKind.File,
                    originalName = attachment.name,
                    mimeType = attachment.mimeType,
                    byteSize = attachment.byteSize,
                    width = attachment.width,
                    height = attachment.height,
                    thumbnailUrl = attachment.thumbnailPath,
                    displayUrl = attachment.localPath,
                )
            },
            clientRequestId = requestId,
            createdAt = Instant.now().toString(),
            replyToMessageId = replyTargetId,
            localStatus = LocalMessageStatus.Sending,
        )
        clearPendingMedia(recordRevision = false)
        chatState = applyChatEvents(
            chatState,
            listOf(
                ChatEvent.SendOptimisticMessage(optimistic),
                ChatEvent.ClearComposer(conversation.conversationId),
            ),
        )
        sending = true
        stopLocalTyping()
        publish()
        viewModelScope.launch {
            repository.saveDraft(conversation.conversationId, "")
            when (val result = repository.sendMessage(
                conversation.conversationId,
                OutgoingMessageContent(
                    body = body,
                    gif = selectedGif,
                    stickerId = selectedStickerId,
                    attachmentIds = selectedAttachmentIds,
                    replyToMessageId = replyTargetId,
                ),
                requestId,
            )) {
                is ChatResult.Success -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.ConfirmSentMessage(result.value, requestId),
                    )
                    latestNotice = null
                    selectedGif?.let { gif ->
                        viewModelScope.launch { gifRepository.registerShare(gif, sentGifQuery) }
                    }
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
                    if (selectionRevision == sentRevision && pendingMedia == null) {
                        pendingMedia = selectedMedia
                        pendingGifQuery = sentGifQuery
                        persistPendingMedia()
                    }
                    val currentDraft = chatState.conversations[conversation.conversationId]
                        ?.composer?.draft.orEmpty()
                    if (currentDraft.isBlank() && body.isNotBlank()) {
                        chatState = reduceChatState(
                            chatState,
                            ChatEvent.DraftChanged(conversation.conversationId, body),
                        )
                        repository.saveDraft(conversation.conversationId, body)
                    }
                    if (replyTargetId != null) {
                        chatState = reduceChatState(
                            chatState,
                            ChatEvent.SetReplyTarget(conversation.conversationId, replyTargetId),
                        )
                    }
                    latestNotice = result.message
                }
            }
            sending = false
            publish()
        }
    }

    fun retryMessage(messageId: String) {
        val conversation = activeConversation ?: return
        val state = chatState.conversations[conversation.conversationId] ?: return
        val failed = state.messages.firstOrNull {
            it.id == messageId && it.localStatus == LocalMessageStatus.Failed
        } ?: return
        if (sending || state.realtime.status == RealtimeConnectionStatus.Disconnected) return
        sending = true
        chatState = reduceChatState(chatState, ChatEvent.SendOptimisticMessage(failed))
        publish()
        viewModelScope.launch {
            val content = OutgoingMessageContent(
                body = failed.body,
                gif = failed.gif,
                stickerId = failed.stickerId,
                attachmentIds = failed.attachments.sortedBy { it.position }.map { it.id },
                replyToMessageId = failed.replyToMessageId,
            )
            when (val result = repository.sendMessage(
                conversation.conversationId,
                content,
                failed.clientRequestId,
            )) {
                is ChatResult.Success -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.ConfirmSentMessage(result.value, failed.clientRequestId),
                    )
                    latestNotice = null
                    failed.gif?.let { gif ->
                        viewModelScope.launch { gifRepository.registerShare(gif) }
                    }
                }
                is ChatResult.Failure -> {
                    chatState = reduceChatState(
                        chatState,
                        ChatEvent.MarkMessageFailed(
                            conversation.conversationId,
                            failed.clientRequestId,
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

    fun reportGif(messageId: String) {
        viewModelScope.launch {
            latestNotice = when (val result = repository.reportGif(messageId)) {
                is ChatResult.Success -> "GIF reported. Thank you."
                is ChatResult.Failure -> result.message
            }
            publish()
        }
    }

    fun refreshAttachment(attachmentId: String) {
        if (!refreshingAttachmentIds.add(attachmentId)) return
        viewModelScope.launch {
            when (val result = repository.refreshAttachmentUrls(listOf(attachmentId))) {
                is ChatResult.Success -> Unit
                is ChatResult.Failure -> {
                    latestNotice = result.message
                    publish()
                }
            }
            refreshingAttachmentIds -= attachmentId
        }
    }

    fun openFileAttachment(attachmentId: String) {
        val attachment = findAttachment(attachmentId)
        val mimeType = attachment?.mimeType
        val byteSize = attachment?.byteSize
        if (
            attachment == null || attachment.kind != space.fishhub.android.data.chat.model.ChatAttachmentKind.File ||
            !attachment.available || mimeType == null || byteSize == null
        ) return
        if (!refreshingAttachmentIds.add(attachmentId)) return
        viewModelScope.launch {
            when (val result = repository.refreshAttachmentUrls(listOf(attachmentId))) {
                is ChatResult.Success -> {
                    val delivery = result.value.firstOrNull { it.attachmentId == attachmentId }
                    val signedUrl = delivery?.displayUrl
                    if (signedUrl != null) {
                        latestNotice = null
                        mutableAttachmentOpenRequests.emit(
                            AttachmentOpenRequest(
                                attachmentId = attachment.id,
                                name = attachment.originalName,
                                mimeType = mimeType,
                                expectedByteSize = byteSize,
                                signedUrl = signedUrl,
                            ),
                        )
                    } else {
                        latestNotice = formatter.attachmentUnavailable
                        publish()
                    }
                }
                is ChatResult.Failure -> {
                    latestNotice = result.message
                    publish()
                }
            }
            refreshingAttachmentIds -= attachmentId
        }
    }

    fun attachmentOpenFailed(message: String) {
        latestNotice = message
        publish()
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
                    model = ChatUiModel(
                        ChatScreenState.Unavailable,
                        currentUserDisplayName = currentUser?.displayName.orEmpty(),
                    ),
                    draft = "",
                    notice = result.message,
                )
            }
            is ChatResult.Success -> {
                currentUser = result.value.currentUser
                conversations = result.value.conversations
                val restoredId = savedStateHandle.get<String>(ActiveConversationKey)
                val selected = conversations.firstOrNull {
                    it.conversationId == pendingFocusConversationId
                } ?: conversations.firstOrNull { it.conversationId == restoredId }
                    ?: conversations.firstOrNull()
                if (selected == null) {
                    mutableUiState.value = ChatRouteUiState.Conversation(
                        model = ChatUiModel(
                            ChatScreenState.Unavailable,
                            currentUserDisplayName = currentUser?.displayName.orEmpty(),
                        ),
                        draft = "",
                    )
                } else {
                    selectConversation(selected.conversationId)
                }
            }
        }
    }

    private fun openConversation(conversation: AuthorizedConversation) {
        val previousConversationId = activeConversation?.conversationId
        if (previousConversationId != null && previousConversationId != conversation.conversationId) {
            stopLocalTyping(previousConversationId)
        }
        participantTypingReset?.cancel()
        participantTyping = false
        if (previousConversationId != null && previousConversationId != conversation.conversationId) {
            clearPendingMedia(recordRevision = true)
            attachmentDrafts = emptyList()
        } else if (previousConversationId == null) {
            restorePendingMedia(conversation.conversationId)
        }
        activeCollection?.cancel()
        readMarkJob?.cancel()
        showingConversationList = false
        activeConversation = conversation
        lastMarkedReadMessageId = null
        markingReadMessageId = null
        mutableUiState.value = ChatRouteUiState.Conversation(
            model = baseModel(conversation).copy(screenState = ChatScreenState.Loading),
            draft = "",
            pendingMedia = pendingMedia,
            pendingGifQuery = pendingGifQuery,
            attachmentDrafts = attachmentDrafts,
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
                repository.observeAttachmentDrafts(conversation.conversationId).collectLatest { drafts ->
                    attachmentDrafts = drafts.map(LocalAttachmentUiModel::from)
                    publish()
                }
            }
            launch {
                repository.observeRealtime(conversation.conversationId).collectLatest { event ->
                    if (event is ChatRealtimeEvent.TypingChanged) {
                        participantTypingReset?.cancel()
                        participantTyping = event.typing
                        if (event.typing) {
                            participantTypingReset = viewModelScope.launch {
                                delay(ParticipantTypingTimeoutMs)
                                participantTyping = false
                                publish()
                            }
                        }
                        publish()
                        return@collectLatest
                    }
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
        requestFocusedMessage(conversation)
    }

    private fun requestFocusedMessage(conversation: AuthorizedConversation) {
        val messageId = pendingFocusMessageId ?: return
        if (pendingFocusConversationId != conversation.conversationId) return
        focusRequestJob?.cancel()
        focusRequestJob = viewModelScope.launch {
            val alreadyLoaded = chatState.conversations[conversation.conversationId]
                ?.messages
                ?.any { it.id == messageId } == true
            if (!alreadyLoaded) {
                when (val result = repository.refreshMessages(
                    conversation.conversationId,
                    listOf(messageId),
                )) {
                    is ChatResult.Success -> {
                        result.value.forEach { message ->
                            chatState = reduceChatState(
                                chatState,
                                ChatEvent.MergeRemoteMessage(message),
                            )
                        }
                        if (result.value.none { it.id == messageId }) {
                            focusedMessageId = null
                            latestNotice = formatter.messageUnavailable
                        }
                    }
                    is ChatResult.Failure -> latestNotice = result.message
                }
            }
            if (pendingFocusMessageId == messageId) {
                pendingFocusConversationId = null
                pendingFocusMessageId = null
            }
            publish()
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
                model = ChatUiModel(
                    ChatScreenState.Unavailable,
                    currentUserDisplayName = currentUser?.displayName.orEmpty(),
                ),
                draft = "",
                notice = latestNotice,
            )
            activeCollection?.cancel()
        }
    }

    private fun publish() {
        if (showingConversationList) {
            mutableUiState.value = ChatRouteUiState.ConversationList(
                currentUserDisplayName = currentUser?.displayName.orEmpty(),
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
                RealtimeConnectionStatus.Connecting -> if (current.realtime.hasConnected) {
                    ChatConnectionUiState.Reconnecting
                } else {
                    ChatConnectionUiState.Connecting
                }
                RealtimeConnectionStatus.Disconnected -> ChatConnectionUiState.Offline
                else -> ChatConnectionUiState.Connected
            },
            pagination = when {
                current?.pagination?.isLoadingOlder == true -> OlderMessagesUiState.Loading
                current?.pagination?.hasLoadError == true -> OlderMessagesUiState.Failed
                else -> OlderMessagesUiState.Idle
            },
            hasMoreOlder = current?.pagination?.hasMoreOlder == true,
            typingParticipantName = conversation.participantDisplayName.takeIf { participantTyping },
            replyTarget = current?.composer?.replyTargetId?.let { targetId ->
                current.messages.firstOrNull { it.id == targetId }?.toReplyPreview(conversation)
            },
            focusedMessageId = focusedMessageId,
            isSending = sending,
            notice = latestNotice,
        )
        mutableUiState.value = ChatRouteUiState.Conversation(
            model = model,
            draft = current?.composer?.draft.orEmpty(),
            pendingMedia = pendingMedia,
            pendingGifQuery = pendingGifQuery,
            attachmentDrafts = attachmentDrafts,
            notice = latestNotice,
        )
    }

    private fun baseModel(conversation: AuthorizedConversation): ChatUiModel =
        ChatUiModel(
            screenState = ChatScreenState.Available,
            currentUserDisplayName = currentUser?.displayName
                ?: conversation.currentUserDisplayName,
            participant = ParticipantUiModel(
                id = conversation.participantId,
                displayName = conversation.participantDisplayName,
                contextLabel = formatter.participantContext(conversation.participantRole),
                username = conversation.participantUsername,
                avatarUrl = conversation.participantAvatarUrl,
                friendSafetyAvailable = conversation.currentUserRole ==
                    space.fishhub.android.data.chat.model.UserRole.Client &&
                    conversation.participantRole ==
                    space.fishhub.android.data.chat.model.UserRole.Client,
            ),
            conversations = conversationPreviews(),
            selectedConversationId = conversation.conversationId,
            hasPreviousDestination = conversations.size > 1,
        )

    private fun List<ChatMessage>?.toUiMessages(
        conversation: AuthorizedConversation,
        readStates: List<space.fishhub.android.data.chat.model.ChatReadState>,
    ): List<MessageUiModel> {
        val messages = this.orEmpty().filter {
            it.body.isNotBlank() || it.gif != null || it.gifUnavailable ||
                it.stickerId != null || it.attachments.isNotEmpty() || it.deletedAt != null
        }
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
                delivery = if (outgoing && message.localStatus == LocalMessageStatus.Failed) {
                    MessageDeliveryUiState.Failed
                } else if (outgoing && message.id == latestOutgoingId) {
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
                edited = message.editedAt != null,
                replyPreview = message.replyToMessageId?.let { targetId ->
                    messages.firstOrNull { it.id == targetId }?.toReplyPreview(conversation)
                        ?: ReplyPreviewUiModel(
                            messageId = targetId,
                            authorName = "",
                            snippet = formatter.messageUnavailable,
                        )
                },
                reactions = message.reactions.map { reaction ->
                    ReactionUiModel(reaction.emoji, reaction.count, reaction.byMe)
                },
                actionsEnabled = message.localStatus == LocalMessageStatus.Sent &&
                    message.deletedAt == null,
                reactionsEnabled = message.localStatus == LocalMessageStatus.Sent &&
                    message.deletedAt == null && message.id !in pendingReactionMessageIds,
                canEdit = outgoing && message.localStatus == LocalMessageStatus.Sent &&
                    message.deletedAt == null && message.body.isNotBlank(),
                canDelete = outgoing && message.localStatus == LocalMessageStatus.Sent &&
                    message.deletedAt == null,
                gif = message.gif?.let(GifUiModel::from),
                gifUnavailable = message.gifUnavailable,
                attachments = message.attachments
                    .sortedWith(compareBy({ it.position }, { it.id }))
                    .map(AttachmentUiModel::from),
                sticker = message.stickerId?.let(::stickerUiModel),
            )
        }
    }

    private fun findAttachment(attachmentId: String) = activeConversation?.let { conversation ->
        chatState.conversations[conversation.conversationId]?.messages
            ?.asSequence()
            ?.flatMap { it.attachments.asSequence() }
            ?.firstOrNull { it.id == attachmentId }
    }

    private fun ChatMessage.toReplyPreview(
        conversation: AuthorizedConversation,
    ): ReplyPreviewUiModel = ReplyPreviewUiModel(
        messageId = id,
        authorName = if (senderId == conversation.currentUserId) {
            conversation.currentUserDisplayName
        } else {
            conversation.participantDisplayName
        },
        snippet = messageSnippet(this),
    )

    private fun updateLocalTyping(hasDraft: Boolean) {
        val conversation = activeConversation ?: return
        localTypingReset?.cancel()
        if (!hasDraft) {
            stopLocalTyping(conversation.conversationId)
            return
        }
        if (!localTyping) {
            localTyping = true
            viewModelScope.launch { repository.sendTyping(conversation.conversationId, true) }
        }
        localTypingReset = viewModelScope.launch {
            delay(LocalTypingTimeoutMs)
            stopLocalTyping(conversation.conversationId)
        }
    }

    private fun stopLocalTyping(conversationId: String? = activeConversation?.conversationId) {
        localTypingReset?.cancel()
        localTypingReset = null
        if (!localTyping || conversationId == null) return
        localTyping = false
        viewModelScope.launch { repository.sendTyping(conversationId, false) }
    }

    private fun conversationPreviews(): List<ConversationPreviewUiModel> = conversations.map { item ->
        val local = chatState.conversations[item.conversationId]
        val latest = local?.messages?.lastOrNull()
        val currentRead = local?.readStates?.firstOrNull { it.userId == item.currentUserId }
        ConversationPreviewUiModel(
            conversationId = item.conversationId,
            participantName = item.participantDisplayName,
            snippet = latest?.let(::messageSnippet) ?: item.latestMessageText.orEmpty(),
            timeLabel = (latest?.createdAt ?: item.latestMessageCreatedAt)
                ?.let(formatter::timeLabel)
                .orEmpty(),
            unreadCount = if (local == null) {
                item.unreadCount
            } else {
                unreadMessageSummary(local.messages, item.currentUserId, currentRead).count
            },
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

    private fun canSelectMedia(): Boolean {
        val conversation = activeConversation ?: return false
        return attachmentDrafts.none { !it.inPreview } &&
            chatState.conversations[conversation.conversationId]?.realtime?.status !=
                RealtimeConnectionStatus.Disconnected
    }

    private fun StickerCatalogItem.toUiModel(): StickerUiModel = StickerUiModel(
        id = id,
        phrase = phrase,
        description = description,
        assetPath = assetPath,
    )

    private fun stickerUiModel(stickerId: String): StickerUiModel =
        mediaCatalog.sticker(stickerId)?.toUiModel() ?: StickerUiModel(
            id = stickerId,
            phrase = "Sticker unavailable",
            description = "Sticker unavailable",
            assetPath = null,
        )

    private fun clearPendingMedia(recordRevision: Boolean) {
        if (recordRevision) selectionRevision += 1
        pendingMedia = null
        pendingGifQuery = ""
        savedStateHandle.remove<String>(PendingConversationKey)
        savedStateHandle.remove<String>(PendingMediaKindKey)
        savedStateHandle.remove<String>(PendingMediaValueKey)
        savedStateHandle.remove<String>(PendingGifQueryKey)
    }

    private fun persistPendingMedia() {
        val conversationId = activeConversation?.conversationId ?: return
        savedStateHandle[PendingConversationKey] = conversationId
        savedStateHandle[PendingGifQueryKey] = pendingGifQuery
        when (val media = pendingMedia) {
            is ComposerMediaUiModel.Gif -> {
                savedStateHandle[PendingMediaKindKey] = "gif"
                savedStateHandle[PendingMediaValueKey] = mediaJson.encodeToString(media.value.toChatGif())
            }
            is ComposerMediaUiModel.Sticker -> {
                savedStateHandle[PendingMediaKindKey] = "sticker"
                savedStateHandle[PendingMediaValueKey] = media.value.id
            }
            null -> Unit
        }
    }

    private fun restorePendingMedia(conversationId: String) {
        if (savedStateHandle.get<String>(PendingConversationKey) != conversationId) {
            clearPendingMedia(recordRevision = false)
            return
        }
        pendingGifQuery = savedStateHandle.get<String>(PendingGifQueryKey).orEmpty()
        val value = savedStateHandle.get<String>(PendingMediaValueKey)
        pendingMedia = when (savedStateHandle.get<String>(PendingMediaKindKey)) {
            "gif" -> value?.let { encoded ->
                runCatching { mediaJson.decodeFromString<ChatGif>(encoded) }.getOrNull()
            }?.let { ComposerMediaUiModel.Gif(GifUiModel.from(it)) }
            "sticker" -> value?.let(mediaCatalog::sticker)?.toUiModel()
                ?.let { ComposerMediaUiModel.Sticker(it) }
            else -> null
        }
    }

    private companion object {
        const val ActiveConversationKey = "active_conversation_id"
        const val DraftSaveDebounceMs = 300L
        const val MessageBodyLimit = 4_000L
        const val LocalTypingTimeoutMs = 3_000L
        const val ParticipantTypingTimeoutMs = 5_000L
        const val PendingConversationKey = "pending_media_conversation_id"
        const val PendingMediaKindKey = "pending_media_kind"
        const val PendingMediaValueKey = "pending_media_value"
        const val PendingGifQueryKey = "pending_gif_query"
        val GroupingWindow: Duration = Duration.ofMinutes(5)
    }
}

private object NoOpGifRepository : GifRepository {
    override val available: Boolean = false
    override suspend fun trending(cursor: String?, limit: Int): GifPage = GifPage(emptyList(), null)
    override suspend fun search(query: String, cursor: String?, limit: Int): GifPage =
        GifPage(emptyList(), null)
    override suspend fun registerShare(gif: ChatGif, query: String?) = Unit
}
