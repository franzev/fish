package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import java.time.Instant
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.model.AttachmentUiModel
import space.fishhub.android.feature.chat.model.CallActivityUiModel
import space.fishhub.android.feature.chat.model.MessageAction
import space.fishhub.android.feature.chat.model.MessageUiModel
import space.fishhub.android.feature.chat.model.OlderMessagesUiState
import space.fishhub.android.feature.chat.model.toRow

@Composable
fun PersonalChatTranscript(
    messages: List<MessageUiModel>,
    callActivities: List<CallActivityUiModel> = emptyList(),
    pagination: OlderMessagesUiState,
    hasMoreOlder: Boolean = false,
    typingParticipantName: String?,
    focusedMessageId: String? = null,
    onRetryEarlier: () -> Unit,
    onRetryMessage: (String) -> Unit = {},
    onReportGif: (String) -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onFileAttachmentShare: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onOpenMessageActions: (String) -> Unit = {},
    onOpenReactionPicker: (String) -> Unit = {},
    onToggleReaction: (String, String) -> Unit = { _, _ -> },
    onFocusMessage: (String) -> Unit = {},
    onCallBack: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (messages.isEmpty() && callActivities.isEmpty() && pagination == OlderMessagesUiState.Idle) {
        Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            FishEmptyState(
                title = stringResource(R.string.no_messages_title),
                description = stringResource(R.string.no_messages_description),
            )
        }
        return
    }

    val listState = rememberLazyListState()
    val timeline = remember(messages, callActivities) {
        (messages.map { message ->
            ChatTimelineUiItem(
                id = message.id,
                timestamp = message.occurredAt.toInstantOrMin(),
                message = message,
            )
        } + callActivities.map { activity ->
            ChatTimelineUiItem(
                id = activity.id,
                timestamp = activity.occurredAt.toInstantOrMin(),
                callActivity = activity,
            )
        }).sortedWith(compareBy<ChatTimelineUiItem> { it.timestamp }.thenBy { it.id })
    }
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
    val lastMessageId = timeline.lastOrNull()?.id
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
        if (timeline.isNotEmpty() &&
            (previousLastMessageId == null || nearLatest || sentByCurrentUser)
        ) {
            listState.scrollToItem(timeline.lastIndex + 1)
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
        if (!hasMoreOlder || pagination != OlderMessagesUiState.Idle || timeline.isEmpty()) return@LaunchedEffect
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
        val focusedIndex = timeline.indexOfFirst { it.id == focusedMessageId }
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
                OlderMessagesSlot(state = pagination, onRetry = onRetryEarlier)
            }
            items(
                items = timeline,
                key = { it.id },
                contentType = { if (it.callActivity != null) "call" else "message" },
            ) { timelineItem ->
                val message = timelineItem.message
                val callActivity = timelineItem.callActivity
                if (callActivity != null) {
                    ChatCallActivityRow(
                        activity = callActivity,
                        onCallBack = onCallBack,
                    )
                    return@items
                }
                if (message == null) return@items
                if (message.dateLabel != null) {
                    MessageDaySeparator(message.dateLabel)
                }
                if (message.startsUnread) {
                    UnreadMessagesDivider()
                }
                MessageBubble(
                    row = message
                        .copy(gifPlaying = message.id == playingGifId)
                        .toRow(playingVoiceAttachmentId = playingVoiceId),
                    onAction = { action ->
                        when (action) {
                            is MessageAction.ToggleGif ->
                                playingGifId =
                                    if (playingGifId == action.messageId) null else action.messageId

                            is MessageAction.ToggleVoice -> {
                                playingVoiceId = if (playingVoiceId == action.attachmentId) {
                                    null
                                } else {
                                    action.attachmentId
                                }
                                if (playingVoiceId == action.attachmentId) playingGifId = null
                            }

                            is MessageAction.ReportGif -> onReportGif(action.messageId)
                            is MessageAction.OpenPhotoAttachment ->
                                onPhotoAttachmentClick(action.attachmentId)

                            is MessageAction.OpenFileAttachment ->
                                onFileAttachmentClick(action.attachmentId)

                            is MessageAction.ShareFileAttachment ->
                                onFileAttachmentShare(action.attachmentId)

                            is MessageAction.AttachmentLoadFailed ->
                                onAttachmentLoadError(action.attachmentId)

                            is MessageAction.OpenActions -> onOpenMessageActions(action.messageId)
                            is MessageAction.AddReaction -> onOpenReactionPicker(action.messageId)
                            is MessageAction.ToggleReaction ->
                                onToggleReaction(action.messageId, action.emoji)

                            is MessageAction.OpenReplyPreview -> onFocusMessage(action.messageId)
                        }
                    },
                    onRetry = onRetryMessage,
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
                    if (timeline.isNotEmpty()) {
                        listState.requestScrollToItem(timeline.lastIndex + 1)
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

private data class ChatTimelineUiItem(
    val id: String,
    val timestamp: Instant,
    val message: MessageUiModel? = null,
    val callActivity: CallActivityUiModel? = null,
)

private fun String.toInstantOrMin(): Instant = runCatching { Instant.parse(this) }.getOrDefault(Instant.MIN)

@Composable
private fun ChatCallActivityRow(
    activity: CallActivityUiModel,
    onCallBack: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.xs)
            .semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = activity.label,
            color = FishTheme.colors.muted,
            style = FishTheme.typography.ui,
        )
        Text(
            text = activity.timeLabel,
            color = FishTheme.colors.muted,
            style = FishTheme.typography.caption,
        )
        if (activity.canCallBack) {
            FishButton(
                label = "Call back",
                onClick = { onCallBack(activity.kind) },
                variant = FishButtonVariant.Secondary,
                modifier = Modifier.padding(top = FishTheme.spacing.xs),
            )
        }
    }
}
