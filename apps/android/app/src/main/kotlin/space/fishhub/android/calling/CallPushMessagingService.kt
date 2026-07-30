package space.fishhub.android.calling

import android.annotation.SuppressLint
import space.fishhub.android.BuildConfig
import space.fishhub.android.FishApplication
import space.fishhub.android.feature.call.CallPushMessage
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import space.fishhub.android.messaging.ChatNotificationFactory
import space.fishhub.android.messaging.ChatPushContentResolver
import space.fishhub.android.messaging.ChatPushMessage

// Current FCM FID mode replaces the deprecated onNewToken callback with
// onRegistered/onUnregistered. Android lint still checks the legacy contract.
@SuppressLint("MissingFirebaseInstanceTokenRefresh")
class CallPushMessagingService : FirebaseMessagingService() {
    override fun onRegistered(installationId: String) {
        val app = application as FishApplication
        app.callScope.launch {
            app.callCoordinator.updatePushRegistration(installationId, BuildConfig.VERSION_NAME)
        }
    }

    override fun onUnregistered(installationId: String) {
        val app = application as FishApplication
        app.callScope.launch { app.callCoordinator.unregisterPushDevice() }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        ChatPushMessage.parse(message.data)?.let { push ->
            val app = application as FishApplication
            // onMessageReceived already runs on a background thread; FCM allows
            // brief work here. Bounded so a slow network can never stall the
            // notification past the delivery window.
            val content = runBlocking {
                withTimeoutOrNull(5_000) {
                    runCatching { ChatPushContentResolver.resolve(push, app.chatRepository) }
                        .getOrNull()
                }
            }
            ChatNotificationFactory.show(this, push, content)
            return
        }
        CallPushMessage.parse(message.data)?.let {
            (application as FishApplication).callCoordinator.receivePush(it)
        }
    }
}
