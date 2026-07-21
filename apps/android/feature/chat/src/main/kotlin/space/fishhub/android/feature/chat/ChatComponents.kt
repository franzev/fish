package space.fishhub.android.feature.chat

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import coil3.compose.rememberAsyncImagePainter
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishDivider
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishNoticeTone
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import space.fishhub.android.core.designsystem.component.FishStateTextField
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.presence.PresenceAvatar
import space.fishhub.android.feature.presence.PresencePresentation

private const val MessageLimit = 4_000
private const val CounterThreshold = 3_600

@Composable
fun ChatTopBar(
    participant: ParticipantUiModel,
    presence: PresencePresentation,
    showBack: Boolean,
    onBack: () -> Unit,
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    onOpenMessageSearch: () -> Unit = {},
    onOpenParticipantDetails: () -> Unit = {},
    accountContent: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val avatarPainter = participant.avatarUrl?.let { rememberAsyncImagePainter(it) }
    FishTopBar(
        title = participant.displayName,
        subtitle = presence.label,
        modifier = modifier,
        showBack = showBack,
        onBack = onBack,
        leadingAvatar = {
            Box(
                modifier = Modifier
                    .size(FishTheme.sizes.touchTarget)
                    .clickable(onClick = onOpenParticipantDetails),
                contentAlignment = Alignment.Center,
            ) {
                PresenceAvatar(
                    name = participant.displayName,
                    presence = presence,
                    image = avatarPainter,
                )
            }
        },
        trailingContent = {
            FishIconButton(
                icon = FishIcons.Phone,
                contentDescription = stringResource(
                    R.string.voice_call_participant,
                    participant.displayName,
                ),
                onClick = { onStartAudioCall(participant) },
            )
            FishIconButton(
                icon = FishIcons.Video,
                contentDescription = stringResource(
                    R.string.video_call_participant,
                    participant.displayName,
                ),
                onClick = { onStartVideoCall(participant) },
            )
            FishIconButton(
                icon = FishIcons.Search,
                contentDescription = stringResource(R.string.search_messages),
                onClick = onOpenMessageSearch,
            )
            accountContent?.invoke()
        },
    )
}

