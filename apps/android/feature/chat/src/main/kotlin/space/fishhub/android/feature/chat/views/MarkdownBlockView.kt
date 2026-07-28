package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.logic.MessageMarkdownBlock
import space.fishhub.android.feature.chat.logic.MessageMarkdownInline
import space.fishhub.android.feature.chat.logic.MessageMarkdownList
import space.fishhub.android.feature.chat.logic.MessageMarkdownListItem

/**
 * Renders one parsed markdown block. Ported from iOS's `MarkdownBlockView`
 * (`apps/ios/FishKit/Sources/PersonalChat/Views/MarkdownBlockView.swift`):
 * same five block kinds, same per-kind treatment. [isOutgoing] only decides
 * the code fence's fill and the blockquote's border colour here — the text
 * foreground and base size are inherited from [LocalContentColor] and
 * [LocalTextStyle], which [MessageBody] sets once for the whole message.
 */
@Composable
fun MarkdownBlockView(
    block: MessageMarkdownBlock,
    isOutgoing: Boolean,
    modifier: Modifier = Modifier,
) {
    when (block) {
        is MessageMarkdownBlock.Code -> CodeFence(block, isOutgoing, modifier)

        is MessageMarkdownBlock.Heading -> Text(
            text = inlineText(block.content),
            style = if (block.level == 1) FishTheme.typography.heading else FishTheme.typography.label,
            modifier = modifier,
        )

        is MessageMarkdownBlock.Blockquote -> Text(
            text = linesText(block.lines),
            modifier = modifier
                .border(
                    width = FishTheme.spacing.threeXs,
                    color = (if (isOutgoing) FishTheme.colors.onPrimary else FishTheme.colors.foreground)
                        .copy(alpha = 0.3f),
                    shape = RoundedCornerShape(FishTheme.radii.control),
                )
                .padding(horizontal = FishTheme.spacing.sm, vertical = FishTheme.spacing.xs),
        )

        is MessageMarkdownBlock.Bullets -> MarkdownListView(
            list = block.list,
            isOutgoing = isOutgoing,
            modifier = modifier,
        )

        is MessageMarkdownBlock.Paragraph -> Text(text = linesText(block.lines), modifier = modifier)
    }
}

/** A fenced code block: an optional uppercase language caption above verbatim, monospaced content. */
@Composable
private fun CodeFence(block: MessageMarkdownBlock.Code, isOutgoing: Boolean, modifier: Modifier = Modifier) {
    val colors = FishTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(if (isOutgoing) colors.onPrimary.copy(alpha = 0.1f) else colors.surface)
            .horizontalScroll(rememberScrollState())
            .padding(FishTheme.spacing.sm),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
    ) {
        block.language?.let { language ->
            Text(
                text = language.uppercase(),
                color = if (isOutgoing) colors.onPrimary.copy(alpha = 0.7f) else colors.muted,
                style = FishTheme.typography.caption,
            )
        }
        Text(
            text = block.content,
            style = FishTheme.typography.ui,
            fontFamily = FontFamily.Monospace,
        )
    }
}

/** One line of inline runs, e.g. a heading's text or a list item's own content. */
private fun inlineText(content: List<MessageMarkdownInline>): AnnotatedString = buildAnnotatedString {
    appendInline(content)
}

/** Several lines of inline runs joined with newlines, e.g. a paragraph or a blockquote. */
private fun linesText(lines: List<List<MessageMarkdownInline>>): AnnotatedString = buildAnnotatedString {
    lines.forEachIndexed { index, line ->
        if (index > 0) append("\n")
        appendInline(line)
    }
}

private fun AnnotatedString.Builder.appendInline(content: List<MessageMarkdownInline>) {
    for (inline in content) {
        when (inline) {
            is MessageMarkdownInline.Text -> append(inline.text)

            is MessageMarkdownInline.Bold ->
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(inline.text) }

            is MessageMarkdownInline.Italic ->
                withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(inline.text) }

            is MessageMarkdownInline.Code ->
                withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { append(inline.text) }

            is MessageMarkdownInline.Link -> withLink(
                LinkAnnotation.Url(
                    url = inline.href,
                    styles = TextLinkStyles(style = SpanStyle(textDecoration = TextDecoration.Underline)),
                ),
            ) {
                append(inline.label)
            }
        }
    }
}

