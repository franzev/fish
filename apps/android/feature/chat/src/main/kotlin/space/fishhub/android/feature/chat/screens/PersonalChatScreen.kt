package space.fishhub.android.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.chat.ConversationQuietPeriod
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishDivider
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.logic.ChatMediaCatalog
import space.fishhub.android.feature.chat.model.ChatConnectionUiState
import space.fishhub.android.feature.chat.model.ChatScreenState
import space.fishhub.android.feature.chat.model.ChatUiModel
import space.fishhub.android.feature.chat.model.ComposerMediaUiModel
import space.fishhub.android.feature.chat.model.LocalAttachmentUiModel
import space.fishhub.android.feature.chat.model.ParticipantUiModel
import space.fishhub.android.feature.chat.model.VoiceRecordingUiState
import space.fishhub.android.feature.chat.views.ChatConnectionNotice
import space.fishhub.android.feature.chat.views.ChatMessageActionsSheet
import space.fishhub.android.feature.chat.views.ConversationDetailsSheet
import space.fishhub.android.feature.chat.views.MessageComposer
import space.fishhub.android.feature.chat.views.PersonalChatTopBar
import space.fishhub.android.feature.chat.views.PersonalChatTranscript
import space.fishhub.android.feature.presence.PresencePresentation

@Composable
fun PersonalChatScreen(
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
    onSetQuiet: (ConversationQuietPeriod?) -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onFileAttachmentShare: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    onCallBack: (String) -> Unit = {},
    onOpenMessageSearch: () -> Unit = {},
    onOpenSharedContentFromHeader: () -> Unit = {},
    onOpenSharedContentFromDetails: () -> Unit = {},
    participantDetailsVisible: Boolean? = null,
    onOpenParticipantDetails: (() -> Unit)? = null,
    onDismissParticipantDetails: (() -> Unit)? = null,
    sharedContentHeaderModifier: Modifier = Modifier,
    sharedContentDetailsModifier: Modifier = Modifier,
    sharedContentDetailsFocusRequested: Boolean = false,
    participantDetailsModifier: Modifier = Modifier,
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
    var localParticipantDetailsVisible by remember(model.selectedConversationId) {
        mutableStateOf(false)
    }
    val detailsVisible = participantDetailsVisible ?: localParticipantDetailsVisible
    val openParticipantDetails = onOpenParticipantDetails ?: {
        localParticipantDetailsVisible = true
    }
    val dismissParticipantDetails = onDismissParticipantDetails ?: {
        localParticipantDetailsVisible = false
    }
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
                PersonalChatTopBar(
                    participant = participant,
                    presence = participantPresence,
                    showBack = model.hasPreviousDestination,
                    onBack = onBack,
                    onStartAudioCall = onStartAudioCall,
                    onStartVideoCall = onStartVideoCall,
                    onOpenMessageSearch = onOpenMessageSearch,
                    onOpenSharedContent = onOpenSharedContentFromHeader,
                    onOpenParticipantDetails = openParticipantDetails,
                    sharedContentModifier = sharedContentHeaderModifier,
                    participantDetailsModifier = participantDetailsModifier,
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
                        title = model.notice,
                        modifier = Modifier.padding(
                            horizontal = FishTheme.spacing.page,
                            vertical = FishTheme.spacing.xs,
                        ),
                    )
                }
                PersonalChatTranscript(
                    messages = model.messages,
                    callActivities = model.callActivities,
                    pagination = model.pagination,
                    hasMoreOlder = model.hasMoreOlder,
                    typingParticipantName = model.typingParticipantName,
                    focusedMessageId = model.focusedMessageId,
                    onRetryEarlier = onRetryEarlier,
                    onRetryMessage = onRetryMessage,
                    onReportGif = onReportGif,
                    onPhotoAttachmentClick = onPhotoAttachmentClick,
                    onFileAttachmentClick = onFileAttachmentClick,
                    onFileAttachmentShare = onFileAttachmentShare,
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
                    onCallBack = onCallBack,
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
    if (detailsVisible && model.participant != null) {
        ConversationDetailsSheet(
            participant = model.participant,
            presence = participantPresence,
            onDismiss = dismissParticipantDetails,
            onOpenSharedContent = onOpenSharedContentFromDetails,
            onRemoveFriend = onRemoveFriend,
            onBlock = onBlockParticipant,
            mute = model.mute,
            onSetQuiet = onSetQuiet,
            sharedContentModifier = sharedContentDetailsModifier,
            requestSharedContentFocus = sharedContentDetailsFocusRequested,
        )
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
