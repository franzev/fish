package space.fishhub.android.messaging

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import space.fishhub.android.MainActivity
import space.fishhub.android.R

/**
 * Resolved content for one pushed message. [sentAtMillis] is null when the
 * server timestamp was absent or unparseable; render falls back to now.
 */
internal data class ChatNotificationMessage(val text: String, val sentAtMillis: Long?)

internal object ChatNotificationFactory {
    const val ChannelId = "fish-messages-v1"

    fun show(context: Context, push: ChatPushMessage, message: ChatNotificationMessage?) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        ensureChannel(context, manager)
        manager.notify(notificationId(push.conversationId), build(context, push, message))
    }

    private fun build(
        context: Context,
        push: ChatPushMessage,
        message: ChatNotificationMessage?,
    ): Notification {
        val sender = Person.Builder().setName(push.senderName).setKey(push.senderId).build()
        val line = message?.text ?: context.getString(R.string.chat_notification_message)
        val timestamp = message?.sentAtMillis ?: System.currentTimeMillis()
        val style = activeMessagingStyle(context, push.conversationId)
            ?: NotificationCompat.MessagingStyle(selfPerson(context))
        style.addMessage(line, timestamp, sender)
        return NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(push.senderName)
            .setStyle(style)
            .setContentIntent(contentIntent(context, push))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setNumber(push.unreadCount)
            .setAutoCancel(true)
            .addAction(replyAction(context, push))
            .build()
    }

    /** Appends the user's own quick reply to the visible notification instead of dismissing it. */
    fun appendReply(context: Context, conversationId: String, body: String) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val id = notificationId(conversationId)
        val active = manager.activeNotifications.firstOrNull { it.id == id }?.notification ?: return
        val style = NotificationCompat.MessagingStyle
            .extractMessagingStyleFromNotification(active) ?: return
        style.addMessage(body, System.currentTimeMillis(), null as Person?)
        val rebuilt = NotificationCompat.Builder(context, active)
            .setStyle(style)
            .setOnlyAlertOnce(true)
            .build()
        manager.notify(id, rebuilt)
    }

    /** One calm notice when a queued reply ultimately cannot send. */
    fun showReplyFailure(context: Context, conversationId: String?, messageId: String?) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        ensureChannel(context, manager)
        val id = replyFailureNotificationId(conversationId.orEmpty())
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (conversationId != null && messageId != null) {
            intent.setAction(ChatIntents.ActionOpenMessage)
                .putExtra(ChatIntents.ExtraConversationId, conversationId)
                .putExtra(ChatIntents.ExtraMessageId, messageId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(context.getString(R.string.chat_notification_reply_failed_title))
            .setContentText(context.getString(R.string.chat_notification_reply_failed_body))
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .build()
        manager.notify(id, notification)
    }

    fun clear(context: Context, conversationId: String) {
        context.getSystemService(NotificationManager::class.java)
            .cancel(notificationId(conversationId))
    }

    fun notificationId(conversationId: String): Int =
        MessageIdRangeStart + (conversationId.hashCode() and Int.MAX_VALUE) % MessageIdRangeSize

    fun replyFailureNotificationId(conversationId: String): Int =
        FailureIdRangeStart + (conversationId.hashCode() and Int.MAX_VALUE) % MessageIdRangeSize

    private const val MessageIdRangeStart = 100_000
    private const val MessageIdRangeSize = 1_000_000
    private const val FailureIdRangeStart = 2_000_000

    internal fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun selfPerson(context: Context): Person =
        Person.Builder().setName(context.getString(R.string.chat_notification_you)).build()

    private fun activeMessagingStyle(
        context: Context,
        conversationId: String,
    ): NotificationCompat.MessagingStyle? {
        val manager = context.getSystemService(NotificationManager::class.java)
        val id = notificationId(conversationId)
        val active = manager.activeNotifications.firstOrNull { it.id == id }?.notification
            ?: return null
        return NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(active)
    }

    private fun ensureChannel(context: Context, manager: NotificationManager) {
        manager.createNotificationChannel(
            NotificationChannel(
                ChannelId,
                context.getString(R.string.chat_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.chat_channel_description)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
            },
        )
    }

    private fun contentIntent(context: Context, push: ChatPushMessage): PendingIntent =
        PendingIntent.getActivity(
            context,
            notificationId(push.conversationId),
            Intent(context, MainActivity::class.java)
                .setAction(ChatIntents.ActionOpenMessage)
                .putExtra(ChatIntents.ExtraConversationId, push.conversationId)
                .putExtra(ChatIntents.ExtraMessageId, push.messageId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun replyAction(context: Context, push: ChatPushMessage): NotificationCompat.Action {
        val intent = Intent(context, ChatReplyReceiver::class.java)
            .putExtra(ChatIntents.ExtraConversationId, push.conversationId)
            .putExtra(ChatIntents.ExtraMessageId, push.messageId)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            push.conversationId.hashCode() xor 0x52_45_50,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
        val input = RemoteInput.Builder(ChatReplyReceiver.RemoteInputKey)
            .setLabel(context.getString(R.string.chat_notification_reply_hint))
            .build()
        return NotificationCompat.Action.Builder(
            R.drawable.ic_call_notification,
            context.getString(R.string.chat_notification_reply),
            pendingIntent,
        ).addRemoteInput(input).build()
    }
}
