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
import androidx.compose.runtime.remember
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
import space.fishhub.android.feature.chat.logic.MessageMarkdownInline
import space.fishhub.android.feature.chat.logic.MessageMarkdownParser
import space.fishhub.android.feature.chat.model.MessageAction
import space.fishhub.android.feature.chat.model.MessageDeliveryUiState
import space.fishhub.android.feature.chat.model.MessageRowUiModel
import space.fishhub.android.feature.chat.model.MessageUiModel
import space.fishhub.android.feature.chat.model.ReplyPreviewUiModel
import space.fishhub.android.feature.chat.state.replyPreview

/**
 * Compose's accessibility delegate keeps a fixed pool of 32 custom-action IDs
 * per node (`AndroidComposeViewAccessibilityDelegateCompat`) and throws once a
 * node's `customActions` reaches that size. This cap is a platform ceiling, not
 * an arbitrary UX limit -- keep it well under 32 so a link-heavy message can
 * never crash the app for a TalkBack user. Links beyond the cap still appear in
 * the announced plain-text body (`MessageMarkdownParser.plainText` is uncapped)
 * but lose their individual "Open link" action -- an accepted tradeoff for an
 * already-extreme message, not a gap left to fix later. Internal (rather than
 * private) so MessageBubbleLinkCapTest can verify the cap directly.
 */
internal const val MaxLinkAccessibilityActions = 20

/** Caps [links] so a link-heavy message can never reach Compose's 32-action ceiling. */
internal fun capLinkAccessibilityActions(
    links: List<MessageMarkdownInline.Link>,
): List<MessageMarkdownInline.Link> = links.take(MaxLinkAccessibilityActions)

/**
 * Appends a 1-indexed occurrence suffix to a link's label when it collides with
 * another link's label in [links] -- e.g. two "here" links become "here (1)"
 * and "here (2)" -- so a TalkBack user can tell otherwise-identically-announced
 * custom actions apart. Only same-label collisions are disambiguated; hrefs are
 * not considered, and labels with no collision are returned unchanged.
 */
internal fun disambiguateLinkLabels(links: List<MessageMarkdownInline.Link>): List<String> {
    val countsByLabel = links.groupingBy { it.label }.eachCount()
    val occurrenceByLabel = mutableMapOf<String, Int>()
    return links.map { link ->
        if ((countsByLabel[link.label] ?: 0) <= 1) {
            link.label
        } else {
            val occurrence = (occurrenceByLabel[link.label] ?: 0) + 1
            occurrenceByLabel[link.label] = occurrence
            "${link.label} ($occurrence)"
        }
    }
}

@Composable
fun MessageBubble(
    row: MessageRowUiModel,
    onAction: (MessageAction) -> Unit = {},
    onRetry: (String) -> Unit = {},
    reactionsEnabled: Boolean = true,
    modifier: Modifier = Modifier,
) {
    val message = row.message
    val playingVoiceId = row.playingVoiceAttachmentId
    val colors = FishTheme.colors
    val container = if (message.isOutgoing) colors.primary else colors.surfaceAlt
    val content = if (message.isOutgoing) colors.onPrimary else colors.foreground
    val author = if (message.isOutgoing) stringResource(R.string.you) else message.senderName
    val deletedPlaceholder = stringResource(R.string.message_deleted)
    val accessibilityBody = remember(message.deleted, message.body, deletedPlaceholder) {
        if (message.deleted) deletedPlaceholder else MessageMarkdownParser.plainText(message.body)
    }
    val semantics = stringResource(
        R.string.message_accessibility,
        author,
        accessibilityBody,
        message.timeLabel,
    )
    val messageLinks = remember(message.deleted, message.body) {
        if (message.deleted) emptyList() else MessageMarkdownParser.extractLinks(message.body)
    }
    val uriHandler = LocalUriHandler.current
    val cappedLinks = capLinkAccessibilityActions(messageLinks)
    val linkLabels = disambiguateLinkLabels(cappedLinks)
    val linkActions = cappedLinks.mapIndexed { index, link ->
        CustomAccessibilityAction(stringResource(R.string.open_message_link, linkLabels[index])) {
            runCatching { uriHandler.openUri(link.href) }
            true
        }
    }
    val messageActionsLabel = stringResource(R.string.more_message_actions)
    val shape = messageShape(row)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (message.actionsEnabled) {
                    Modifier.pointerInput(message.id) {
                        detectTapGestures(onLongPress = { onAction(MessageAction.OpenActions(message.id)) })
                    }
                } else {
                    Modifier
                },
            )
            .semantics {
                if (message.actionsEnabled) {
                    customActions = listOf(
                        CustomAccessibilityAction(messageActionsLabel) {
                            onAction(MessageAction.OpenActions(message.id))
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
                onClick = { onAction(MessageAction.OpenReplyPreview(reply.messageId)) },
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
                onTogglePlayback = { onAction(MessageAction.ToggleGif(message.id)) },
                onReport = { onAction(MessageAction.ReportGif(message.id)) },
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
                onPhotoClick = { onAction(MessageAction.OpenPhotoAttachment(message.id, it)) },
                onFileClick = { onAction(MessageAction.OpenFileAttachment(message.id, it)) },
                onFileShare = { onAction(MessageAction.ShareFileAttachment(message.id, it)) },
                playingVoiceId = playingVoiceId,
                onToggleVoice = { onAction(MessageAction.ToggleVoice(message.id, it)) },
                onAttachmentLoadError = { onAction(MessageAction.AttachmentLoadFailed(message.id, it)) },
                onPhotoLoadError = { onAction(MessageAction.AttachmentLoadFailed(message.id, it)) },
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
                    .clearAndSetSemantics {
                        contentDescription = semantics
                        if (linkActions.isNotEmpty()) {
                            customActions = linkActions
                        }
                    },
            ) {
                if (message.deleted) {
                    Text(
                        text = deletedPlaceholder,
                        color = if (message.isOutgoing) content.copy(alpha = 0.78f) else colors.muted,
                        style = FishTheme.typography.body,
                    )
                } else {
                    MessageBody(body = message.body, isOutgoing = message.isOutgoing)
                }
            }
        }
        message.linkPreview?.let { preview ->
            LinkPreviewSurface(preview)
        }
        if (row.showsDeliveryStatus && message.delivery != null) {
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
                        enabled = reactionsEnabled && message.reactionsEnabled,
                        onClick = { onAction(MessageAction.ToggleReaction(message.id, reaction.emoji)) },
                    )
                }
                AddReactionPill(
                    description = stringResource(R.string.add_reaction),
                    enabled = reactionsEnabled && message.reactionsEnabled,
                    onClick = { onAction(MessageAction.AddReaction(message.id)) },
                )
            }
        }
        if (message.delivery == MessageDeliveryUiState.Failed) {
            FishButton(
                label = stringResource(R.string.retry_failed_message),
                onClick = { onRetry(message.id) },
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
private fun messageShape(row: MessageRowUiModel): Shape {
    val outer = FishTheme.radii.chat
    val inner = FishTheme.radii.chatInner
    return if (row.message.isOutgoing) {
        RoundedCornerShape(
            topStart = outer,
            topEnd = if (row.continuesPrevious) inner else outer,
            bottomStart = outer,
            bottomEnd = if (row.continuesNext) inner else outer,
        )
    } else {
        RoundedCornerShape(
            topStart = if (row.continuesPrevious) inner else outer,
            topEnd = outer,
            bottomStart = if (row.continuesNext) inner else outer,
            bottomEnd = outer,
        )
    }
}