@Composable
fun MessageBubble(
    message: MessageUiModel,
    onToggleGif: () -> Unit = {},
    onReportGif: () -> Unit = {},
    onRetry: () -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    playingVoiceId: String? = null,
    onToggleVoice: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    onOpenActions: () -> Unit = {},
    onAddReaction: () -> Unit = {},
    onToggleReaction: (String) -> Unit = {},
    onReplyPreviewClick: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val colors = FishTheme.colors
    val container = if (message.isOutgoing) colors.primary else colors.surfaceAlt
    val content = if (message.isOutgoing) colors.onPrimary else colors.foreground
    val author = if (message.isOutgoing) stringResource(R.string.you) else message.senderName
    val body = if (message.deleted) stringResource(R.string.message_deleted) else message.body
    val semantics = stringResource(
        R.string.message_accessibility,
        author,
        body,
        message.timeLabel,
    )
    val messageActionsLabel = stringResource(R.string.more_message_actions)
    val shape = messageShape(message)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (message.actionsEnabled) {
                    Modifier.pointerInput(message.id) {
                        detectTapGestures(onLongPress = { onOpenActions() })
                    }
                } else {
                    Modifier
                },
            )
            .semantics {
                if (message.actionsEnabled) {
                    customActions = listOf(
                        CustomAccessibilityAction(messageActionsLabel) {
                            onOpenActions()
                            true
                        },
                    )
                }
            },
        horizontalAlignment = if (message.isOutgoing) Alignment.End else Alignment.Start,
    ) {
        message.replyPreview?.let { reply ->
            ReplyPreviewSurface(
                preview = reply,
                onClick = { onReplyPreviewClick(reply.messageId) },
                modifier = Modifier.padding(bottom = FishTheme.spacing.twoXs),
            )
        }
        message.sticker?.let { sticker ->
            StickerMessageMedia(
                sticker = sticker,
                author = author,
                timeLabel = message.timeLabel,
            )
        }
        message.gif?.let { gif ->
            GifMessageMedia(
                gif = gif,
                author = author,
                timeLabel = message.timeLabel,
                playing = message.gifPlaying,
                onTogglePlayback = onToggleGif,
                onReport = onReportGif,
            )
        }
        if (message.gifUnavailable && message.gif == null) {
            GifUnavailableMedia()
        }
        if (!message.deleted && message.attachments.isNotEmpty()) {
            MessageAttachmentGroup(
                attachments = message.attachments,
                author = author,
                timeLabel = message.timeLabel,
                onPhotoClick = onPhotoAttachmentClick,
                onFileClick = onFileAttachmentClick,
                playingVoiceId = playingVoiceId,
                onToggleVoice = onToggleVoice,
                onAttachmentLoadError = onAttachmentLoadError,
                onPhotoLoadError = onAttachmentLoadError,
            )
        }
        if (message.deleted || message.body.isNotBlank()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
                    .clip(shape)
                    .background(container)
                    .padding(
                        horizontal = FishTheme.spacing.md,
                        vertical = FishTheme.spacing.sm,
                    )
                    .clearAndSetSemantics { contentDescription = semantics },
            ) {
                Text(
                    text = body,
                    color = if (message.deleted) {
                        if (message.isOutgoing) content.copy(alpha = 0.78f) else colors.muted
                    } else {
                        content
                    },
                    style = FishTheme.typography.body,
                )
            }
        }
        message.linkPreview?.let { preview ->
            LinkPreviewSurface(preview)
        }
        if (message.delivery != null) {
            MessageDeliveryStatus(
                status = message.delivery,
                modifier = Modifier.padding(
                    top = FishTheme.spacing.twoXs,
                    end = FishTheme.spacing.xs,
                ),
            )
        }
        if (message.edited && !message.deleted) {
            Text(
                text = stringResource(R.string.message_edited),
                modifier = Modifier.padding(top = FishTheme.spacing.twoXs),
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
            )
        }
        if (message.reactions.isNotEmpty()) {
            FlowRow(
                modifier = Modifier
                    .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
                    .padding(top = FishTheme.spacing.twoXs),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
            ) {
                message.reactions.forEach { reaction ->
                    val reactionDescription = pluralStringResource(
                        R.plurals.reaction_accessibility,
                        reaction.count,
                        reaction.emoji,
                        reaction.count,
                    ) + if (reaction.byMe) {
                        stringResource(R.string.reaction_including_you)
                    } else {
                        ""
                    }
                    ReactionChip(
                        reaction = reaction,
                        description = reactionDescription,
                        enabled = message.reactionsEnabled,
                        onClick = { onToggleReaction(reaction.emoji) },
                    )
                }
                AddReactionChip(
                    description = stringResource(R.string.add_reaction),
                    enabled = message.reactionsEnabled,
                    onClick = onAddReaction,
                )
            }
        }
        if (message.delivery == MessageDeliveryUiState.Failed) {
            FishButton(
                label = stringResource(R.string.retry_failed_message),
                onClick = onRetry,
                variant = FishButtonVariant.Secondary,
                modifier = Modifier.padding(
                    top = FishTheme.spacing.twoXs,
                    end = FishTheme.spacing.xs,
                ),
            )
        }
    }
}

@Composable
private fun LinkPreviewSurface(preview: space.fishhub.android.data.chat.model.ChatLinkPreview) {
    val uriHandler = LocalUriHandler.current
    Column(
        modifier = Modifier
            .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.surfaceAlt)
            .clickable { runCatching { uriHandler.openUri(preview.url) } }
            .padding(horizontal = FishTheme.spacing.sm, vertical = FishTheme.spacing.sm),
    ) {
        Text(
            text = preview.siteName ?: preview.hostname,
            color = FishTheme.colors.muted,
            style = FishTheme.typography.caption,
        )
        Text(
            text = preview.title ?: preview.hostname,
            color = FishTheme.colors.foreground,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            style = FishTheme.typography.label,
        )
        preview.description?.let {
            Text(
                text = it,
                color = FishTheme.colors.body,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                style = FishTheme.typography.caption,
            )
        }
    }
}

