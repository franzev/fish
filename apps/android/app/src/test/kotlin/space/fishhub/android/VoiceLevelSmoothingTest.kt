package space.fishhub.android

import org.junit.Assert.assertEquals
import org.junit.Test

class VoiceLevelSmoothingTest {
    @Test
    fun weightsPreviousAt60PercentAndSampleAt40Percent() {
        assertEquals(0.4f, smoothLevel(previous = 0f, sample = 1f), 0.0001f)
        assertEquals(0.6f, smoothLevel(previous = 1f, sample = 0f), 0.0001f)
        assertEquals(0.5f, smoothLevel(previous = 0.5f, sample = 0.5f), 0.0001f)
    }

    @Test
    fun convergesTowardARepeatedSampleWithoutOvershooting() {
        var smoothed = 0f
        repeat(20) {
            smoothed = smoothLevel(previous = smoothed, sample = 1f)
        }
        assertEquals(1f, smoothed, 0.001f)
    }

    @Test
    fun staysFlatWhenSampleMatchesPrevious() {
        assertEquals(0.25f, smoothLevel(previous = 0.25f, sample = 0.25f), 0.0001f)
    }
}
