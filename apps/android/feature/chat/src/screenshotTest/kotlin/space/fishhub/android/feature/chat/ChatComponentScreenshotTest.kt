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
import java.time.Instant
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.chat.ConversationMute
import space.fishhub.android.feature.chat.views.ConversationQuietRow
import space.fishhub.android.feature.chat.views.ConversationRow
import space.fishhub.android.feature.chat.views.PinnedMessageBanner
import space.fishhub.android.feature.chat.sharedcontent.ShowEarlierBoundary
import space.fishhub.android.feature.chat.sharedcontent.SharedContentUnavailableState
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGallerySkeleton
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryNotice
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryCategory
import space.fishhub.android.feature.chat.sharedcontent.SharedContentEarlierState
import space.fishhub.android.feature.chat.sharedcontent.SharedContentCategoryBar
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

/**
 * Markdown-formatted bubbles: bold, inline code, a link, a two-item list, and
 * a fenced block, one incoming and one outgoing. Kept as its own strip rather
 * than folded into [MessageBubbleStates] because the screenshot renderer caps
 * a preview's captured height at a fixed pixel ceiling for this width — the
 * base strip is already close to it, and appending this content there
 * silently clipped everything after the first new line out of the PNG.
 */
@Composable
private fun MarkdownBubbleStates() {
    MessageBubble(
        row = message(
            "m10",
            """
                Good momentum this week. **Keep leaning into that.** Try finishing this sentence a few times before we meet again:

                ```
                I feel confident when I ___.
                ```

                There are more like it here: [more sentence starters](https://example.com/resources/sentence-starters)
            """.trimIndent(),
            false,
        ).toRow(),
    )
    MessageBubble(
        row = message(
            "m11",
            """
                Filled it in twice today:
                - Said `I feel confident when I speak slowly` out loud
                - Recorded the second try and listened back
            """.trimIndent(),
            true,
        ).toRow(),
    )
}

@PreviewTest
@Preview(name = "message-bubbles-markdown-light", widthDp = 412, showBackground = true)
@Composable
fun MessageBubblesMarkdownLightScreenshot() {
    ComponentStrip(darkTheme = false) { MarkdownBubbleStates() }
}

@PreviewTest
@Preview(
    name = "message-bubbles-markdown-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun MessageBubblesMarkdownDarkScreenshot() {
    ComponentStrip(darkTheme = true) { MarkdownBubbleStates() }
}

/**
 * A one-level nested list, its own strip so a regression in
 * [space.fishhub.android.feature.chat.views.MarkdownListView]'s indentation
 * step is caught by this suite rather than only by manually inspecting its
 * (non-screenshot-tested) `@Preview`.
 */
@Composable
private fun NestedListBubbleState() {
    MessageBubble(
        row = message(
            "m12",
            """
                Before next session:
                1. Warm up with slow breathing
                   - Four counts in
                   - Four counts out
                2. Read the opening line aloud
            """.trimIndent(),
            false,
        ).toRow(),
    )
}

@PreviewTest
@Preview(name = "message-bubble-nested-list-light", widthDp = 412, showBackground = true)
@Composable
fun MessageBubbleNestedListLightScreenshot() {
    ComponentStrip(darkTheme = false) { NestedListBubbleState() }
}