@Composable
private fun ReplyPreviewSurface(
    preview: ReplyPreviewUiModel,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.surfaceAlt)
            .clickable(onClick = onClick)
            .padding(
                horizontal = FishTheme.spacing.sm,
                vertical = FishTheme.spacing.xs,
            ),
    ) {
        if (preview.authorName.isNotBlank()) {
            Text(
                text = preview.authorName,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.label,
            )
        }
        Text(
            text = preview.snippet,
            color = FishTheme.colors.muted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = FishTheme.typography.caption,
        )
    }
}

@Composable
private fun messageShape(message: MessageUiModel): Shape {
    val outer = FishTheme.radii.chat
    val inner = FishTheme.radii.chatInner
    return if (message.isOutgoing) {
        RoundedCornerShape(
            topStart = outer,
            topEnd = if (message.groupedWithPrevious) inner else outer,
            bottomStart = outer,
            bottomEnd = if (message.groupedWithNext) inner else outer,
        )
    } else {
        RoundedCornerShape(
            topStart = if (message.groupedWithPrevious) inner else outer,
            topEnd = outer,
            bottomStart = if (message.groupedWithNext) inner else outer,
            bottomEnd = outer,
        )
    }
}

@Composable
fun MessageDeliveryStatus(
    status: MessageDeliveryUiState,
    modifier: Modifier = Modifier,
) {
    Text(
        text = status.localizedLabel(),
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (status == MessageDeliveryUiState.Failed) {
            FishTheme.colors.notice
        } else {
            FishTheme.colors.muted
        },
        style = FishTheme.typography.caption,
    )
}

@Composable
private fun MessageDeliveryUiState.localizedLabel(): String = stringResource(
    when (this) {
        MessageDeliveryUiState.Sending -> R.string.status_sending
        MessageDeliveryUiState.Sent -> R.string.status_sent
        MessageDeliveryUiState.Delivered -> R.string.status_delivered
        MessageDeliveryUiState.Read -> R.string.status_read
        MessageDeliveryUiState.Failed -> R.string.status_failed
    },
)

@Composable
fun MessageDateSeparator(label: String, modifier: Modifier = Modifier) {
    Text(
        text = label,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.md)
            .semantics { heading() },
        color = FishTheme.colors.muted,
        textAlign = TextAlign.Center,
        style = FishTheme.typography.caption,
    )
}

@Composable
fun UnreadMessageDivider(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.md)
            .semantics { heading() },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) { FishDivider() }
        Text(
            text = stringResource(R.string.new_messages),
            modifier = Modifier.padding(horizontal = FishTheme.spacing.sm),
            color = FishTheme.colors.notice,
            style = FishTheme.typography.label,
        )
        Box(Modifier.weight(1f)) { FishDivider() }
    }
}

@Composable
fun TypingIndicator(name: String, modifier: Modifier = Modifier) {
    val typingLabel = stringResource(R.string.typing, name)
    val duration = FishTheme.motion.typingMs
    val alpha = if (duration == 0) {
        0.7f
    } else {
        val transition = rememberInfiniteTransition(label = "typing")
        val animated by transition.animateFloat(
            initialValue = 0.45f,
            targetValue = 0.9f,
            animationSpec = infiniteRepeatable(
                animation = tween(duration),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "typing opacity",
        )
        animated
    }
    Row(
        modifier = modifier
            .semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = typingLabel
            }
            .padding(vertical = FishTheme.spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = typingLabel,
            color = FishTheme.colors.muted,
            style = FishTheme.typography.caption,
        )
        Row(
            modifier = Modifier
                .padding(start = FishTheme.spacing.nudge)
                .alpha(alpha),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
        ) {
            repeat(3) {
                Box(
                    Modifier
                        .size(FishTheme.spacing.twoXs)
                        .background(FishTheme.colors.muted, RoundedCornerShape(FishTheme.radii.pill)),
                )
            }
        }
    }
}

