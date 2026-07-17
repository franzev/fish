package com.fish.android.feature.call.state

import com.fish.android.data.call.CallDirection
import com.fish.android.data.call.CallKind
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class CallLifecycleStatus {
    @SerialName("idle") Idle,
    @SerialName("requestingPermission") RequestingPermission,
    @SerialName("ringing") Ringing,
    @SerialName("connecting") Connecting,
    @SerialName("active") Active,
    @SerialName("reconnecting") Reconnecting,
    @SerialName("ended") Ended,
    @SerialName("rejected") Rejected,
    @SerialName("cancelled") Cancelled,
    @SerialName("missed") Missed,
    @SerialName("failed") Failed,
}

@Serializable
enum class CallFailureReason {
    @SerialName("permissionDenied") PermissionDenied,
    @SerialName("deviceUnavailable") DeviceUnavailable,
    @SerialName("connectFailed") ConnectFailed,
    @SerialName("networkLost") NetworkLost,
    @SerialName("providerUnavailable") ProviderUnavailable,
    @SerialName("notAllowed") NotAllowed,
}

@Serializable
data class CallSessionState(
    val callId: String? = null,
    val counterpartId: String? = null,
    val counterpartName: String? = null,
    val kind: CallKind = CallKind.Audio,
    val status: CallLifecycleStatus = CallLifecycleStatus.Idle,
    val direction: CallDirection? = null,
    val muted: Boolean = false,
    val cameraEnabled: Boolean = false,
    val expiresAt: String? = null,
    val connectedAt: String? = null,
    val failureReason: CallFailureReason? = null,
)

@Serializable
data class CallState(val current: CallSessionState = CallSessionState())

@Serializable
sealed interface CallEvent {
    @Serializable
    @SerialName("permissionRequested")
    data class PermissionRequested(
        val counterpartId: String,
        val counterpartName: String,
        val kind: CallKind,
    ) : CallEvent
    @Serializable
    @SerialName("permissionDenied")
    data class PermissionDenied(val reason: CallFailureReason) : CallEvent
    @Serializable
    @SerialName("outgoingCallCreated")
    data class OutgoingCallCreated(
        val callId: String,
        val counterpartId: String,
        val counterpartName: String,
        val kind: CallKind,
        val expiresAt: String,
    ) : CallEvent
    @Serializable
    @SerialName("incomingCallReceived")
    data class IncomingCallReceived(
        val callId: String,
        val counterpartId: String,
        val counterpartName: String,
        val kind: CallKind,
        val expiresAt: String,
    ) : CallEvent
    @Serializable
    @SerialName("callAccepted")
    data class CallAccepted(val callId: String) : CallEvent
    @Serializable
    @SerialName("mediaConnected")
    data class MediaConnected(val callId: String, val connectedAt: String) : CallEvent
    @Serializable
    @SerialName("muteChanged")
    data class MuteChanged(val muted: Boolean) : CallEvent
    @Serializable
    @SerialName("cameraChanged")
    data class CameraChanged(val enabled: Boolean) : CallEvent
    @Serializable
    @SerialName("reconnecting")
    data class Reconnecting(val callId: String) : CallEvent
    @Serializable
    @SerialName("reconnected")
    data class Reconnected(val callId: String) : CallEvent
    @Serializable
    @SerialName("callRejected")
    data class CallRejected(val callId: String) : CallEvent
    @Serializable
    @SerialName("callCancelled")
    data class CallCancelled(val callId: String) : CallEvent
    @Serializable
    @SerialName("callMissed")
    data class CallMissed(val callId: String) : CallEvent
    @Serializable
    @SerialName("callEnded")
    data class CallEnded(val callId: String) : CallEvent
    @Serializable
    @SerialName("callFailed")
    data class CallFailed(val callId: String? = null, val reason: CallFailureReason) : CallEvent
    @Serializable
    @SerialName("clearCall")
    data object ClearCall : CallEvent
    @Serializable
    @SerialName("identityChanged")
    data object IdentityChanged : CallEvent
}
