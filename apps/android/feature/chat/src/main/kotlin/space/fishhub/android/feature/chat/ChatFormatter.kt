package space.fishhub.android.feature.chat

import android.content.Context
import space.fishhub.android.data.chat.model.UserRole
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

interface ChatTextFormatter {
    val missingSignInCredentials: String
    val conversationUnavailable: String
    val attachmentsNotReady: String
    val attachmentUnavailable: String
    val messageUnavailable: String
    fun participantContext(role: UserRole): String
    fun timeLabel(timestamp: String): String
    fun dateLabel(timestamp: String): String
}

/** Formats user-facing chat copy without making the ViewModel retain an Activity. */
class AndroidChatFormatter(context: Context) : ChatTextFormatter {
    private val applicationContext = context.applicationContext

    override val missingSignInCredentials: String
        get() = applicationContext.getString(R.string.missing_sign_in_credentials)

    override val conversationUnavailable: String
        get() = applicationContext.getString(R.string.conversation_unavailable_notice)

    override val attachmentsNotReady: String
        get() = applicationContext.getString(R.string.attachments_not_ready_notice)

    override val attachmentUnavailable: String
        get() = applicationContext.getString(R.string.attachment_open_unavailable_notice)

    override val messageUnavailable: String
        get() = applicationContext.getString(R.string.reply_message_unavailable)

    override fun participantContext(role: UserRole): String = applicationContext.getString(
        when (role) {
            UserRole.Coach -> R.string.coach_context
            UserRole.Client -> R.string.client_context
        },
    )

    override fun timeLabel(timestamp: String): String = runCatching {
        DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)
            .withLocale(Locale.getDefault())
            .withZone(ZoneId.systemDefault())
            .format(Instant.parse(timestamp))
    }.getOrDefault("")

    override fun dateLabel(timestamp: String): String = runCatching {
        val date = Instant.parse(timestamp).atZone(ZoneId.systemDefault()).toLocalDate()
        when (date) {
            LocalDate.now() -> applicationContext.getString(R.string.today)
            LocalDate.now().minusDays(1) -> applicationContext.getString(R.string.yesterday)
            else -> DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
                .withLocale(Locale.getDefault())
                .format(date)
        }
    }.getOrDefault("")
}