@Composable
fun ChatConnectionNotice(state: ChatConnectionUiState, modifier: Modifier = Modifier) {
    when (state) {
        ChatConnectionUiState.Connected -> Unit
        ChatConnectionUiState.Connecting -> FishNotice(
            message = stringResource(R.string.connecting),
            modifier = modifier,
        )
        ChatConnectionUiState.Reconnecting -> FishNotice(
            message = stringResource(R.string.reconnecting),
            modifier = modifier,
        )
        ChatConnectionUiState.Offline -> FishNotice(
            message = stringResource(R.string.offline),
            modifier = modifier,
            tone = FishNoticeTone.Warning,
        )
    }
}

@Composable
fun OlderMessagesState(
    state: OlderMessagesUiState,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(FishTheme.sizes.paginationSlot),
        contentAlignment = Alignment.Center,
    ) {
        when (state) {
            OlderMessagesUiState.Idle -> Unit
            OlderMessagesUiState.Loading -> Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                FishSkeleton()
                FishSkeleton(width = FishTheme.sizes.conversationRail)
            }
            OlderMessagesUiState.Failed -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
            ) {
                Text(
                    text = stringResource(R.string.earlier_failed),
                    color = FishTheme.colors.body,
                    textAlign = TextAlign.Center,
                    style = FishTheme.typography.caption,
                )
                FishButton(
                    label = stringResource(R.string.retry_earlier),
                    onClick = onRetry,
                    variant = FishButtonVariant.Secondary,
                )
            }
        }
    }
}

