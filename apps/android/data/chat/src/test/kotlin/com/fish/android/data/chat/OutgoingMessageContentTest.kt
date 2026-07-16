package com.fish.android.data.chat

import com.fish.android.data.chat.model.ChatGif
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class OutgoingMessageContentTest {
    @Test
    fun `allows media-only content and normalizes text`() {
        val content = OutgoingMessageContent(body = "  ", stickerId = "aquatic-hello-otter")

        assertEquals("", content.normalizedBody)
        assertEquals("aquatic-hello-otter", content.stickerId)
    }

    @Test
    fun `rejects empty content`() {
        assertThrows(IllegalArgumentException::class.java) {
            OutgoingMessageContent(body = "  ")
        }
    }

    @Test
    fun `rejects combined gif and sticker`() {
        assertThrows(IllegalArgumentException::class.java) {
            OutgoingMessageContent(body = "Together", gif = gif(), stickerId = "sticker")
        }
    }

    private fun gif() = ChatGif(
        provider = "klipy",
        providerId = "gif-1",
        title = "Fish",
        description = "A fish nodding",
        sourceUrl = "https://klipy.com/gifs/gif-1",
        posterUrl = "https://static.klipy.com/poster.gif",
        previewUrl = "https://static.klipy.com/preview.mp4",
        mediaUrl = "https://static.klipy.com/media.mp4",
        width = 480,
        height = 360,
    )
}
