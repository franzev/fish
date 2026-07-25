package space.fishhub.android.feature.chat.logic

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import space.fishhub.android.data.chat.ConversationMute

/**
 * What the quiet row should say, without deciding the words. The composable
 * resolves each case to a string resource so the wording stays localisable
 * while the decision itself stays testable.
 */
sealed interface ConversationQuietValue {
    data object On : ConversationQuietValue
    data object UntilTurnedBackOn : ConversationQuietValue

    /** [moment] is already formatted for the reader's locale and zone. */
    data class Until(val moment: String) : ConversationQuietValue
}

object ConversationQuietCopy {
    fun value(
        mute: ConversationMute,
        now: Instant,
        zone: ZoneId = ZoneId.systemDefault(),
        locale: Locale = Locale.getDefault(),
    ): ConversationQuietValue {
        if (!mute.isQuietAt(now)) return ConversationQuietValue.On
        val until = mute.mutedUntil ?: return ConversationQuietValue.UntilTurnedBackOn

        // A bare clock time stops being clear once the quiet period runs past
        // midnight, which the 24-hour option always does.
        val sameDay = until.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate()
        val style = if (sameDay) {
            DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)
        } else {
            DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
        }
        return ConversationQuietValue.Until(
            style.withLocale(locale).withZone(zone).format(until),
        )
    }
}