@Composable
fun MessageComposer(
    state: TextFieldState,
    onSend: () -> Unit,
    pendingMedia: ComposerMediaUiModel? = null,
    onOpenMediaPicker: () -> Unit = {},
    onRemovePendingMedia: () -> Unit = {},
    pendingAttachments: List<LocalAttachmentUiModel> = emptyList(),
    onOpenAttachmentPicker: () -> Unit = {},
    onRemovePendingAttachment: (String) -> Unit = {},
    onRetryPendingAttachment: (String) -> Unit = {},
    replyTarget: ReplyPreviewUiModel? = null,
    onClearReplyTarget: () -> Unit = {},
    modifier: Modifier = Modifier,
    editable: Boolean = true,
    mediaSelectionEnabled: Boolean = true,
    attachmentSelectionEnabled: Boolean = true,
    sendEnabled: Boolean = true,
    sending: Boolean = false,
    voiceRecording: VoiceRecordingUiState = VoiceRecordingUiState(),
    voiceRecordingEnabled: Boolean = false,
    onStartVoiceRecording: () -> Unit = {},
    onFinishVoiceRecording: () -> Unit = {},
    onCancelVoiceRecording: () -> Unit = {},
) {
    val textLength = state.text.codePoints().count().toInt()
    val blank = state.text.isBlank() && pendingMedia == null && pendingAttachments.isEmpty()
    val atLimit = textLength >= MessageLimit
    val recordingDescription = if (voiceRecording.recording) {
        stringResource(
            R.string.recording_voice_message,
            formatRecordingElapsed(voiceRecording.elapsedMillis),
        )
    } else {
        null
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surface)
            .padding(FishTheme.spacing.page),
    ) {
        if (replyTarget != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = FishTheme.spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.replying_to, replyTarget.authorName),
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.label,
                    )
                    Text(
                        text = replyTarget.snippet,
                        color = FishTheme.colors.muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = FishTheme.typography.caption,
                    )
                }
                FishIconButton(
                    icon = FishIcons.Close,
                    contentDescription = stringResource(R.string.cancel_reply),
                    onClick = onClearReplyTarget,
                )
            }
        }
        Text(
            text = stringResource(R.string.message_label),
            modifier = Modifier.padding(bottom = FishTheme.spacing.xs),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.label,
        )
        voiceRecording.notice?.let { notice ->
            FishNotice(
                message = notice,
                modifier = Modifier.padding(bottom = FishTheme.spacing.sm),
            )
        }
        if (pendingMedia != null) {
            ComposerMediaPreview(
                media = pendingMedia,
                onRemove = onRemovePendingMedia,
                modifier = Modifier.padding(bottom = FishTheme.spacing.sm),
            )
        }
        ComposerAttachmentQueue(
            attachments = pendingAttachments,
            onRemove = onRemovePendingAttachment,
            onRetry = onRetryPendingAttachment,
            modifier = Modifier.padding(bottom = FishTheme.spacing.sm),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .semantics {
                    recordingDescription?.let {
                        liveRegion = LiveRegionMode.Polite
                        contentDescription = it
                    }
                },
            verticalAlignment = Alignment.Bottom,
        ) {
            if (voiceRecording.recording) {
                FishIconButton(
                    icon = FishIcons.Close,
                    contentDescription = stringResource(R.string.cancel_voice_recording),
                    onClick = onCancelVoiceRecording,
                    size = FishTheme.sizes.touchTarget,
                )
                Text(
                    text = stringResource(
                        R.string.recording_voice_message,
                        formatRecordingElapsed(voiceRecording.elapsedMillis),
                    ),
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.label,
                )
                Text(
                    text = stringResource(R.string.slide_to_cancel_voice_message),
                    modifier = Modifier.padding(horizontal = FishTheme.spacing.xs),
                    color = FishTheme.colors.muted,
                    style = FishTheme.typography.caption,
                )
            } else {
                FishIconButton(
                    icon = FishIcons.AddMedia,
                    contentDescription = stringResource(R.string.add_media),
                    onClick = onOpenMediaPicker,
                    enabled = editable && mediaSelectionEnabled,
                    size = FishTheme.sizes.touchTarget,
                )
                Spacer(Modifier.width(FishTheme.spacing.xs))
                FishIconButton(
                    icon = AttachmentIcon,
                    contentDescription = if (pendingAttachments.size >= 5) {
                        stringResource(R.string.attachment_limit_reached)
                    } else {
                        stringResource(R.string.add_attachment)
                    },
                    onClick = onOpenAttachmentPicker,
                    enabled = editable && attachmentSelectionEnabled && pendingAttachments.size < 5,
                    size = FishTheme.sizes.touchTarget,
                )
                Spacer(Modifier.width(FishTheme.spacing.xs))
                FishStateTextField(
                    state = state,
                    modifier = Modifier.weight(1f),
                    enabled = editable,
                    placeholder = stringResource(R.string.message_placeholder),
                    inputTransformation = InputTransformation.maxLength(MessageLimit),
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Sentences,
                        imeAction = ImeAction.Default,
                    ),
                    lineLimits = TextFieldLineLimits.MultiLine(
                        minHeightInLines = 1,
                        maxHeightInLines = 6,
                    ),
                )
            }
            if (voiceRecording.recording || !blank || voiceRecordingEnabled) {
                Spacer(Modifier.width(FishTheme.spacing.xs))
            }
            VoiceRecordButton(
                mode = when {
                    voiceRecording.recording -> VoiceRecordMode.Recording
                    !blank -> VoiceRecordMode.Send
                    voiceRecordingEnabled -> VoiceRecordMode.Microphone
                    else -> VoiceRecordMode.Hidden
                },
                enabled = if (voiceRecording.recording) {
                    true
                } else {
                    editable && sendEnabled && !sending
                },
                onStart = onStartVoiceRecording,
                onSend = onSend,
                onFinish = onFinishVoiceRecording,
                onCancel = onCancelVoiceRecording,
            )
        }
        if (textLength >= CounterThreshold) {
            Text(
                text = stringResource(R.string.message_counter, textLength, MessageLimit),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = FishTheme.spacing.xs),
                color = if (atLimit) FishTheme.colors.notice else FishTheme.colors.muted,
                textAlign = TextAlign.End,
                style = FishTheme.typography.caption,
            )
        }
        if (atLimit) {
            Text(
                text = stringResource(R.string.message_limit),
                modifier = Modifier.padding(top = FishTheme.spacing.xs),
                color = FishTheme.colors.notice,
                style = FishTheme.typography.caption,
            )
        }
    }
}