private val sampleHeadingBlock = MessageMarkdownBlock.Heading(
    level = 1,
    content = listOf(MessageMarkdownInline.Text("Practice plan")),
)

private val sampleSubheadingBlock = MessageMarkdownBlock.Heading(
    level = 2,
    content = listOf(MessageMarkdownInline.Text("Today's focus")),
)

private val sampleParagraphBlock = MessageMarkdownBlock.Paragraph(
    lines = listOf(
        listOf(
            MessageMarkdownInline.Text("Try "),
            MessageMarkdownInline.Bold("this exercise"),
            MessageMarkdownInline.Text(", keep "),
            MessageMarkdownInline.Italic("your pace"),
            MessageMarkdownInline.Text(" steady, and run "),
            MessageMarkdownInline.Code("npm test"),
            MessageMarkdownInline.Text(". Then skim the "),
            MessageMarkdownInline.Link("style guide", "https://example.com/guide"),
            MessageMarkdownInline.Text("."),
        ),
    ),
)

private val sampleCodeBlock = MessageMarkdownBlock.Code(
    language = "kotlin",
    content = "fun greet() = \"Hello\"",
)

private val sampleCodeNoLanguageBlock = MessageMarkdownBlock.Code(
    language = null,
    content = "echo \"no language tag\"",
)

private val sampleBlockquoteBlock = MessageMarkdownBlock.Blockquote(
    lines = listOf(listOf(MessageMarkdownInline.Text("Small steps still count."))),
)

private val sampleListBlock = MessageMarkdownBlock.Bullets(
    list = MessageMarkdownList(
        ordered = true,
        items = listOf(
            MessageMarkdownListItem(
                content = listOf(MessageMarkdownInline.Text("Warm up")),
                children = MessageMarkdownList(
                    ordered = false,
                    items = listOf(
                        MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Breathe"))),
                        MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Stretch"))),
                    ),
                ),
            ),
            MessageMarkdownListItem(content = listOf(MessageMarkdownInline.Text("Read aloud"))),
        ),
    ),
)

/** All five block kinds stacked inside a bubble-coloured surface, for one bubble direction. */
@Composable
private fun MarkdownBlockPreviewBubble(isOutgoing: Boolean) {
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
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            MarkdownBlockView(block = sampleHeadingBlock, isOutgoing = isOutgoing)
            MarkdownBlockView(block = sampleSubheadingBlock, isOutgoing = isOutgoing)
            MarkdownBlockView(block = sampleParagraphBlock, isOutgoing = isOutgoing)
            MarkdownBlockView(block = sampleCodeBlock, isOutgoing = isOutgoing)
            MarkdownBlockView(block = sampleCodeNoLanguageBlock, isOutgoing = isOutgoing)
            MarkdownBlockView(block = sampleBlockquoteBlock, isOutgoing = isOutgoing)
            MarkdownBlockView(block = sampleListBlock, isOutgoing = isOutgoing)
        }
    }
}

@Preview(name = "Markdown blocks light", showBackground = true, widthDp = 412)
@Composable
private fun MarkdownBlockViewLightPreview() {
    FishTheme(darkTheme = false) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            MarkdownBlockPreviewBubble(isOutgoing = false)
            MarkdownBlockPreviewBubble(isOutgoing = true)
        }
    }
}

@Preview(name = "Markdown blocks dark", showBackground = true, widthDp = 412)
@Composable
private fun MarkdownBlockViewDarkPreview() {
    FishTheme(darkTheme = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            MarkdownBlockPreviewBubble(isOutgoing = false)
            MarkdownBlockPreviewBubble(isOutgoing = true)
        }
    }
}
