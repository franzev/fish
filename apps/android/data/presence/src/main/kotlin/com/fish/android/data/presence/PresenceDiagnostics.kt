package com.fish.android.data.presence

import android.util.Log

enum class PresenceOperation { Refresh, Heartbeat, EndSession, Realtime, SetPreference }
enum class PresenceFailureCategory { Authentication, Network, Remote, Malformed }

data class PresenceDiagnosticEvent(
    val operation: PresenceOperation,
    val succeeded: Boolean,
    val durationMs: Long,
    val failureCategory: PresenceFailureCategory? = null,
)

fun interface PresenceDiagnostics {
    fun record(event: PresenceDiagnosticEvent)
}

object NoOpPresenceDiagnostics : PresenceDiagnostics {
    override fun record(event: PresenceDiagnosticEvent) = Unit
}

internal object RedactedLogcatPresenceDiagnostics : PresenceDiagnostics {
    override fun record(event: PresenceDiagnosticEvent) {
        Log.d(
            "FishPresence",
            "operation=${event.operation} succeeded=${event.succeeded} " +
                "durationMs=${event.durationMs} failure=${event.failureCategory}",
        )
    }
}
