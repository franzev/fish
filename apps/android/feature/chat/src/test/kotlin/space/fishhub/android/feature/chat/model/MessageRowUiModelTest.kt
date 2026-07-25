package space.fishhub.android.feature.chat.model

import org.junit.Assert.assertEquals
import org.junit.Test

class MessageRowUiModelTest {
    private fun message(
        groupedWithPrevious: Boolean = false,
        groupedWithNext: Boolean = false,
        delivery: MessageDeliveryUiState? = null,
    ) = MessageUiModel(
        id = "m1",
        senderName = "Coach Jordan",
        body = "Good morning.",
        timeLabel = "10:36",
        isOutgoing = false,
        delivery = delivery,
        groupedWithPrevious = groupedWithPrevious,
        groupedWithNext = groupedWithNext,
    )

    @Test
    fun `standalone message is solo`() {
        assertEquals(MessageGroupPosition.Solo, message().toRow().groupPosition)
    }

    @Test
    fun `run opener is first`() {
        assertEquals(
            MessageGroupPosition.First,
            message(groupedWithNext = true).toRow().groupPosition,
        )
    }

    @Test
    fun `run interior is middle`() {
        assertEquals(
            MessageGroupPosition.Middle,
            message(groupedWithPrevious = true, groupedWithNext = true).toRow().groupPosition,
        )
    }

    @Test
    fun `run closer is last`() {
        assertEquals(
            MessageGroupPosition.Last,
            message(groupedWithPrevious = true).toRow().groupPosition,
        )
    }

    @Test
    fun `delivery status shows only when the message carries one`() {
        assertEquals(false, message().toRow().showsDeliveryStatus)
        assertEquals(
            true,
            message(delivery = MessageDeliveryUiState.Sending).toRow().showsDeliveryStatus,
        )
    }

    @Test
    fun `row identity follows the message`() {
        assertEquals("m1", message().toRow().id)
    }
}
