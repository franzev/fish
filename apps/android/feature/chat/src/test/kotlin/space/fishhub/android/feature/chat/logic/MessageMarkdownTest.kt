package space.fishhub.android.feature.chat.logic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors `MessageMarkdownTests.swift` one for one, then layers on the inline
 * and href cases from `message-body-parser.test.ts` plus coverage for
 * [MessageMarkdownParser.plainText], which has no reference implementation on
 * the other two clients.
 */
class MessageMarkdownTest {

    // Ported from MessageMarkdownTests.swift.

    @Test
    fun `parses the mirrored block grammar`() {
        val blocks = MessageMarkdownParser.parse(
            "# Heading\n\n> Keep going\n\n- First\n  - Detail\n\n1. One\n2. Two\n\n```ts\nlet value = 1\n```",
        )
        assertEquals(5, blocks.size)
        assertEquals(
            MessageMarkdownBlock.Heading(1, listOf(MessageMarkdownInline.Text("Heading"))),
            blocks[0],
        )
        assertEquals(
            MessageMarkdownBlock.Blockquote(listOf(listOf(MessageMarkdownInline.Text("Keep going")))),
            blocks[1],
        )

        val bullets = (blocks[2] as MessageMarkdownBlock.Bullets).list
        assertFalse(bullets.ordered)
        assertEquals(
            listOf(MessageMarkdownInline.Text("Detail")),
            bullets.items.first().children?.items?.first()?.content,
        )

        val numbers = (blocks[3] as MessageMarkdownBlock.Bullets).list
        assertTrue(numbers.ordered)

        assertEquals(MessageMarkdownBlock.Code("ts", "let value = 1"), blocks[4])

        val standalone = MessageMarkdownParser.parse("1. One\n2. Two")
        assertTrue((standalone[0] as MessageMarkdownBlock.Bullets).list.ordered)
    }

    @Test
    fun `parses inline emphasis code and safe links`() {
        val blocks = MessageMarkdownParser.parse(
            "A **bold** *star* _line_ `code` [guide](https://example.com) [mail](mailto:help@example.com).",
        )
        val line = (blocks.first() as MessageMarkdownBlock.Paragraph).lines[0]
        assertTrue(line.contains(MessageMarkdownInline.Bold("bold")))
        assertTrue(line.contains(MessageMarkdownInline.Italic("star")))
        assertTrue(line.contains(MessageMarkdownInline.Italic("line")))
        assertTrue(line.contains(MessageMarkdownInline.Code("code")))
        assertTrue(line.contains(MessageMarkdownInline.Link("guide", "https://example.com")))
        assertTrue(line.contains(MessageMarkdownInline.Link("mail", "mailto:help@example.com")))
    }

    @Test
    fun `neutralizes executable or malformed destinations`() {
        for (href in listOf("javascript:alert(1)", "data:text/html,test", "file:///tmp/a", "example.com")) {
            assertNull(MessageMarkdownParser.sanitizedHref(href))
        }
        assertEquals("HTTPS://example.com", MessageMarkdownParser.sanitizedHref(" HTTPS://example.com "))

        val blocks = MessageMarkdownParser.parse("Click [here](javascript:alert(1)) now.")
        val line = (blocks.first() as MessageMarkdownBlock.Paragraph).lines[0]
        assertTrue(line.contains(MessageMarkdownInline.Text("here")))
        assertFalse(line.any { it is MessageMarkdownInline.Link })
    }

    @Test
    fun `empty whitespace and line breaks stay calm`() {
        assertTrue(MessageMarkdownParser.parse("").isEmpty())
        assertTrue(MessageMarkdownParser.parse("  \n ").isEmpty())

        val blocks = MessageMarkdownParser.parse("First\nSecond\n\nThird")
        assertEquals(2, blocks.size)
        assertEquals(2, (blocks[0] as MessageMarkdownBlock.Paragraph).lines.size)
    }

    @Test
    fun `adjacent list kinds remain distinct blocks`() {
        val blocks = MessageMarkdownParser.parse("- One\n- Two\n\n1. Breathe\n2. Begin")
        assertEquals(2, blocks.size)
        assertFalse((blocks[0] as MessageMarkdownBlock.Bullets).list.ordered)
        assertTrue((blocks[1] as MessageMarkdownBlock.Bullets).list.ordered)
    }

    // Explicit coverage beyond the mirrored suite (plan requirements and review follow-ups).

    @Test
    fun `normalizes CRLF line endings before parsing`() {
        assertEquals(
            MessageMarkdownParser.parse("First\nSecond"),
            MessageMarkdownParser.parse("First\r\nSecond"),
        )
        assertEquals(
            MessageMarkdownParser.parse("# Heading\n\nBody text"),
            MessageMarkdownParser.parse("# Heading\r\n\r\nBody text"),
        )
    }

