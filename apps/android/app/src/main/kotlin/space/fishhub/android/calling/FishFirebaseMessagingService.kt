package space.fishhub.android.calling

import android.annotation.SuppressLint
import space.fishhub.android.BuildConfig
import space.fishhub.android.FishApplication
import space.fishhub.android.feature.call.CallPushMessage
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.launch

// Current FCM FID mode replaces the deprecated onNewToken callback with
// onRegistered/onUnregistered. Android lint still checks the legacy contract.
@SuppressLint("MissingFirebaseInstanceTokenRefresh")
class FishFirebaseMessagingService : FirebaseMessagingService() {
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
        CallPushMessage.parse(message.data)?.let {
            (application as FishApplication).callCoordinator.receivePush(it)
        }
    }
}
