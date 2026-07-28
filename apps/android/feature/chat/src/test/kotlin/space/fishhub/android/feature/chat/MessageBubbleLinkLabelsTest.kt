package space.fishhub.android.feature.chat

import org.junit.Assert.assertEquals
import org.junit.Test
import space.fishhub.android.feature.chat.logic.MessageMarkdownInline
import space.fishhub.android.feature.chat.views.MaxLinkAccessibilityActions
import space.fishhub.android.feature.chat.views.capLinkAccessibilityActions
import space.fishhub.android.feature.chat.views.disambiguateLinkLabels

/**
 * Regression coverage for TalkBack custom actions announcing identically when
 * two links in one message share a visible label (e.g. "read it [here](a) or
 * [here](b)") -- disambiguateLinkLabels appends an occurrence suffix only when
 * a collision actually exists, so an unambiguous message gets no added noise.
 */
class MessageBubbleLinkLabelsTest {

    @Test
    fun `disambiguates two links with the same label but different hrefs`() {
        val links = listOf(
            MessageMarkdownInline.Link("here", "https://example.com/a"),
            MessageMarkdownInline.Link("here", "https://example.com/b"),
        )

        assertEquals(listOf("here (1)", "here (2)"), disambiguateLinkLabels(links))
    }

    @Test
    fun `leaves all unique labels unchanged`() {
        val links = listOf(
            MessageMarkdownInline.Link("style guide", "https://example.com/a"),
            MessageMarkdownInline.Link("docs", "https://example.com/b"),
        )

        assertEquals(listOf("style guide", "docs"), disambiguateLinkLabels(links))
    }

    @Test
    fun `leaves labels unchanged when only the href repeats`() {
        val links = listOf(
            MessageMarkdownInline.Link("style guide", "https://example.com/a"),
            MessageMarkdownInline.Link("the guide", "https://example.com/a"),
        )

        assertEquals(listOf("style guide", "the guide"), disambiguateLinkLabels(links))
    }

    @Test
    fun `disambiguates only the labels that actually collide`() {
        val links = listOf(
            MessageMarkdownInline.Link("here", "https://example.com/a"),
            MessageMarkdownInline.Link("docs", "https://example.com/b"),
            MessageMarkdownInline.Link("here", "https://example.com/c"),
        )

        assertEquals(listOf("here (1)", "docs", "here (2)"), disambiguateLinkLabels(links))
    }

    @Test
    fun `disambiguates identical links repeated in one message`() {
        val links = listOf(
            MessageMarkdownInline.Link("here", "https://example.com/a"),
            MessageMarkdownInline.Link("here", "https://example.com/a"),
        )

        assertEquals(listOf("here (1)", "here (2)"), disambiguateLinkLabels(links))
    }

    @Test
    fun `leaves an empty link list unchanged`() {
        assertEquals(emptyList<String>(), disambiguateLinkLabels(emptyList()))
    }

    @Test
    fun `a duplicate trimmed off by the cap leaves its survivor unsuffixed`() {
        // The MaxLinkAccessibilityActions'th link ("here") duplicates the very
        // next one, which the cap removes -- disambiguation must run on the
        // already-capped list, or the survivor would wrongly render "here (1)"
        // with no "(2)" anywhere in the message.
        val fillerBeforeCap = (0 until MaxLinkAccessibilityActions - 1).map {
            MessageMarkdownInline.Link("link $it", "https://example.com/$it")
        }
        val links = fillerBeforeCap +
            MessageMarkdownInline.Link("here", "https://example.com/survivor") +
            MessageMarkdownInline.Link("here", "https://example.com/trimmed") +
            MessageMarkdownInline.Link("link overflow", "https://example.com/overflow")

        val labels = disambiguateLinkLabels(capLinkAccessibilityActions(links))

        assertEquals(MaxLinkAccessibilityActions, labels.size)
        assertEquals("here", labels.last())
    }
}
