package space.fishhub.android.feature.presence

import android.content.Context
import android.text.format.DateFormat
import space.fishhub.android.data.presence.PresenceDisplayStatus
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.data.presence.PresenceSnapshot
import space.fishhub.android.data.presence.PresenceStatus
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.max

class PresenceFormatter(
    context: Context? = null,
    private val locale: () -> Locale = { Locale.getDefault() },
    private val zoneId: () -> ZoneId = { ZoneId.systemDefault() },
    private val is24Hour: () -> Boolean = {
        context?.let { DateFormat.is24HourFormat(it.applicationContext) } ?: false
    },
) {
    fun format(
        snapshot: PresenceSnapshot?,
        nowMs: Long,
        ownPreference: PresencePreference? = null,
        ownPreferenceExpired: Boolean = false,
    ): PresencePresentation {
        if (ownPreference != null && !ownPreferenceExpired) {
            when (ownPreference) {
                PresencePreference.Away -> return fixed(PresenceDisplayStatus.Away)
                PresencePreference.Busy -> return fixed(PresenceDisplayStatus.Busy)
                PresencePreference.Invisible -> return fixed(PresenceDisplayStatus.Invisible)
                PresencePreference.Automatic -> Unit
            }
        }
        val heartbeat = snapshot?.lastHeartbeatAt?.toInstantOrNull()?.toEpochMilli()
        val stale = snapshot?.status != null &&
            snapshot.status != PresenceStatus.Offline &&
            (heartbeat == null || heartbeat < nowMs - StaleAfterMs)
        val status = if (stale) PresenceStatus.Offline else snapshot?.status ?: PresenceStatus.Offline
        val display = when (status) {
            PresenceStatus.Online -> PresenceDisplayStatus.Online
            PresenceStatus.Idle -> PresenceDisplayStatus.Idle
            PresenceStatus.Away -> PresenceDisplayStatus.Away
            PresenceStatus.Busy -> PresenceDisplayStatus.Busy
            PresenceStatus.Offline -> PresenceDisplayStatus.Offline
        }
        val detail = if (display == PresenceDisplayStatus.Offline) {
            snapshot?.lastSeenAt?.let { formatLastSeen(it, nowMs) }
        } else {
            null
        }
        return PresencePresentation(display, label(display), detail)
    }

    fun label(status: PresenceDisplayStatus): String = when (status) {
        PresenceDisplayStatus.Online -> "Online"
        PresenceDisplayStatus.Idle -> "Idle"
        PresenceDisplayStatus.Away -> "Away"
        PresenceDisplayStatus.Busy -> "Do not disturb"
        PresenceDisplayStatus.Invisible -> "Invisible"
        PresenceDisplayStatus.Offline -> "Offline"
    }

    private fun fixed(status: PresenceDisplayStatus) =
        PresencePresentation(status = status, label = label(status))

    private fun formatLastSeen(value: String, nowMs: Long): String? {
        val instant = value.toInstantOrNull() ?: return null
        val seenMs = instant.toEpochMilli()
        val elapsed = max(0, nowMs - seenMs)
        if (elapsed < HourMs) {
            val minutes = max(1, elapsed / MinuteMs)
            return "Last seen $minutes ${if (minutes == 1L) "minute" else "minutes"} ago"
        }
        val zone = zoneId()
        val nowDate = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
        val seenDateTime = instant.atZone(zone)
        if (elapsed < DayMs && seenDateTime.toLocalDate() == nowDate) {
            val hours = max(1, elapsed / HourMs)
            return "Last seen $hours ${if (hours == 1L) "hour" else "hours"} ago"
        }
        if (seenDateTime.toLocalDate() == nowDate.minusDays(1)) {
            val pattern = if (is24Hour()) "HH:mm" else "h:mm a"
            val time = DateTimeFormatter.ofPattern(pattern, locale()).format(seenDateTime)
            return "Last seen yesterday at $time"
        }
        val date = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
            .withLocale(locale())
            .format(seenDateTime)
        return "Last seen on $date"
    }

    private fun String.toInstantOrNull(): Instant? = runCatching { Instant.parse(this) }.getOrNull()

    private companion object {
        const val MinuteMs = 60_000L
        const val HourMs = 60 * MinuteMs
        const val DayMs = 24 * HourMs
        const val StaleAfterMs = 90_000L
    }
}
