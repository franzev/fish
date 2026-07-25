package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.model.MessageDeliveryUiState
import space.fishhub.android.feature.chat.model.MessageUiModel
import space.fishhub.android.feature.chat.model.ReplyPreviewUiModel
import space.fishhub.android.feature.chat.state.replyPreview

@Composable
fun MessageBubble(
    message: MessageUiModel,
    onToggleGif: () -> Unit = {},
    onReportGif: () -> Unit = {},
    onRetry: () -> Unit = {},
    onPhotoAttachmentClick: (String) -> Unit = {},
    onFileAttachmentClick: (String) -> Unit = {},
    onFileAttachmentShare: (String) -> Unit = {},
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
            StickerMedia(
                sticker = sticker,
                author = author,
                timeLabel = message.timeLabel,
            )
        }
        message.gif?.let { gif ->
            GifMedia(
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
            MessageAttachments(
                attachments = message.attachments,
                author = author,
                timeLabel = message.timeLabel,
                onPhotoClick = onPhotoAttachmentClick,
                onFileClick = onFileAttachmentClick,
                onFileShare = onFileAttachmentShare,
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
                    ReactionPill(
                        reaction = reaction,
                        description = reactionDescription,
                        enabled = message.reactionsEnabled,
                        onClick = { onToggleReaction(reaction.emoji) },
                    )
                }
                AddReactionPill(
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
