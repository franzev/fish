package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishStateTextField
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.logic.AttachmentIcon
import space.fishhub.android.feature.chat.model.ComposerMediaUiModel
import space.fishhub.android.feature.chat.model.LocalAttachmentUiModel
import space.fishhub.android.feature.chat.model.ReplyPreviewUiModel
import space.fishhub.android.feature.chat.model.VoiceRecordingUiState

private const val MessageLimit = 4_000

private const val CounterThreshold = 3_600

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
        StagedAttachmentStrip(
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
