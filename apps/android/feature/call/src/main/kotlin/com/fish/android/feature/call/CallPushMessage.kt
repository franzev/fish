package com.fish.android.feature.call

import com.fish.android.data.call.CallKind
import java.time.Instant

data class CallPushMessage(
    val event: Event,
    val callId: String,
    val kind: CallKind,
    val counterpartId: String,
    val counterpartName: String,
    val expiresAt: String,
) {
    enum class Event { Ringing, Accepted, Rejected, Cancelled, Ended, Missed, Failed }

    val isTerminal: Boolean get() = event in setOf(
        Event.Rejected,
        Event.Cancelled,
        Event.Ended,
        Event.Missed,
        Event.Failed,
    )

    companion object {
        fun parse(data: Map<String, String>, now: Instant = Instant.now()): CallPushMessage? {
            if (data["version"] != "1") return null
            val event = when (data["event"]) {
                "ringing" -> Event.Ringing
                "accepted" -> Event.Accepted
                "rejected" -> Event.Rejected
                "cancelled" -> Event.Cancelled
                "ended" -> Event.Ended
                "missed" -> Event.Missed
                "failed" -> Event.Failed
                else -> return null
            }
            val callId = data["callId"]?.takeIf { it.isNotBlank() } ?: return null
            val counterpartId = data["counterpartId"]?.takeIf { it.isNotBlank() } ?: return null
            val counterpartName = data["counterpartName"]?.trim()?.takeIf { it.isNotBlank() }
                ?: "Your call partner"
            val expiresAt = data["expiresAt"] ?: return null
            val expiry = runCatching { Instant.parse(expiresAt) }.getOrNull() ?: return null
            if (event == Event.Ringing && !expiry.isAfter(now)) return null
            return CallPushMessage(
                event = event,
                callId = callId,
                kind = if (data["kind"] == "video") CallKind.Video else CallKind.Audio,
                counterpartId = counterpartId,
                counterpartName = counterpartName,
                expiresAt = expiresAt,
            )
        }
    }
}
