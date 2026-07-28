package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.logic.MessageMarkdownBlock
import space.fishhub.android.feature.chat.logic.MessageMarkdownInline
import space.fishhub.android.feature.chat.logic.MessageMarkdownList
import space.fishhub.android.feature.chat.logic.MessageMarkdownListItem

/**
 * Renders a markdown list, recursing into itself for nested lists. Ported
 * from iOS's `MarkdownListView`
 * (`apps/ios/FishKit/Sources/PersonalChat/Views/MarkdownListView.swift`): a
 * marker glyph (`"1."`/`"2."`/… or `"•"`) sits beside each item's content,
 * baseline-aligned with it. The content itself is rendered by
 * [MarkdownBlockView] on a synthetic single-line paragraph, so bold, italic,
 * code and links inside a list item work without duplicating any inline
 * logic here.
 */
@Composable
fun MarkdownListView(
    list: MessageMarkdownList,
    isOutgoing: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(start = FishTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
    ) {
        list.items.forEachIndexed { index, item ->
            Row(horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
                Text(
                    text = if (list.ordered) "${index + 1}." else "•",
                    modifier = Modifier
                        .alignByBaseline()
                        .semantics { hideFromAccessibility() },
                )
                Column(
                    modifier = Modifier.alignByBaseline(),
                    verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                ) {
                    MarkdownBlockView(
                        block = MessageMarkdownBlock.Paragraph(lines = listOf(item.content)),
                        isOutgoing = isOutgoing,
                    )
                    item.children?.let { children ->
                        MarkdownListView(
                            list = children,
                            isOutgoing = isOutgoing,
                            modifier = Modifier.padding(start = FishTheme.spacing.md),
                        )
                    }
                }
            }
        }
    }
}

private val samplePracticeList = MessageMarkdownList(
    ordered = true,
    items = listOf(
        MessageMarkdownListItem(
            content = listOf(
                MessageMarkdownInline.Text("Warm up with "),
                MessageMarkdownInline.Bold("slow breathing"),
            ),
            children = MessageMarkdownList(
                ordered = false,
                items = listOf(
                    MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Four counts in"))),
                    MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Four counts out"))),
                ),
            ),
        ),
        MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Read the opening line aloud"))),
        MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Record yourself once"))),
    ),
)

/** A two-level ordered/unordered list inside a bubble-coloured surface, for one bubble direction. */
@Composable
private fun MarkdownListPreviewBubble(isOutgoing: Boolean) {
    val colors = FishTheme.colors
    CompositionLocalProvider(
        LocalContentColor provides if (isOutgoing) colors.onPrimary else colors.foreground,
        LocalTextStyle provides FishTheme.typography.body,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(FishTheme.radii.chat))
                .background(if (isOutgoing) colors.primary else colors.surfaceAlt)
                .padding(FishTheme.spacing.md),
        ) {
            MarkdownListView(list = samplePracticeList, isOutgoing = isOutgoing)
        }
    }
}

@Preview(name = "Markdown list light", showBackground = true, widthDp = 412)
@Composable
private fun MarkdownListViewLightPreview() {
    FishTheme(darkTheme = false) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            MarkdownListPreviewBubble(isOutgoing = false)
            MarkdownListPreviewBubble(isOutgoing = true)
        }
    }
}

@Preview(name = "Markdown list dark", showBackground = true, widthDp = 412)
@Composable
private fun MarkdownListViewDarkPreview() {
    FishTheme(darkTheme = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            MarkdownListPreviewBubble(isOutgoing = false)
            MarkdownListPreviewBubble(isOutgoing = true)
        }
    }
}
