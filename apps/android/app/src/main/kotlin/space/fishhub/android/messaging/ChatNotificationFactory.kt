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
import androidx.core.content.ContextCompat
import space.fishhub.android.MainActivity
import space.fishhub.android.R

internal object ChatNotificationFactory {
    const val ChannelId = "fish-messages-v1"

    fun show(context: Context, push: ChatPushMessage) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) return
        val manager = context.getSystemService(NotificationManager::class.java)
        ensureChannel(context, manager)
        manager.notify(notificationId(push.conversationId), build(context, push))
    }

    fun build(context: Context, push: ChatPushMessage): Notification =
        NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(push.senderName)
            .setContentText(context.getString(R.string.chat_notification_message))
            .setContentIntent(contentIntent(context, push))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .build()

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
            push.conversationId.hashCode(),
            Intent(context, MainActivity::class.java)
                .setAction(ChatIntents.ActionOpenMessage)
                .putExtra(ChatIntents.ExtraConversationId, push.conversationId)
                .putExtra(ChatIntents.ExtraMessageId, push.messageId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun clear(context: Context, conversationId: String) {
        context.getSystemService(NotificationManager::class.java).cancel(notificationId(conversationId))
    }

    fun notificationId(conversationId: String): Int =
        7_100 + (conversationId.hashCode() and Int.MAX_VALUE) % 800
}
