package space.fishhub.android.feature.chat

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.views.StickerMedia
import space.fishhub.android.feature.chat.views.ReactionPill
import space.fishhub.android.feature.chat.views.OlderMessagesSlot
import space.fishhub.android.feature.chat.views.MessageFileCard
import space.fishhub.android.feature.chat.views.AddReactionPill
import space.fishhub.android.feature.chat.model.StickerUiModel
import space.fishhub.android.feature.chat.model.OlderMessagesUiState
import space.fishhub.android.feature.chat.model.AttachmentUiModel
import space.fishhub.android.feature.chat.model.AttachmentUiKind
import androidx.compose.foundation.layout.Row
import space.fishhub.android.feature.chat.model.MessageDeliveryUiState
import space.fishhub.android.feature.chat.model.MessageUiModel
import space.fishhub.android.feature.chat.model.ReactionUiModel
import space.fishhub.android.feature.chat.model.ReplyPreviewUiModel
import space.fishhub.android.feature.chat.model.toRow
import space.fishhub.android.feature.chat.views.ChatConnectionNotice
import space.fishhub.android.feature.chat.views.MessageBubble
import space.fishhub.android.feature.chat.views.MessageDaySeparator
import space.fishhub.android.feature.chat.views.TypingIndicator
import space.fishhub.android.feature.chat.views.UnreadMessagesDivider
import space.fishhub.android.feature.chat.model.ChatConnectionUiState

// Component-level screenshot cases. The `name` of each preview matches the
// `named:` string FishKit passes to assertThemedSnapshots, so a case can be
// compared against its iOS counterpart. Screen-level cases live in
// ChatScreenshotTest.

@Composable
private fun ComponentStrip(darkTheme: Boolean, content: @Composable () -> Unit) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        ) {
            content()
        }
    }
}

private fun message(
    id: String,
    body: String,
    isOutgoing: Boolean,
    delivery: MessageDeliveryUiState? = null,
    groupedWithPrevious: Boolean = false,
    groupedWithNext: Boolean = false,
    reactions: List<ReactionUiModel> = emptyList(),
    replyPreview: ReplyPreviewUiModel? = null,
    deleted: Boolean = false,
    edited: Boolean = false,
) = MessageUiModel(
    id = id,
    senderName = if (isOutgoing) "You" else "Coach Jordan",
    body = body,
    timeLabel = "10:36",
    isOutgoing = isOutgoing,
    delivery = delivery,
    groupedWithPrevious = groupedWithPrevious,
    groupedWithNext = groupedWithNext,
    reactions = reactions,
    replyPreview = replyPreview,
    deleted = deleted,
    edited = edited,
)

/** Direction, grouping, delivery, reactions, reply, edited and deleted states. */
@Composable
private fun MessageBubbleStates() {
    MessageBubble(row = message("m1", "Good morning. How did the practice feel?", false).toRow())
    MessageBubble(
        row = message("m2", "It felt steadier than last week.", true, groupedWithNext = true)
            .toRow(),
    )
    MessageBubble(
        row = message(
            "m3",
            "I paused before the last sentence.",
            true,
            delivery = MessageDeliveryUiState.Read,
            groupedWithPrevious = true,
        ).toRow(),
    )
    MessageBubble(
        row = message("m4", "That pause is the whole skill.", false, edited = true).toRow(),
    )
    MessageBubble(
        row = message(
            "m5",
            "Thank you.",
            true,
            delivery = MessageDeliveryUiState.Sending,
        ).toRow(),
    )
    MessageBubble(
        row = message(
            "m6",
            "This one did not send.",
            true,
            delivery = MessageDeliveryUiState.Failed,
        ).toRow(),
    )
    MessageBubble(
        row = message(
            "m7",
            "Try the opening line once more.",
            false,
            reactions = listOf(ReactionUiModel(emoji = "👍", count = 2, byMe = true)),
        ).toRow(),
    )
    MessageBubble(
        row = message(
            "m8",
            "Here is the reply.",
            true,
            replyPreview = ReplyPreviewUiModel(
                messageId = "m7",
                authorName = "Coach Jordan",
                snippet = "Try the opening line once more.",
            ),
        ).toRow(),
    )
    MessageBubble(row = message("m9", "", false, deleted = true).toRow())
}

@PreviewTest
@Preview(name = "message-bubbles-light", widthDp = 412, showBackground = true)
@Composable
fun MessageBubblesLightScreenshot() {
    ComponentStrip(darkTheme = false) { MessageBubbleStates() }
}

