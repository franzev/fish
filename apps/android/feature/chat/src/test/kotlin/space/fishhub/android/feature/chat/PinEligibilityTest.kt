package space.fishhub.android.feature.chat

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.feature.chat.model.MessageDeliveryUiState
import space.fishhub.android.feature.chat.model.MessageUiModel
import space.fishhub.android.feature.chat.views.canPin

/**
 * The pin/unpin row in [space.fishhub.android.feature.chat.views.ChatMessageActionsSheet]
 * mirrors the Copy row's eligibility exactly: not deleted, not still sending
 * or failed, and a non-empty body. This mirrors `set_pinned_message`'s own
 * server-side check.
 */
class PinEligibilityTest {
    @Test
    fun `a sent text message is pin eligible`() {
        assertTrue(message().canPin())
    }

    @Test
    fun `a deleted message is not pin eligible`() {
        assertFalse(message(deleted = true).canPin())
    }

    @Test
    fun `a blank body is not pin eligible`() {
        assertFalse(message(body = "").canPin())
    }

    @Test
    fun `a still-sending message is not pin eligible`() {
        assertFalse(message(delivery = MessageDeliveryUiState.Sending).canPin())
    }

    @Test
    fun `a failed message is not pin eligible`() {
        assertFalse(message(delivery = MessageDeliveryUiState.Failed).canPin())
    }

    @Test
    fun `a delivered or read message stays pin eligible`() {
        assertTrue(message(delivery = MessageDeliveryUiState.Delivered).canPin())
        assertTrue(message(delivery = MessageDeliveryUiState.Read).canPin())
    }

    private fun message(
        body: String = "Keep this handy.",
        deleted: Boolean = false,
        delivery: MessageDeliveryUiState? = null,
    ) = MessageUiModel(
        id = "message-1",
        senderName = "Coach Jordan",
        body = body,
        timeLabel = "10:36",
        isOutgoing = false,
        deleted = deleted,
        delivery = delivery,
    )
}