@PreviewTest
@Preview(
    name = "message-bubble-nested-list-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun MessageBubbleNestedListDarkScreenshot() {
    ComponentStrip(darkTheme = true) { NestedListBubbleState() }
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

/** Category bar, notices, skeleton, unavailable state and the earlier boundary. */
@Composable
private fun SharedContentChromeStates() {
    SharedContentCategoryBar(
        categories = SharedContentGalleryCategory.entries.toList(),
        selectedCategory = SharedContentGalleryCategory.Media,
        onSelect = {},
    )
    SharedContentGalleryNotice(message = "Checking for updates\u2026")
    SharedContentGalleryNotice(
        message = "We couldn't check for updates.",
        actionLabel = "Try again",
        onAction = {},
    )
    SharedContentGallerySkeleton(category = SharedContentGalleryCategory.Media)
    SharedContentUnavailableState(
        title = "Nothing shared yet",
        description = "Photos and files you exchange will collect here.",
    )
    SharedContentUnavailableState(
        title = "You're offline",
        description = "This content is saved on this device and may be out of date.",
        retryAllowed = true,
        onRetry = {},
    )
    ShowEarlierBoundary(state = SharedContentEarlierState.Ready, onShowEarlier = {})
    ShowEarlierBoundary(state = SharedContentEarlierState.Loading, onShowEarlier = {})
    ShowEarlierBoundary(state = SharedContentEarlierState.Failed, onShowEarlier = {})
}

@PreviewTest
@Preview(name = "shared-content-chrome-light", widthDp = 412, showBackground = true)
@Composable
fun SharedContentChromeLightScreenshot() {
    ComponentStrip(darkTheme = false) { SharedContentChromeStates() }
}

@PreviewTest
@Preview(
    name = "shared-content-chrome-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun SharedContentChromeDarkScreenshot() {
    ComponentStrip(darkTheme = true) { SharedContentChromeStates() }
}

// Only the two states whose wording carries no clock time, so these baselines
// stay identical on any machine. The "Quiet until <time>" wording is pinned to
// a fixed zone and locale in ConversationQuietCopyTest instead, and it is
// always shorter than the open-ended wording rendered here.
private val QuietNow: Instant = Instant.ofEpochSecond(1_753_437_600)

@Composable
private fun ConversationQuietStates() {
    ConversationQuietRow(
        mute = ConversationMute.On,
        optionsShown = false,
        onToggleOptions = {},
        onSelect = {},
        now = QuietNow,
    )
    ConversationQuietRow(
        mute = ConversationMute(isMuted = true, mutedUntil = null),
        optionsShown = false,
        onToggleOptions = {},
        onSelect = {},
        now = QuietNow,
    )
}

@Composable
private fun ConversationQuietOptionStates() {
    ConversationQuietRow(
        mute = ConversationMute.On,
        optionsShown = true,
        onToggleOptions = {},
        onSelect = {},
        now = QuietNow,
    )
    ConversationQuietRow(
        mute = ConversationMute(isMuted = true, mutedUntil = null),
        optionsShown = true,
        onToggleOptions = {},
        onSelect = {},
        now = QuietNow,
    )
}

@PreviewTest
@Preview(name = "conversation-quiet-states-light", widthDp = 412, showBackground = true)
@Composable
fun ConversationQuietStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { ConversationQuietStates() }
}

@PreviewTest
@Preview(
    name = "conversation-quiet-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun ConversationQuietStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { ConversationQuietStates() }
}

@PreviewTest
@Preview(name = "conversation-quiet-options-light", widthDp = 412, showBackground = true)
@Composable
fun ConversationQuietOptionsLightScreenshot() {
    ComponentStrip(darkTheme = false) { ConversationQuietOptionStates() }
}

@PreviewTest
@Preview(
    name = "conversation-quiet-options-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun ConversationQuietOptionsDarkScreenshot() {
    ComponentStrip(darkTheme = true) { ConversationQuietOptionStates() }
}

/** The pinned-message banner: a short snippet and one that must tail-truncate. */
@Composable
private fun PinnedMessageBannerStates() {
    PinnedMessageBanner(
        snippet = "Keep this handy: I would like to practice.",
        onClick = {},
    )
    PinnedMessageBanner(
        snippet = "This is a much longer pinned phrase than the banner row can " +
            "show on one line, so it must truncate with an ellipsis instead of wrapping.",
        onClick = {},
    )
}

@PreviewTest
@Preview(name = "pinned-message-banner-light", widthDp = 412, showBackground = true)
@Composable
fun PinnedMessageBannerLightScreenshot() {
    ComponentStrip(darkTheme = false) { PinnedMessageBannerStates() }
}

@PreviewTest
@Preview(
    name = "pinned-message-banner-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun PinnedMessageBannerDarkScreenshot() {
    ComponentStrip(darkTheme = true) { PinnedMessageBannerStates() }
}

@Composable
private fun ConversationRowStates() {
    ConversationRow(
        name = "Sam Rivera",
        snippet = "You: I used the pause twice",
        time = "4m",
        unreadCount = 0,
        selected = false,
        onClick = {},
    )
    // Quiet and unread at once: the marker appears, the count stands.
    ConversationRow(
        name = "Alexandria Morgan-Santos",
        snippet = "Would tomorrow morning feel manageable?",
        time = "2h",
        unreadCount = 128,
        selected = false,
        onClick = {},
        isQuiet = true,
    )
}

@PreviewTest
@Preview(name = "conversation-row-states-light", widthDp = 412, showBackground = true)
@Composable
fun ConversationRowStatesLightScreenshot() {
    ComponentStrip(darkTheme = false) { ConversationRowStates() }
}

@PreviewTest
@Preview(
    name = "conversation-row-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun ConversationRowStatesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { ConversationRowStates() }
}
