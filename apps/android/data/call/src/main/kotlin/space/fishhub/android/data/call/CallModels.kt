package space.fishhub.android.data.call

import android.content.Context
import android.view.View
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class CallKind {
    @SerialName("audio") Audio,
    @SerialName("video") Video,
}

enum class CallStatus {
    Ringing,
    Connecting,
    Active,
    Ended,
    Rejected,
    Cancelled,
    Missed,
    Failed,
}

@Serializable
enum class CallDirection {
    @SerialName("incoming") Incoming,
    @SerialName("outgoing") Outgoing,
}

data class Call(
    val id: String,
    val lessonSlotId: String?,
    val coachId: String,
    val clientId: String,
    val initiatedBy: String,
    val kind: CallKind,
    val status: CallStatus,
    val expiresAt: String,
    val acceptedAt: String?,
    val connectedAt: String?,
    val endedAt: String?,
    val endReason: String?,
    val createdAt: String,
    val updatedAt: String,
)

data class CallWithCounterpart(
    val call: Call,
    val counterpartName: String,
)

data class CallConnection(
    val serverUrl: String,
    val participantToken: String,
)

data class CallCommandSuccess(
    val call: Call,
    val connection: CallConnection? = null,
)

sealed interface CallResult<out T> {
    data class Success<T>(val value: T) : CallResult<T>
    data class Failure(
        val code: String,
        val notice: String,
        val recoverable: Boolean,
    ) : CallResult<Nothing>
}

sealed interface CallAuthState {
    data object Loading : CallAuthState
    data object SignedOut : CallAuthState
    data class SignedIn(val userId: String) : CallAuthState
}

data class CallRealtimeEvent(
    val callId: String,
    val status: CallStatus,
    val occurredAt: String,
)

interface CallRepository {
    val authState: StateFlow<CallAuthState>

    suspend fun initiate(
        recipientId: String,
        kind: CallKind,
        clientRequestId: String,
    ): CallResult<CallCommandSuccess>

    suspend fun accept(callId: String): CallResult<CallCommandSuccess>
    suspend fun reject(callId: String): CallResult<CallCommandSuccess>
    suspend fun cancel(callId: String): CallResult<CallCommandSuccess>
    suspend fun end(callId: String): CallResult<CallCommandSuccess>
    suspend fun join(callId: String): CallResult<CallCommandSuccess>
    suspend fun findCurrentCall(userId: String): CallResult<CallWithCounterpart?>
    suspend fun findCall(callId: String): CallResult<CallWithCounterpart?>
    fun observeRealtime(userId: String): Flow<CallRealtimeEvent>
    suspend fun registerPushDevice(
        installationId: String,
        providerInstallationId: String,
        appVersion: String,
    ): CallResult<Unit>
    suspend fun unregisterPushDevice(installationId: String): CallResult<Unit>
}

enum class CallMediaConnection { Idle, Connecting, Connected, Reconnecting, Disconnected }
enum class CallVideoSource { Local, Remote }
enum class CallVideoQualityTier { DataSaver, Low, Standard, High }

data class CallMediaState(
    val connection: CallMediaConnection = CallMediaConnection.Idle,
    val muted: Boolean = false,
    val cameraEnabled: Boolean = false,
    val remoteCameraEnabled: Boolean = false,
    val localSpeaking: Boolean = false,
    val remoteSpeaking: Boolean = false,
    val remoteMuted: Boolean = false,
    val connectionQuality: Int = 0,
    val videoQualityTier: CallVideoQualityTier = CallVideoQualityTier.Standard,
)

enum class VideoQualityPreference { Auto, DataSaver }

interface CallDevicePreferences {
    val videoQualityPreference: Flow<VideoQualityPreference>
    val pushRegistrationId: Flow<String?>
    suspend fun installationId(): String
    suspend fun setVideoQualityPreference(preference: VideoQualityPreference)
    suspend fun setPushRegistrationId(registrationId: String?)
}

interface CallMediaEngine {
    val state: StateFlow<CallMediaState>

    suspend fun connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone: Boolean,
        publishCamera: Boolean,
    )

    suspend fun setMuted(muted: Boolean)
    suspend fun setCameraEnabled(enabled: Boolean)
    suspend fun switchCamera()
    fun setVideoQualityPreference(preference: VideoQualityPreference)
    suspend fun disconnect()
    fun createVideoView(context: Context, source: CallVideoSource): View
    fun releaseVideoView(view: View)
}
