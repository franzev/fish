package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.Preview
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.logic.EmojiOnlyMessage
import space.fishhub.android.feature.chat.logic.MessageMarkdownParser

/**
 * A chat message body: parses [body] as the shared chat-markdown subset
 * (`MessageMarkdownParser`, ported in the same shape on web and iOS) and
 * renders each block. Ported from iOS's `MessageBody`
 * (`apps/ios/FishKit/Sources/PersonalChat/Views/MessageBody.swift`): the
 * emoji-only size bump and the outgoing/incoming foreground colour are set
 * once here, via [LocalTextStyle] and [LocalContentColor], and inherited by
 * every block and inline run underneath — [MarkdownBlockView] only reaches
 * for [isOutgoing] directly where a fill or a border depends on it.
 */
@Composable
fun MessageBody(body: String, isOutgoing: Boolean, modifier: Modifier = Modifier) {
    val colors = FishTheme.colors
    val blocks = remember(body) { MessageMarkdownParser.parse(body) }
    val isEmojiOnly = remember(body) { EmojiOnlyMessage.isEmojiOnly(body) }

    CompositionLocalProvider(
        LocalContentColor provides if (isOutgoing) colors.onPrimary else colors.foreground,
        LocalTextStyle provides if (isEmojiOnly) FishTheme.typography.display else FishTheme.typography.body,
    ) {
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            blocks.forEach { block ->
                MarkdownBlockView(block = block, isOutgoing = isOutgoing)
            }
        }
    }
}

private val kitchenSinkBody = """
    # Practice plan

    Try **this exercise** and keep _your pace_ steady. Run `npm test` first, then check the [style guide](https://example.com/guide).

    ```kotlin
    fun greet() = "Hello"
    ```

    > Small steps still count.

    1. Warm up
    2. Read the opening line aloud
""".trimIndent()

private const val emojiOnlyBody = "🎉"

/** [MessageBody] inside a bubble-coloured surface, matching how MessageBubble will host it. */
@Composable
private fun MessageBodyPreviewBubble(body: String, isOutgoing: Boolean) {
    val colors = FishTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(FishTheme.radii.chat))
            .background(if (isOutgoing) colors.primary else colors.surfaceAlt)
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
    ) {
        MessageBody(body = body, isOutgoing = isOutgoing)
    }
}

@Preview(name = "Message body light", showBackground = true, widthDp = 412)
@Composable
private fun MessageBodyLightPreview() {
    FishTheme(darkTheme = false) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            MessageBodyPreviewBubble(body = kitchenSinkBody, isOutgoing = false)
            MessageBodyPreviewBubble(body = kitchenSinkBody, isOutgoing = true)
            MessageBodyPreviewBubble(body = emojiOnlyBody, isOutgoing = false)
        }
    }
}

@Preview(name = "Message body dark", showBackground = true, widthDp = 412)
@Composable
private fun MessageBodyDarkPreview() {
    FishTheme(darkTheme = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            MessageBodyPreviewBubble(body = kitchenSinkBody, isOutgoing = false)
            MessageBodyPreviewBubble(body = kitchenSinkBody, isOutgoing = true)
            MessageBodyPreviewBubble(body = emojiOnlyBody, isOutgoing = true)
        }
    }
}
