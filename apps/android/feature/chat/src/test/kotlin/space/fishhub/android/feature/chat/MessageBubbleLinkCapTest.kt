package space.fishhub.android.feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.feature.chat.logic.MessageMarkdownInline
import space.fishhub.android.feature.chat.views.MaxLinkAccessibilityActions
import space.fishhub.android.feature.chat.views.capLinkAccessibilityActions

/**
 * Regression coverage for the crash Compose's accessibility delegate throws once
 * a node's customActions list reaches 32 entries
 * (AndroidComposeViewAccessibilityDelegateCompat#populateAccessibilityNodeInfoProperties).
 * A message body can hold far more than 32 minimal markdown links within the
 * composer's 4,000-character limit, so [capLinkAccessibilityActions] must bound
 * the list MessageBubble turns into custom accessibility actions.
 */
class MessageBubbleLinkCapTest {

    @Test
    fun `caps a link heavy message well under Compose's 32-action ceiling`() {
        val links = (1..40).map { link(it) }

        val capped = capLinkAccessibilityActions(links)

        assertEquals(MaxLinkAccessibilityActions, capped.size)
        assertTrue(capped.size < 32)
    }

    @Test
    fun `keeps the first links in document order when capping`() {
        val links = (1..40).map { link(it) }

        val capped = capLinkAccessibilityActions(links)

        assertEquals(links.take(MaxLinkAccessibilityActions), capped)
    }

    @Test
    fun `leaves a message under the cap unchanged`() {
        val links = (1..3).map { link(it) }

        assertEquals(links, capLinkAccessibilityActions(links))
    }

    @Test
    fun `leaves an empty link list unchanged`() {
        assertTrue(capLinkAccessibilityActions(emptyList()).isEmpty())
    }

    private fun link(index: Int) = MessageMarkdownInline.Link("link $index", "https://example.com/$index")
}
