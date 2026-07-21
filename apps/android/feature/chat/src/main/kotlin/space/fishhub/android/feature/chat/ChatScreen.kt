package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.feature.chat.component.ConversationRow
import space.fishhub.android.core.designsystem.component.FishDivider
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.presence.PresencePresentation
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter

@Composable
fun ChatAdaptiveLayout(
    model: ChatUiModel,
    composerState: TextFieldState,
    onSend: () -> Unit,
    onBack: () -> Unit,
    onRetryEarlier: () -> Unit,
    onSelectConversation: (String) -> Unit,
    emojiCatalog: ChatMediaCatalog = ChatMediaCatalog.Empty,
    pendingMedia: ComposerMediaUiModel? = null,
    onOpenMediaPicker: () -> Unit = {},
    onRemovePendingMedia: () -> Unit = {},
    pendingAttachments: List<LocalAttachmentUiModel> = emptyList(),
    onOpenAttachmentPicker: () -> Unit = {},
    onRemovePendingAttachment: (String) -> Unit = {},
    onRetryPendingAttachment: (String) -> Unit = {},
    onRetryMessage: (String) -> Unit = {},
    onCopyMessage: (String) -> Unit = {},
    onReportGif: (String) -> Unit = {},
    onReplyMessage: (String) -> Unit = {},
    onEditMessage: (String, String) -> Unit = { _, _ -> },
    onDeleteMessage: (String) -> Unit = {},
    onToggleReaction: (String, String) -> Unit = { _, _ -> },
    onFocusMessage: (String) -> Unit = {},
    onClearReplyTarget: () -> Unit = {},
    onRemoveFriend: () -> Unit = {},
    onBlockParticipant: () -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onRetryConversation: () -> Unit = {},
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    onOpenMessageSearch: () -> Unit = {},
    voiceRecording: VoiceRecordingUiState = VoiceRecordingUiState(),
    voiceRecordingEnabled: Boolean = false,
    onStartVoiceRecording: () -> Unit = {},
    onFinishVoiceRecording: () -> Unit = {},
    onCancelVoiceRecording: () -> Unit = {},
    participantPresence: PresencePresentation = PresencePresentation(),
    accountContent: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
    ) {
        val showConversationList =
            maxWidth >= FishTheme.layout.twoPaneBreakpoint && model.conversations.size > 1
        if (showConversationList) {
            Row(Modifier.fillMaxSize()) {
                ConversationRail(
                    conversations = model.conversations,
                    selectedConversationId = model.selectedConversationId,
                    onSelect = onSelectConversation,
                    modifier = Modifier.width(FishTheme.sizes.conversationRail),
                )
                Box(Modifier.width(FishTheme.spacing.threeXs)) { FishDivider() }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    ChatScreen(
                        model = model.copy(hasPreviousDestination = false),
                        composerState = composerState,
                        emojiCatalog = emojiCatalog,
                        onSend = onSend,
                        onBack = onBack,
                        onRetryEarlier = onRetryEarlier,
                        onRetryConversation = onRetryConversation,
                        pendingMedia = pendingMedia,
                        onOpenMediaPicker = onOpenMediaPicker,
                        onRemovePendingMedia = onRemovePendingMedia,
                        pendingAttachments = pendingAttachments,
                        onOpenAttachmentPicker = onOpenAttachmentPicker,
                        onRemovePendingAttachment = onRemovePendingAttachment,
                        onRetryPendingAttachment = onRetryPendingAttachment,
                        onRetryMessage = onRetryMessage,
                        onCopyMessage = onCopyMessage,
                        onReportGif = onReportGif,
                        onReplyMessage = onReplyMessage,
                        onEditMessage = onEditMessage,
                        onDeleteMessage = onDeleteMessage,
                        onToggleReaction = onToggleReaction,
                        onFocusMessage = onFocusMessage,
                        onClearReplyTarget = onClearReplyTarget,
                        onRemoveFriend = onRemoveFriend,
                        onBlockParticipant = onBlockParticipant,
                        onPhotoAttachmentClick = onPhotoAttachmentClick,
                        onFileAttachmentClick = onFileAttachmentClick,
                        onAttachmentLoadError = onAttachmentLoadError,
                        onStartAudioCall = onStartAudioCall,
                        onStartVideoCall = onStartVideoCall,
                        onOpenMessageSearch = onOpenMessageSearch,
                        voiceRecording = voiceRecording,
                        voiceRecordingEnabled = voiceRecordingEnabled,
                        onStartVoiceRecording = onStartVoiceRecording,
                        onFinishVoiceRecording = onFinishVoiceRecording,
                        onCancelVoiceRecording = onCancelVoiceRecording,
                        participantPresence = participantPresence,
                        accountContent = accountContent,
                        modifier = Modifier
                            .fillMaxHeight()
                            .widthIn(max = FishTheme.sizes.chatContentMax),
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.TopCenter,
            ) {
                ChatScreen(
                    model = model,
                    composerState = composerState,
                    emojiCatalog = emojiCatalog,
                    onSend = onSend,
                    onBack = onBack,
                    onRetryEarlier = onRetryEarlier,
                    onRetryConversation = onRetryConversation,
                    pendingMedia = pendingMedia,
                    onOpenMediaPicker = onOpenMediaPicker,
                    onRemovePendingMedia = onRemovePendingMedia,
                    pendingAttachments = pendingAttachments,
                    onOpenAttachmentPicker = onOpenAttachmentPicker,
                    onRemovePendingAttachment = onRemovePendingAttachment,
                    onRetryPendingAttachment = onRetryPendingAttachment,
                    onRetryMessage = onRetryMessage,
                    onCopyMessage = onCopyMessage,
                    onReportGif = onReportGif,
                    onReplyMessage = onReplyMessage,
                    onEditMessage = onEditMessage,
                    onDeleteMessage = onDeleteMessage,
                    onToggleReaction = onToggleReaction,
                    onFocusMessage = onFocusMessage,
                    onClearReplyTarget = onClearReplyTarget,
                    onRemoveFriend = onRemoveFriend,
                    onBlockParticipant = onBlockParticipant,
                    onPhotoAttachmentClick = onPhotoAttachmentClick,
                    onFileAttachmentClick = onFileAttachmentClick,
                    onAttachmentLoadError = onAttachmentLoadError,
                    onStartAudioCall = onStartAudioCall,
                    onStartVideoCall = onStartVideoCall,
                    onOpenMessageSearch = onOpenMessageSearch,
                    voiceRecording = voiceRecording,
                    voiceRecordingEnabled = voiceRecordingEnabled,
                    onStartVoiceRecording = onStartVoiceRecording,
                    onFinishVoiceRecording = onFinishVoiceRecording,
                    onCancelVoiceRecording = onCancelVoiceRecording,
                    participantPresence = participantPresence,
                    accountContent = accountContent,
                    modifier = Modifier
                        .fillMaxSize()
                        .widthIn(max = FishTheme.sizes.chatContentMax),
                )
            }
        }
    }
}

