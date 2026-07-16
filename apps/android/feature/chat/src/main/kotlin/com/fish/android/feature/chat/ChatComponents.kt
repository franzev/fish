package com.fish.android.feature.chat

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.res.stringResource
import com.fish.android.core.designsystem.FishIcons
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.core.designsystem.component.FishAvatar
import com.fish.android.core.designsystem.component.FishButton
import com.fish.android.core.designsystem.component.FishButtonVariant
import com.fish.android.core.designsystem.component.FishDivider
import com.fish.android.core.designsystem.component.FishNotice
import com.fish.android.core.designsystem.component.FishNoticeTone
import com.fish.android.core.designsystem.component.FishSkeleton
import com.fish.android.core.designsystem.component.FishIconButton
import com.fish.android.core.designsystem.component.FishIconButtonVariant
import com.fish.android.core.designsystem.component.FishStateTextField
import com.fish.android.core.designsystem.component.FishTopBar

private const val MessageLimit = 4_000
private const val CounterThreshold = 3_600

@Composable
fun ChatTopBar(
    participant: ParticipantUiModel,
    showBack: Boolean,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FishTopBar(
        title = participant.displayName,
        subtitle = participant.contextLabel,
        modifier = modifier,
        showBack = showBack,
        onBack = onBack,
        avatarName = participant.displayName,
    )
}

@Composable
fun MessageBubble(
    message: MessageUiModel,
    onToggleGif: () -> Unit = {},
    onReportGif: () -> Unit = {},
    onRetry: () -> Unit = {},
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
    val shape = messageShape(message)

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = if (message.isOutgoing) Alignment.End else Alignment.Start,
    ) {
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
        if (message.delivery != null) {
            MessageDeliveryStatus(
                status = message.delivery,
                modifier = Modifier.padding(
                    top = FishTheme.spacing.twoXs,
                    end = FishTheme.spacing.xs,
                ),
            )
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
    modifier: Modifier = Modifier,
    editable: Boolean = true,
    sendEnabled: Boolean = true,
    sending: Boolean = false,
) {
    val textLength = state.text.codePoints().count().toInt()
    val blank = state.text.isBlank() && pendingMedia == null
    val atLimit = textLength >= MessageLimit
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surface)
            .padding(FishTheme.spacing.page),
    ) {
        Text(
            text = stringResource(R.string.message_label),
            modifier = Modifier.padding(bottom = FishTheme.spacing.xs),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.label,
        )
        if (pendingMedia != null) {
            ComposerMediaPreview(
                media = pendingMedia,
                onRemove = onRemovePendingMedia,
                modifier = Modifier.padding(bottom = FishTheme.spacing.sm),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom,
        ) {
            FishIconButton(
                icon = FishIcons.AddMedia,
                contentDescription = stringResource(R.string.add_media),
                onClick = onOpenMediaPicker,
                enabled = editable,
                size = FishTheme.sizes.touchTarget,
            )
            Spacer(Modifier.width(FishTheme.spacing.xs))
            FishStateTextField(
                state = state,
                modifier = Modifier
                    .weight(1f),
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
            if (!blank) {
                Spacer(Modifier.width(FishTheme.spacing.xs))
                FishIconButton(
                    icon = FishIcons.Send,
                    contentDescription = if (sending) {
                        stringResource(R.string.sending_message)
                    } else {
                        stringResource(R.string.send_message)
                    },
                    onClick = onSend,
                    variant = FishIconButtonVariant.Filled,
                    enabled = sendEnabled && !sending,
                    size = FishTheme.sizes.primaryControl,
                )
            }
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
