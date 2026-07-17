package space.fishhub.android.feature.presence

import space.fishhub.android.data.presence.PresenceDisplayStatus
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.data.presence.PresenceSnapshot
import space.fishhub.android.data.presence.PresenceStatus
import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PresenceFormatterTest {
    private val formatter = PresenceFormatter(
        locale = { Locale.US },
        zoneId = { ZoneId.of("UTC") },
        is24Hour = { false },
    )
    private val now = Instant.parse("2026-07-17T12:00:00Z").toEpochMilli()

    @Test
    fun `fresh statuses and own invisible have distinct presentations`() {
        assertEquals(
            PresenceDisplayStatus.Online,
            formatter.format(snapshot(PresenceStatus.Online, "2026-07-17T11:59:30Z"), now).status,
        )
        assertEquals(
            PresenceDisplayStatus.Idle,
            formatter.format(snapshot(PresenceStatus.Idle, "2026-07-17T11:59:30Z"), now).status,
        )
        assertEquals(
            PresenceDisplayStatus.Invisible,
            formatter.format(
                snapshot(PresenceStatus.Offline, null),
                now,
                ownPreference = PresencePreference.Invisible,
            ).status,
        )
    }

    @Test
    fun `missing malformed and stale heartbeat resolve offline while future skew stays fresh`() {
        assertEquals(PresenceDisplayStatus.Offline, formatter.format(snapshot(PresenceStatus.Online, null), now).status)
        assertEquals(PresenceDisplayStatus.Offline, formatter.format(snapshot(PresenceStatus.Online, "bad"), now).status)
        assertEquals(
            PresenceDisplayStatus.Offline,
            formatter.format(snapshot(PresenceStatus.Online, "2026-07-17T11:58:29Z"), now).status,
        )
        assertEquals(
            PresenceDisplayStatus.Online,
            formatter.format(snapshot(PresenceStatus.Online, "2026-07-17T12:05:00Z"), now).status,
        )
    }

    @Test
    fun `last seen copy covers relative yesterday and calendar date`() {
        assertEquals(
            "Last seen 1 minute ago",
            formatter.format(offline("2026-07-17T11:59:20Z"), now).detail,
        )
        assertEquals(
            "Last seen 2 hours ago",
            formatter.format(offline("2026-07-17T09:30:00Z"), now).detail,
        )
        assertEquals(
            "Last seen yesterday at 9:30 AM",
            formatter.format(offline("2026-07-16T09:30:00Z"), now).detail,
        )
        assertEquals(
            "Last seen on Jul 10, 2026",
            formatter.format(offline("2026-07-10T09:30:00Z"), now).detail,
        )
        assertNull(formatter.format(offline("not-a-time"), now).detail)
    }

    private fun snapshot(status: PresenceStatus, heartbeat: String?) = PresenceSnapshot(
        userId = "user",
        status = status,
        lastHeartbeatAt = heartbeat,
        lastSeenAt = null,
        revision = 1,
        updatedAt = "2026-07-17T12:00:00Z",
    )

    private fun offline(lastSeen: String) = snapshot(PresenceStatus.Offline, null).copy(
        lastSeenAt = lastSeen,
    )
}