@Composable
fun ChatScreen(
    model: ChatUiModel,
    composerState: TextFieldState,
    onSend: () -> Unit,
    onBack: () -> Unit,
    onRetryEarlier: () -> Unit,
    emojiCatalog: ChatMediaCatalog = ChatMediaCatalog.Empty,
    onRetryConversation: () -> Unit = {},
    pendingMedia: ComposerMediaUiModel? = null,
    onOpenMediaPicker: () -> Unit = {},
    onRemovePendingMedia: () -> Unit = {},
    pendingAttachments: List<LocalAttachmentUiModel> = emptyList(),
    onOpenAttachmentPicker: () -> Unit = {},
    onRemovePendingAttachment: (String) -> Unit = {},
    onRetryPendingAttachment: (String) -> Unit = {},
    onRetryMessage: (String) -> Unit = {},
    onCopyMessage: (String) -> Unit = {},
    onReportGif: (String) -> Unit = {},
    onReplyMessage: (String) -> Unit = {},
    onEditMessage: (String, String) -> Unit = { _, _ -> },
    onDeleteMessage: (String) -> Unit = {},
    onToggleReaction: (String, String) -> Unit = { _, _ -> },
    onFocusMessage: (String) -> Unit = {},
    onClearReplyTarget: () -> Unit = {},
    onRemoveFriend: () -> Unit = {},
    onBlockParticipant: () -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    onOpenMessageSearch: () -> Unit = {},
    voiceRecording: VoiceRecordingUiState = VoiceRecordingUiState(),
    voiceRecordingEnabled: Boolean = false,
    onStartVoiceRecording: () -> Unit = {},
    onFinishVoiceRecording: () -> Unit = {},
    onCancelVoiceRecording: () -> Unit = {},
    participantPresence: PresencePresentation = PresencePresentation(),
    accountContent: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var selectedMessageId by remember(model.selectedConversationId) { mutableStateOf<String?>(null) }
    var showReactionsInitially by remember(model.selectedConversationId) {
        mutableStateOf(false)
    }
    var participantDetailsVisible by remember(model.selectedConversationId) { mutableStateOf(false) }
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
    ) {
        when (model.screenState) {
            ChatScreenState.Loading -> ChatLoading(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding(),
            )
            ChatScreenState.Unavailable -> {
                if (accountContent != null) {
                    FishTopBar(
                        title = stringResource(R.string.personal_messages),
                        modifier = Modifier.statusBarsPadding(),
                        trailingContent = accountContent,
                    )
                }
                ChatUnavailable(
                    hasBack = model.hasPreviousDestination,
                    onBack = onBack,
                    onRetry = onRetryConversation,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            ChatScreenState.Available -> {
                val participant = checkNotNull(model.participant)
                ChatTopBar(
                    participant = participant,
                    presence = participantPresence,
                    showBack = model.hasPreviousDestination,
                    onBack = onBack,
                    onStartAudioCall = onStartAudioCall,
                    onStartVideoCall = onStartVideoCall,
                    onOpenMessageSearch = onOpenMessageSearch,
                    onOpenParticipantDetails = { participantDetailsVisible = true },
                    accountContent = accountContent,
                    modifier = Modifier.statusBarsPadding(),
                )
                if (model.connection != ChatConnectionUiState.Connected) {
                    ChatConnectionNotice(
                        state = model.connection,
                        modifier = Modifier.padding(
                            horizontal = FishTheme.spacing.page,
                            vertical = FishTheme.spacing.xs,
                        ),
                    )
                }
                if (model.notice != null) {
                    FishNotice(
                        message = model.notice,
                        modifier = Modifier.padding(
                            horizontal = FishTheme.spacing.page,
                            vertical = FishTheme.spacing.xs,
                        ),
                    )
                }
                ChatTranscript(
                    messages = model.messages,
                    pagination = model.pagination,
                    hasMoreOlder = model.hasMoreOlder,
                    typingParticipantName = model.typingParticipantName,
                    focusedMessageId = model.focusedMessageId,
                    onRetryEarlier = onRetryEarlier,
                    onRetryMessage = onRetryMessage,
                    onReportGif = onReportGif,
                    onPhotoAttachmentClick = onPhotoAttachmentClick,
                    onFileAttachmentClick = onFileAttachmentClick,
                    onAttachmentLoadError = onAttachmentLoadError,
                    onOpenMessageActions = {
                        showReactionsInitially = false
                        selectedMessageId = it
                    },
                    onOpenReactionPicker = {
                        showReactionsInitially = true
                        selectedMessageId = it
                    },
                    onToggleReaction = onToggleReaction,
                    onFocusMessage = onFocusMessage,
                    modifier = Modifier.weight(1f),
                )
                FishDivider()
                MessageComposer(
                    state = composerState,
                    onSend = onSend,
                    pendingMedia = pendingMedia,
                    onOpenMediaPicker = onOpenMediaPicker,
                    onRemovePendingMedia = onRemovePendingMedia,
                    pendingAttachments = pendingAttachments,
                    onOpenAttachmentPicker = onOpenAttachmentPicker,
                    onRemovePendingAttachment = onRemovePendingAttachment,
                    onRetryPendingAttachment = onRetryPendingAttachment,
                    replyTarget = model.replyTarget,
                    onClearReplyTarget = onClearReplyTarget,
                    mediaSelectionEnabled = pendingAttachments.isEmpty(),
                    attachmentSelectionEnabled = pendingMedia == null,
                    editable = true,
                    sendEnabled = model.connection != ChatConnectionUiState.Offline &&
                        pendingAttachments.all { it.ready },
                    sending = model.isSending,
                    voiceRecording = voiceRecording,
                    voiceRecordingEnabled = voiceRecordingEnabled,
                    onStartVoiceRecording = onStartVoiceRecording,
                    onFinishVoiceRecording = onFinishVoiceRecording,
                    onCancelVoiceRecording = onCancelVoiceRecording,
                    modifier = Modifier
                        .navigationBarsPadding()
                        .imePadding(),
                )
            }
        }
    }
    model.messages.firstOrNull { it.id == selectedMessageId }?.let { selectedMessage ->
        ChatMessageActionsSheet(
            message = selectedMessage,
            onDismiss = { selectedMessageId = null },
            onCopy = onCopyMessage,
            onReply = {
                selectedMessageId = null
                onReplyMessage(selectedMessage.id)
            },
            onEdit = { body ->
                selectedMessageId = null
                onEditMessage(selectedMessage.id, body)
            },
            onDelete = {
                selectedMessageId = null
                onDeleteMessage(selectedMessage.id)
            },
            onReact = { emoji ->
                selectedMessageId = null
                onToggleReaction(selectedMessage.id, emoji)
            },
            emojiCatalog = emojiCatalog,
            showReactionsInitially = showReactionsInitially,
        )
    }
    if (participantDetailsVisible && model.participant != null) {
        ParticipantDetailsSheet(
            participant = model.participant,
            presence = participantPresence,
            onDismiss = { participantDetailsVisible = false },
            onRemoveFriend = onRemoveFriend,
            onBlock = onBlockParticipant,
        )
    }
}

@Composable
fun ChatTranscript(
    messages: List<MessageUiModel>,
    pagination: OlderMessagesUiState,
    hasMoreOlder: Boolean = false,
    typingParticipantName: String?,
    focusedMessageId: String? = null,
    onRetryEarlier: () -> Unit,
    onRetryMessage: (String) -> Unit = {},
    onReportGif: (String) -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onOpenMessageActions: (String) -> Unit = {},
    onOpenReactionPicker: (String) -> Unit = {},
    onToggleReaction: (String, String) -> Unit = { _, _ -> },
    onFocusMessage: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (messages.isEmpty() && pagination == OlderMessagesUiState.Idle) {
        Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            FishEmptyState(
                title = stringResource(R.string.no_messages_title),
                description = stringResource(R.string.no_messages_description),
            )
        }
        return
    }

    val listState = rememberLazyListState()
    var previousLastMessageId by remember { mutableStateOf<String?>(null) }
    var handledFocusMessageId by remember { mutableStateOf<String?>(null) }
    var transcriptPositioned by remember { mutableStateOf(false) }
    var playingGifId by remember { mutableStateOf<String?>(null) }
    var playingVoiceId by remember { mutableStateOf<String?>(null) }
    var showNewMessages by remember { mutableStateOf(false) }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        playingGifId = null
        playingVoiceId = null
    }
    val lastMessageId = messages.lastOrNull()?.id
    LaunchedEffect(lastMessageId, focusedMessageId) {
        if (focusedMessageId != null && handledFocusMessageId != focusedMessageId) {
            handledFocusMessageId = focusedMessageId
            previousLastMessageId = lastMessageId
            showNewMessages = false
            return@LaunchedEffect
        }
        val lastVisibleIndex = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
        val nearLatest = lastVisibleIndex >= listState.layoutInfo.totalItemsCount - 3
        val sentByCurrentUser = messages.lastOrNull()?.isOutgoing == true
        if (messages.isNotEmpty() &&
            (previousLastMessageId == null || nearLatest || sentByCurrentUser)
        ) {
            listState.scrollToItem(messages.lastIndex + 1)
            showNewMessages = false
        } else if (previousLastMessageId != null && !nearLatest) {
            showNewMessages = true
        }
        previousLastMessageId = lastMessageId
        transcriptPositioned = true
    }
    LaunchedEffect(listState) {
        snapshotFlow {
            val layout = listState.layoutInfo
            val lastVisible = layout.visibleItemsInfo.lastOrNull()?.index ?: -1
            lastVisible >= layout.totalItemsCount - 2
        }.distinctUntilChanged().filter { it }.collect { showNewMessages = false }
    }
    LaunchedEffect(listState, hasMoreOlder, pagination, messages.firstOrNull()?.id) {
        if (!hasMoreOlder || pagination != OlderMessagesUiState.Idle || messages.isEmpty()) return@LaunchedEffect
        snapshotFlow { transcriptPositioned && listState.firstVisibleItemIndex <= 1 }
            .distinctUntilChanged()
            .filter { it }
            .collect { onRetryEarlier() }
    }
    LaunchedEffect(messages.map(MessageUiModel::id)) {
        if (playingGifId !in messages.map(MessageUiModel::id)) playingGifId = null
        if (playingVoiceId !in messages.flatMap { it.attachments }.map(AttachmentUiModel::id)) {
            playingVoiceId = null
        }
    }
    LaunchedEffect(focusedMessageId, messages.map(MessageUiModel::id)) {
        val focusedIndex = messages.indexOfFirst { it.id == focusedMessageId }
        if (focusedIndex >= 0) {
            listState.scrollToItem(focusedIndex + 1)
            transcriptPositioned = true
        }
    }
    Box(modifier = modifier.fillMaxWidth()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = listState,
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                horizontal = FishTheme.spacing.page,
                vertical = FishTheme.spacing.xs,
            ),
        ) {
            item(key = "older-state", contentType = "older-state") {
                OlderMessagesState(state = pagination, onRetry = onRetryEarlier)
            }
            items(
                items = messages,
                key = { it.id },
                contentType = { "message" },
            ) { message ->
                if (message.dateLabel != null) {
                    MessageDateSeparator(message.dateLabel)
                }
                if (message.startsUnread) {
                    UnreadMessageDivider()
                }
                MessageBubble(
                    message = message.copy(gifPlaying = message.id == playingGifId),
                    onToggleGif = {
                        playingGifId = if (playingGifId == message.id) null else message.id
                    },
                    onReportGif = { onReportGif(message.id) },
                    onPhotoAttachmentClick = onPhotoAttachmentClick,
                    onFileAttachmentClick = onFileAttachmentClick,
                    playingVoiceId = playingVoiceId,
                    onToggleVoice = { attachmentId ->
                        playingVoiceId = if (playingVoiceId == attachmentId) null else attachmentId
                        if (playingVoiceId == attachmentId) playingGifId = null
                    },
                    onAttachmentLoadError = onAttachmentLoadError,
                    onRetry = { onRetryMessage(message.id) },
                    onOpenActions = { onOpenMessageActions(message.id) },
                    onAddReaction = { onOpenReactionPicker(message.id) },
                    onToggleReaction = { emoji -> onToggleReaction(message.id, emoji) },
                    onReplyPreviewClick = onFocusMessage,
                    modifier = Modifier
                        .then(
                            if (message.id == focusedMessageId) {
                                Modifier
                                    .background(
                                        FishTheme.colors.selected,
                                        androidx.compose.foundation.shape.RoundedCornerShape(
                                            FishTheme.radii.card,
                                        ),
                                    )
                                    .testTag("focused-message")
                            } else {
                                Modifier.background(Color.Transparent)
                            },
                        )
                        .padding(
                            bottom = if (message.groupedWithNext) {
                                FishTheme.spacing.nudge
                            } else {
                                FishTheme.spacing.sm
                            },
                        ),
                )
            }
            if (typingParticipantName != null) {
                item(key = "typing", contentType = "typing") {
                    TypingIndicator(typingParticipantName)
                }
            }
        }
        if (showNewMessages) {
            FishButton(
                label = stringResource(R.string.new_messages),
                onClick = {
                    showNewMessages = false
                    if (messages.isNotEmpty()) {
                        listState.requestScrollToItem(messages.lastIndex + 1)
                    }
                },
                variant = FishButtonVariant.Secondary,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(FishTheme.spacing.sm),
            )
        }
    }
}

