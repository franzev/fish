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
