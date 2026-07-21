package space.fishhub.android.messaging

import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChatShareIntentsTest {
    @Test
    fun parsesTextShare() {
        val result = ChatShareIntents.parse(
            action = Intent.ACTION_SEND,
            mimeType = "text/plain",
            text = "https://fishhub.space",
        )

        assertEquals("https://fishhub.space", result?.text)
        assertEquals("text/plain", result?.mimeType)
    }

    @Test
    fun rejectsUnrelatedIntent() {
        assertNull(ChatShareIntents.parse(Intent.ACTION_VIEW, "text/plain", "hello"))
        assertNull(ChatShareIntents.parse(Intent.ACTION_SEND, "text/plain", "   "))
    }
}
