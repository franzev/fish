package space.fishhub.android.calling

import android.Manifest
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import space.fishhub.android.data.call.CallKind

class CallForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val callId = intent?.getStringExtra(CallIntents.ExtraCallId)
        if (intent?.action == Stop || callId == null) {
            if (callId != null) {
                NotificationManagerCompat.from(this).cancel(
                    CallNotificationFactory.notificationId(callId),
                )
            }
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        val kind = intent.enumExtra(CallIntents.ExtraCallKind, CallKind.Audio)
        val active = intent.getBooleanExtra(CallIntents.ExtraActive, false)
        val notification = CallNotificationFactory.build(
            context = this,
            callId = callId,
            counterpartName = intent.getStringExtra(CallIntents.ExtraCounterpartName)
                ?: "Your call partner",
            kind = kind,
            incoming = intent.getBooleanExtra(CallIntents.ExtraIncoming, false),
            active = active,
        )
        val baseType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
        } else {
            0
        }
        val mediaTypes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && active) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                if (kind == CallKind.Video) ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA else 0
        } else {
            0
        }
        runCatching {
            ServiceCompat.startForeground(
                this,
                CallNotificationFactory.notificationId(callId),
                notification,
                baseType or mediaTypes,
            )
        }.recoverCatching {
            ServiceCompat.startForeground(
                this,
                CallNotificationFactory.notificationId(callId),
                notification,
                baseType,
            )
        }.onFailure {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS,
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                runCatching {
                    NotificationManagerCompat.from(this).notify(
                        CallNotificationFactory.notificationId(callId),
                        notification,
                    )
                }
            }
        }
        return START_NOT_STICKY
    }

    companion object {
        const val Start = "space.fishhub.android.call.service.START"
        const val Stop = "space.fishhub.android.call.service.STOP"
    }
}

private inline fun <reified T : Enum<T>> Intent.enumExtra(name: String, fallback: T): T =
    getStringExtra(name)?.let { value -> enumValues<T>().firstOrNull { it.name == value } } ?: fallback
