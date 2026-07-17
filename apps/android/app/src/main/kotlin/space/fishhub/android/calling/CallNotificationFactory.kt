package space.fishhub.android.calling

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.media.AudioAttributes
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import space.fishhub.android.MainActivity
import space.fishhub.android.R
import space.fishhub.android.data.call.CallKind
import kotlin.math.absoluteValue

internal object CallNotificationFactory {
    const val ChannelId = "fish-calls"

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                ChannelId,
                context.getString(R.string.call_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.call_channel_description)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(
                    android.provider.Settings.System.DEFAULT_RINGTONE_URI,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build(),
                )
                enableVibration(true)
            },
        )
    }

    fun build(
        context: Context,
        callId: String,
        counterpartName: String,
        kind: CallKind,
        incoming: Boolean,
        active: Boolean,
    ): Notification {
        ensureChannel(context)
        val person = Person.Builder()
            .setName(counterpartName)
            .setImportant(true)
            .build()
        val answerIntent = actionIntent(context, CallIntents.ActionAnswer, callId, kind)
        val rejectIntent = actionIntent(context, CallIntents.ActionReject, callId, kind)
        val endIntent = actionIntent(context, CallIntents.ActionEnd, callId, kind)
        val openIntent = activityIntent(context, CallIntents.ActionOpen, callId, kind)
        val style = if (incoming && !active) {
            NotificationCompat.CallStyle.forIncomingCall(person, rejectIntent, answerIntent)
        } else {
            NotificationCompat.CallStyle.forOngoingCall(person, endIntent)
        }
        val state = when {
            active -> if (kind == CallKind.Video) "Video call" else "Audio call"
            incoming -> if (kind == CallKind.Video) "Incoming video call" else "Incoming audio call"
            else -> "Calling"
        }
        return NotificationCompat.Builder(context, ChannelId)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(counterpartName)
            .setContentText(state)
            .setContentIntent(openIntent)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setSilent(!incoming || active)
            .setOnlyAlertOnce(active)
            .setFullScreenIntent(openIntent, incoming && !active && canUseFullScreenIntent(context))
            .build()
            .also { notification ->
                if (incoming && !active) notification.flags =
                    notification.flags or Notification.FLAG_INSISTENT
            }
    }

    fun notificationId(callId: String): Int = 6_100 + callId.hashCode().absoluteValue % 800

    private fun actionIntent(
        context: Context,
        action: String,
        callId: String,
        kind: CallKind,
    ): PendingIntent = PendingIntent.getBroadcast(
        context,
        action.hashCode() xor callId.hashCode(),
        Intent(context, CallActionReceiver::class.java)
            .setAction(action)
            .putExtra(CallIntents.ExtraCallId, callId)
            .putExtra(CallIntents.ExtraCallKind, kind.name),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun activityIntent(
        context: Context,
        action: String,
        callId: String,
        kind: CallKind,
    ): PendingIntent = PendingIntent.getActivity(
        context,
        callId.hashCode(),
        Intent(context, MainActivity::class.java)
            .setAction(action)
            .putExtra(CallIntents.ExtraCallId, callId)
            .putExtra(CallIntents.ExtraCallKind, kind.name)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun canUseFullScreenIntent(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
        } else {
            true
        }
}
