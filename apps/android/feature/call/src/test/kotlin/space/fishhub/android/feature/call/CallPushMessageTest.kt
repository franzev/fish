package space.fishhub.android.feature.call

import space.fishhub.android.data.call.CallKind
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CallPushMessageTest {
    private val now = Instant.parse("2026-07-17T10:00:00Z")

    @Test
    fun `accepts a current version ringing payload`() {
        val message = CallPushMessage.parse(
            payload(expiresAt = "2026-07-17T10:00:45Z"),
            now,
        )

        assertEquals(CallPushMessage.Event.Ringing, message?.event)
        assertEquals(CallKind.Video, message?.kind)
        assertEquals("Coach Mina", message?.counterpartName)
    }

    @Test
    fun `rejects expired ringing and malformed payloads`() {
        assertNull(CallPushMessage.parse(payload(expiresAt = now.toString()), now))
        assertNull(CallPushMessage.parse(payload().minus("callId"), now))
        assertNull(CallPushMessage.parse(payload() + ("version" to "2"), now))
    }

    @Test
    fun `allows a terminal payload after its ringing expiry`() {
        val message = CallPushMessage.parse(
            payload(expiresAt = "2026-07-17T09:59:00Z") + ("event" to "ended"),
            now,
        )

        assertEquals(CallPushMessage.Event.Ended, message?.event)
        assertEquals(true, message?.isTerminal)
    }

    private fun payload(expiresAt: String = "2026-07-17T10:00:45Z") = mapOf(
        "version" to "1",
        "event" to "ringing",
        "callId" to "call-1",
        "kind" to "video",
        "counterpartId" to "coach-1",
        "counterpartName" to "Coach Mina",
        "expiresAt" to expiresAt,
    )
}
