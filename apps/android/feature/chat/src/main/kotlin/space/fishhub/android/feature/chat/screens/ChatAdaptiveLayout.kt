package space.fishhub.android.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishDivider
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.views.ConversationRow
import space.fishhub.android.feature.chat.logic.ChatMediaCatalog
import space.fishhub.android.feature.chat.model.ChatUiModel
import space.fishhub.android.feature.chat.model.ComposerMediaUiModel
import space.fishhub.android.feature.chat.model.ConversationPreviewUiModel
import space.fishhub.android.feature.chat.model.LocalAttachmentUiModel
import space.fishhub.android.feature.chat.model.ParticipantUiModel
import space.fishhub.android.feature.chat.model.VoiceRecordingUiState
import space.fishhub.android.feature.presence.PresencePresentation

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
    onFileAttachmentShare: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onRetryConversation: () -> Unit = {},
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
                    PersonalChatScreen(
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
                        onFileAttachmentShare = onFileAttachmentShare,
                        onAttachmentLoadError = onAttachmentLoadError,
                        onStartAudioCall = onStartAudioCall,
                        onStartVideoCall = onStartVideoCall,
                        onCallBack = onCallBack,
                        onOpenMessageSearch = onOpenMessageSearch,
                        onOpenSharedContentFromHeader = onOpenSharedContentFromHeader,
                        onOpenSharedContentFromDetails = onOpenSharedContentFromDetails,
                        participantDetailsVisible = participantDetailsVisible,
                        onOpenParticipantDetails = onOpenParticipantDetails,
                        onDismissParticipantDetails = onDismissParticipantDetails,
                        sharedContentHeaderModifier = sharedContentHeaderModifier,
                        sharedContentDetailsModifier = sharedContentDetailsModifier,
                        sharedContentDetailsFocusRequested = sharedContentDetailsFocusRequested,
                        participantDetailsModifier = participantDetailsModifier,
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
                PersonalChatScreen(
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
                    onFileAttachmentShare = onFileAttachmentShare,
                    onAttachmentLoadError = onAttachmentLoadError,
                    onStartAudioCall = onStartAudioCall,
                    onStartVideoCall = onStartVideoCall,
                    onOpenMessageSearch = onOpenMessageSearch,
                    onOpenSharedContentFromHeader = onOpenSharedContentFromHeader,
                    onOpenSharedContentFromDetails = onOpenSharedContentFromDetails,
                    participantDetailsVisible = participantDetailsVisible,
                    onOpenParticipantDetails = onOpenParticipantDetails,
                    onDismissParticipantDetails = onDismissParticipantDetails,
                    sharedContentHeaderModifier = sharedContentHeaderModifier,
                    sharedContentDetailsModifier = sharedContentDetailsModifier,
                    sharedContentDetailsFocusRequested = sharedContentDetailsFocusRequested,
                    participantDetailsModifier = participantDetailsModifier,
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
