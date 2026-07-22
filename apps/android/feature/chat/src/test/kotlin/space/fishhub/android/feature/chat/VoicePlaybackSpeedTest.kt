package space.fishhub.android.feature.chat

import org.junit.Assert.assertEquals
import org.junit.Test

class VoicePlaybackSpeedTest {
    @Test
    fun `speed choices stay bounded and ordered`() {
        assertEquals(listOf(0.75f, 1.0f, 1.5f, 2.0f), VoicePlaybackSpeed.entries.map { it.multiplier })
        assertEquals("Normal speed", VoicePlaybackSpeed.Normal.accessibilityLabel)
    }
}