@PreviewTest
@Preview(
    name = "message-bubbles-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun MessageBubblesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { MessageBubbleStates() }
}

/** The quiet transcript chrome: separators, typing, connection notices. */
@Composable
private fun ChatChromeStates() {
    MessageDaySeparator("Today")
    UnreadMessagesDivider()
    TypingIndicator(name = "Coach Jordan")
    ChatConnectionNotice(state = ChatConnectionUiState.Connecting)
    ChatConnectionNotice(state = ChatConnectionUiState.Reconnecting)
    ChatConnectionNotice(state = ChatConnectionUiState.Offline)
}

@PreviewTest
@Preview(name = "chat-chrome-light", widthDp = 412, showBackground = true)
@Composable
fun ChatChromeLightScreenshot() {
    ComponentStrip(darkTheme = false) { ChatChromeStates() }
}

@PreviewTest
@Preview(
    name = "chat-chrome-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun ChatChromeDarkScreenshot() {
    ComponentStrip(darkTheme = true) { ChatChromeStates() }
}

private fun fileAttachment(kind: AttachmentUiKind, name: String) = AttachmentUiModel(
    id = "att-$name",
    position = 0,
    kind = kind,
    available = true,
    name = name,
    mimeType = "application/pdf",
    byteSize = 248_000,
    width = null,
    height = null,
    thumbnailUrl = null,
    displayUrl = null,
    contentVersion = "screenshot",
)

/** Reaction pills: counted, mine, and the add affordance, enabled and not. */
@Composable
private fun ReactionStates() {
    Row(horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs)) {
        ReactionPill(
            reaction = ReactionUiModel(emoji = "\uD83D\uDC4D", count = 1, byMe = false),
            description = "Thumbs up, 1 person",
            enabled = true,
            onClick = {},
        )
        ReactionPill(
            reaction = ReactionUiModel(emoji = "\uD83C\uDF89", count = 4, byMe = true),
            description = "Party popper, 4 people, including you",
            enabled = true,
            onClick = {},
        )
        AddReactionPill(description = "Add a reaction", enabled = true, onClick = {})
        AddReactionPill(description = "Add a reaction", enabled = false, onClick = {})
    }
}

/** Transcript slot states for loading older history. */
@Composable
private fun OlderMessagesStates() {
    OlderMessagesSlot(state = OlderMessagesUiState.Idle, onRetry = {})
    OlderMessagesSlot(state = OlderMessagesUiState.Loading, onRetry = {})
    OlderMessagesSlot(state = OlderMessagesUiState.Failed, onRetry = {})
}

/** File attachment card, available and unavailable. */
@Composable
private fun MessageFileStates() {
    MessageFileCard(
        attachment = fileAttachment(AttachmentUiKind.File, "Practice notes.pdf"),
        author = "Coach Jordan",
        timeLabel = "10:36",
        onClick = {},
        onShare = {},
    )
    MessageFileCard(
        attachment = fileAttachment(AttachmentUiKind.File, "Coaching outline.pdf")
            .copy(available = false),
        author = "Coach Jordan",
        timeLabel = "10:37",
        onClick = {},
        onShare = {},
    )
}

/** Sticker bubble, available and missing from the catalog. */
@Composable
private fun StickerStates() {
    StickerMedia(
        sticker = StickerUiModel(
            id = "aquatic-great-job-sea-star",
            phrase = "Great job",
            description = "Great job sticker",
            assetPath = null,
        ),
        author = "Coach Jordan",
        timeLabel = "10:36",
    )
}

@PreviewTest
@Preview(name = "reaction-states-light", widthDp = 412, showBackground = true)
@Composable
fun ReactionStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { ReactionStates() }
}

@PreviewTest
@Preview(
    name = "reaction-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun ReactionStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { ReactionStates() }
}

@PreviewTest
@Preview(name = "older-messages-states-light", widthDp = 412, showBackground = true)
@Composable
fun OlderMessagesStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { OlderMessagesStates() }
}

@PreviewTest
@Preview(name = "message-file-states-light", widthDp = 412, showBackground = true)
@Composable
fun MessageFileStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { MessageFileStates() }
}

@PreviewTest
@Preview(name = "sticker-states-light", widthDp = 412, showBackground = true)
@Composable
fun StickerStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { StickerStates() }
}
