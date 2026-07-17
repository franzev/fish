package com.fish.android.data.presence.remote

import com.fish.android.data.presence.PresencePreference
import com.fish.android.data.presence.PresenceStatus
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class PresenceDtosTest {
    private val json = Json { explicitNulls = false }

    @Test
    fun `database rows decode snake case and commands encode camel case`() {
        val snapshot = json.decodeFromString<PresenceSnapshotDto>(
            """{"user_id":"user","status":"online","last_heartbeat_at":null,"last_seen_at":null,"revision":4,"updated_at":"2026-07-17T00:00:00Z"}""",
        ).toDomain()
        val command = json.encodeToString(
            PresenceCommandRequest(mode = "busy", durationSeconds = 3_600),
        )

        assertEquals(PresenceStatus.Online, snapshot.status)
        assertTrue(command.contains("\"durationSeconds\":3600"))
        assertTrue(command.contains("\"mode\":\"busy\""))
    }

    @Test
    fun `unknown wire enums are rejected`() {
        expectIllegalArgument { "sleeping".toPresenceStatus() }
        expectIllegalArgument { "sometimes".toPresencePreference() }
        assertEquals("invisible", PresencePreference.Invisible.toWire())
    }

    private fun expectIllegalArgument(block: () -> Unit) {
        try {
            block()
            fail("Expected IllegalArgumentException")
        } catch (_: IllegalArgumentException) {
            Unit
        }
    }
}