@Composable
private fun VoiceRecordButton(
    mode: VoiceRecordMode,
    enabled: Boolean,
    onStart: () -> Unit,
    onSend: () -> Unit,
    onFinish: () -> Unit,
    onCancel: () -> Unit,
) {
    if (mode == VoiceRecordMode.Hidden) return
    val layoutDirection = LocalLayoutDirection.current
    val cancelThreshold = with(LocalDensity.current) { FishTheme.spacing.fourXl.toPx() }
    val currentMode by rememberUpdatedState(mode)
    val currentStart by rememberUpdatedState(onStart)
    val currentFinish by rememberUpdatedState(onFinish)
    val currentCancel by rememberUpdatedState(onCancel)
    val currentEnabled by rememberUpdatedState(enabled)
    var gestureStarted = false
    FishIconButton(
        icon = when (mode) {
            VoiceRecordMode.Recording, VoiceRecordMode.Send -> FishIcons.Send
            VoiceRecordMode.Microphone -> FishIcons.Microphone
            VoiceRecordMode.Hidden -> FishIcons.Send
        },
        contentDescription = when (mode) {
            VoiceRecordMode.Recording -> stringResource(R.string.send_voice_recording)
            VoiceRecordMode.Send -> stringResource(R.string.send_message)
            VoiceRecordMode.Microphone -> stringResource(R.string.record_voice_message)
            VoiceRecordMode.Hidden -> ""
        },
        onClick = when (mode) {
            VoiceRecordMode.Recording -> onFinish
            VoiceRecordMode.Send -> onSend
            VoiceRecordMode.Microphone -> onStart
            VoiceRecordMode.Hidden -> ({})
        },
        enabled = enabled,
        variant = if (mode == VoiceRecordMode.Hidden) {
            FishIconButtonVariant.Quiet
        } else {
            FishIconButtonVariant.Filled
        },
        size = FishTheme.sizes.primaryControl,
        modifier = Modifier.pointerInput(layoutDirection) {
            var awayDistance = 0f
            var cancelled = false
            detectDragGesturesAfterLongPress(
                onDragStart = {
                    awayDistance = 0f
                    cancelled = false
                    gestureStarted = true
                    if (currentMode == VoiceRecordMode.Microphone && currentEnabled) currentStart()
                },
                onDrag = { _, dragAmount ->
                    val direction = if (layoutDirection == LayoutDirection.Rtl) 1f else -1f
                    awayDistance += dragAmount.x * direction
                    if (awayDistance >= cancelThreshold) cancelled = true
                },
                onDragEnd = {
                    if (gestureStarted && currentMode == VoiceRecordMode.Recording) {
                        if (cancelled) currentCancel() else currentFinish()
                    }
                    gestureStarted = false
                },
                onDragCancel = {
                    if (gestureStarted && currentMode == VoiceRecordMode.Recording) currentCancel()
                    gestureStarted = false
                },
            )
        },
    )
}

private enum class VoiceRecordMode { Hidden, Microphone, Recording, Send }

private fun formatRecordingElapsed(elapsedMillis: Long): String {
    val totalSeconds = (elapsedMillis / 1_000L).coerceAtLeast(0L)
    return "%02d:%02d".format(totalSeconds / 60L, totalSeconds % 60L)
}
