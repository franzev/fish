package space.fishhub.android.feature.chat.logic

import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.ConversationMute
import space.fishhub.android.data.chat.ConversationQuietPeriod

class ConversationQuietCopyTest {
    private val zone = ZoneId.of("UTC")
    private val locale = Locale.US
    private val now: Instant = Instant.parse("2026-07-25T10:00:00Z")

    private fun value(mute: ConversationMute) =
        ConversationQuietCopy.value(mute, now, zone, locale)

    @Test
    fun `reads as on when nothing is silenced`() {
        assertEquals(ConversationQuietValue.On, value(ConversationMute.On))
    }

    @Test
    fun `names the open ended case without a time`() {
        val mute = ConversationMute(isMuted = true, mutedUntil = null)
        assertEquals(ConversationQuietValue.UntilTurnedBackOn, value(mute))
    }

    @Test
    fun `shows only the time while the quiet period ends today`() {
        val mute = ConversationMute(isMuted = true, mutedUntil = now.plusSeconds(3_600))
        val moment = (value(mute) as ConversationQuietValue.Until).moment
        assertFalse(moment.contains("2026"))
        assertFalse(moment.contains("Jul"))
        assertTrue(moment.contains("11:00"))
    }

    // A bare clock time stops being clear once the quiet period runs past
    // midnight, which the 24-hour option always does.
    @Test
    fun `adds the day when the quiet period runs past today`() {
        val mute = ConversationMute(isMuted = true, mutedUntil = now.plusSeconds(86_400))
        val moment = (value(mute) as ConversationQuietValue.Until).moment
        assertTrue(moment, moment.contains("Jul 26"))
    }

    // The server stops suppressing pushes the moment the period lapses, so the
    // row must stop claiming to be quiet without waiting for a reload.
    @Test
    fun `stops reading as quiet once the period lapses`() {
        val lapsed = ConversationMute(isMuted = true, mutedUntil = now.minusSeconds(1))
        assertFalse(lapsed.isQuietAt(now))
        assertEquals(ConversationQuietValue.On, value(lapsed))
    }

    @Test
    fun `treats the exact expiry instant as lapsed`() {
        assertFalse(ConversationMute(isMuted = true, mutedUntil = now).isQuietAt(now))
    }

    @Test
    fun `the open ended quiet period never lapses`() {
        val openEnded = ConversationMute(isMuted = true, mutedUntil = null)
        assertTrue(openEnded.isQuietAt(now.plusSeconds(86_400L * 365)))
    }

    @Test
    fun `every quiet period carries the duration the server allows`() {
        assertEquals(3_600, ConversationQuietPeriod.OneHour.durationSeconds)
        assertEquals(28_800, ConversationQuietPeriod.EightHours.durationSeconds)
        assertEquals(86_400, ConversationQuietPeriod.OneDay.durationSeconds)
        assertEquals(null, ConversationQuietPeriod.UntilTurnedBackOn.durationSeconds)
    }
}