@Composable
private fun ConversationRail(
    conversations: List<ConversationPreviewUiModel>,
    selectedConversationId: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.surface)
            .statusBarsPadding()
            .padding(FishTheme.spacing.sm),
    ) {
        Text(
            text = stringResource(R.string.personal_messages),
            modifier = Modifier.padding(
                start = FishTheme.spacing.sm,
                top = FishTheme.spacing.sm,
                bottom = FishTheme.spacing.md,
            ),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.heading,
        )
        LazyColumn {
            items(conversations, key = { it.conversationId }) { conversation ->
                ConversationRow(
                    name = conversation.participantName,
                    snippet = if (conversation.hasDraft) {
                        "Draft · ${conversation.snippet}"
                    } else conversation.snippet,
                    time = conversation.timeLabel,
                    unreadCount = conversation.unreadCount,
                    selected = conversation.conversationId == selectedConversationId,
                    onClick = { onSelect(conversation.conversationId) },
                )
                Spacer(Modifier.height(FishTheme.spacing.xs))
            }
        }
    }
}

@Composable
fun ConversationListScreen(
    currentUserDisplayName: String,
    conversations: List<ConversationPreviewUiModel>,
    selectedConversationId: String?,
    notice: String?,
    onSelectConversation: (String) -> Unit,
    accountContent: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = FishTheme.sizes.chatContentMax)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(FishTheme.spacing.page),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(R.string.personal_messages),
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.heading,
                )
                accountContent?.invoke()
            }
            Text(
                text = stringResource(R.string.conversation_list_description),
                modifier = Modifier.padding(top = FishTheme.spacing.xs),
                color = FishTheme.colors.body,
                style = FishTheme.typography.ui,
            )
            if (notice != null) {
                FishNotice(
                    message = notice,
                    modifier = Modifier.padding(top = FishTheme.spacing.md),
                )
            }
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = FishTheme.spacing.lg),
            ) {
                items(conversations, key = { it.conversationId }) { conversation ->
                    ConversationRow(
                        name = conversation.participantName,
                        snippet = if (conversation.hasDraft) {
                            "Draft · ${conversation.snippet}"
                        } else conversation.snippet,
                        time = conversation.timeLabel,
                        unreadCount = conversation.unreadCount,
                        selected = conversation.conversationId == selectedConversationId,
                        onClick = { onSelectConversation(conversation.conversationId) },
                    )
                    Spacer(Modifier.height(FishTheme.spacing.xs))
                }
            }
        }
    }
}

@Composable
private fun ChatLoading(modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(FishTheme.spacing.page)) {
        FishSkeleton(width = FishTheme.sizes.conversationRail)
        Spacer(Modifier.height(FishTheme.spacing.xl))
        repeat(4) {
            FishSkeleton()
            Spacer(Modifier.height(FishTheme.spacing.md))
        }
    }
}

@Composable
private fun ChatUnavailable(
    hasBack: Boolean,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        FishEmptyState(
            title = stringResource(R.string.conversation_unavailable_title),
            description = stringResource(R.string.conversation_unavailable_description),
            action = {
                FishButton(
                    label = stringResource(
                        if (hasBack) R.string.back else R.string.retry_conversation,
                    ),
                    onClick = if (hasBack) onBack else onRetry,
                    variant = space.fishhub.android.core.designsystem.component.FishButtonVariant.Secondary,
                )
            },
        )
    }
}