    @Test
    fun `a marker kind change ends the list without a blank line`() {
        val blocks = MessageMarkdownParser.parse("- One\n1. Two")
        assertEquals(2, blocks.size)

        val bullets = (blocks[0] as MessageMarkdownBlock.Bullets).list
        assertFalse(bullets.ordered)
        assertEquals(listOf(MessageMarkdownInline.Text("One")), bullets.items.single().content)

        val numbers = (blocks[1] as MessageMarkdownBlock.Bullets).list
        assertTrue(numbers.ordered)
        assertEquals(listOf(MessageMarkdownInline.Text("Two")), numbers.items.single().content)
    }

    @Test
    fun `nested ordered list items stay ordered`() {
        val blocks = MessageMarkdownParser.parse("1. one\n   1. two")
        val list = (blocks.single() as MessageMarkdownBlock.Bullets).list
        assertTrue(list.ordered)

        val nested = list.items.single().children
        assertEquals(true, nested?.ordered)
        assertEquals(listOf(MessageMarkdownInline.Text("two")), nested?.items?.single()?.content)
    }

    @Test
    fun `a fence without a language has a null language`() {
        val blocks = MessageMarkdownParser.parse("```\nplain\n```")
        assertEquals(MessageMarkdownBlock.Code(null, "plain"), blocks.single())
    }

    @Test
    fun `keeps an unclosed fence as one code block`() {
        val blocks = MessageMarkdownParser.parse("```ts\nconst answer = 42;")
        assertEquals(MessageMarkdownBlock.Code("ts", "const answer = 42;"), blocks.single())
    }

    @Test
    fun `heading levels one through three are recognized`() {
        val blocks = MessageMarkdownParser.parse("# One\n\n## Two\n\n### Three")
        assertEquals(3, blocks.size)
        assertEquals(1, (blocks[0] as MessageMarkdownBlock.Heading).level)
        assertEquals(2, (blocks[1] as MessageMarkdownBlock.Heading).level)
        assertEquals(3, (blocks[2] as MessageMarkdownBlock.Heading).level)
    }

    @Test
    fun `relative hrefs fall back to label text`() {
        val blocks = MessageMarkdownParser.parse("See [docs](/help) now.")
        val line = (blocks.single() as MessageMarkdownBlock.Paragraph).lines[0]
        assertTrue(line.contains(MessageMarkdownInline.Text("docs")))
        assertFalse(line.any { it is MessageMarkdownInline.Link })
    }

    // Ported from message-body-parser.test.ts.

    @Test
    fun `neutralizes unsafe href schemes including html injection payloads`() {
        for (href in listOf("javascript:alert(1)", "data:text/html,<script>alert(1)</script>")) {
            assertNull(MessageMarkdownParser.sanitizedHref(href))
        }
    }

    @Test
    fun `keeps safe href schemes and balanced url parentheses`() {
        assertEquals(
            "https://example.com/Article_(test)",
            MessageMarkdownParser.sanitizedHref("https://example.com/Article_(test)"),
        )
        assertEquals("mailto:help@example.com", MessageMarkdownParser.sanitizedHref("mailto:help@example.com"))

        val blocks = MessageMarkdownParser.parse("See [wiki](https://example.com/Article_(test)) now.")
        val line = (blocks.single() as MessageMarkdownBlock.Paragraph).lines[0]
        assertTrue(line.contains(MessageMarkdownInline.Link("wiki", "https://example.com/Article_(test)")))
    }

    // plainText has no reference implementation; it is new in this port.

    @Test
    fun `plain text drops all markdown syntax`() {
        val text = MessageMarkdownParser.plainText(
            "# Heading\n\nA **bold** *star* _line_ `code` [guide](https://example.com).",
        )
        assertFalse(text.contains("*"))
        assertFalse(text.contains("`"))
        assertFalse(text.contains("["))
        assertFalse(text.contains("]"))
        assertTrue(text.contains("Heading"))
        assertTrue(text.contains("bold"))
        assertTrue(text.contains("star"))
        assertTrue(text.contains("line"))
        assertTrue(text.contains("code"))
        assertTrue(text.contains("guide"))
    }

    @Test
    fun `plain text flattens nested list content without markers`() {
        val text = MessageMarkdownParser.plainText("- First\n  - Detail")
        assertTrue(text.contains("First"))
        assertTrue(text.contains("Detail"))
        assertFalse(text.contains("-"))
    }

    @Test
    fun `plain text of an empty body is empty`() {
        assertEquals("", MessageMarkdownParser.plainText(""))
    }
}
