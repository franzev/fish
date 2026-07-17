package space.fishhub.android.feature.call.state

import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind

fun reduceCallState(state: CallState, event: CallEvent): CallState {
    val current = state.current
    return when (event) {
        is CallEvent.PermissionRequested -> CallState(
            CallSessionState(
                counterpartId = event.counterpartId,
                counterpartName = event.counterpartName,
                kind = event.kind,
                direction = CallDirection.Outgoing,
                status = CallLifecycleStatus.RequestingPermission,
            ),
        )
        is CallEvent.PermissionDenied -> state.copy(
            current = current.copy(
                status = CallLifecycleStatus.Failed,
                failureReason = event.reason,
            ),
        )
        is CallEvent.OutgoingCallCreated -> CallState(
            CallSessionState(
                callId = event.callId,
                counterpartId = event.counterpartId,
                counterpartName = event.counterpartName,
                kind = event.kind,
                direction = CallDirection.Outgoing,
                status = CallLifecycleStatus.Ringing,
                expiresAt = event.expiresAt,
            ),
        )
        is CallEvent.IncomingCallReceived -> if (current.isLive && current.callId != event.callId) {
            state
        } else {
            CallState(
                CallSessionState(
                    callId = event.callId,
                    counterpartId = event.counterpartId,
                    counterpartName = event.counterpartName,
                    kind = event.kind,
                    direction = CallDirection.Incoming,
                    status = CallLifecycleStatus.Ringing,
                    expiresAt = event.expiresAt,
                ),
            )
        }
        is CallEvent.CallAccepted -> state.forCall(event.callId) {
            it.copy(status = CallLifecycleStatus.Connecting, failureReason = null)
        }
        is CallEvent.MediaConnected -> state.forCall(event.callId) {
            it.copy(
                status = CallLifecycleStatus.Active,
                connectedAt = it.connectedAt ?: event.connectedAt,
                failureReason = null,
            )
        }
        is CallEvent.MuteChanged -> if (current.isLive) {
            state.copy(current = current.copy(muted = event.muted))
        } else state
        is CallEvent.CameraChanged -> if (current.isLive && current.kind == CallKind.Video) {
            state.copy(current = current.copy(cameraEnabled = event.enabled))
        } else state
        is CallEvent.Reconnecting -> state.forCall(event.callId) {
            if (it.status == CallLifecycleStatus.Active) {
                it.copy(status = CallLifecycleStatus.Reconnecting)
            } else it
        }
        is CallEvent.Reconnected -> state.forCall(event.callId) {
            if (it.status == CallLifecycleStatus.Reconnecting) {
                it.copy(status = CallLifecycleStatus.Active)
            } else it
        }
        is CallEvent.CallRejected -> state.terminal(event.callId, CallLifecycleStatus.Rejected)
        is CallEvent.CallCancelled -> state.terminal(event.callId, CallLifecycleStatus.Cancelled)
        is CallEvent.CallMissed -> state.terminal(event.callId, CallLifecycleStatus.Missed)
        is CallEvent.CallEnded -> state.terminal(event.callId, CallLifecycleStatus.Ended)
        is CallEvent.CallFailed -> if (event.callId != null && event.callId != current.callId) {
            state
        } else {
            state.copy(
                current = current.copy(
                    status = CallLifecycleStatus.Failed,
                    failureReason = event.reason,
                ),
            )
        }
        CallEvent.ClearCall,
        CallEvent.IdentityChanged,
        -> CallState()
    }
}

val CallSessionState.isLive: Boolean
    get() = status in setOf(
        CallLifecycleStatus.RequestingPermission,
        CallLifecycleStatus.Ringing,
        CallLifecycleStatus.Connecting,
        CallLifecycleStatus.Active,
        CallLifecycleStatus.Reconnecting,
    )

private fun CallState.forCall(
    callId: String,
    update: (CallSessionState) -> CallSessionState,
): CallState = if (current.callId == callId) copy(current = update(current)) else this

private fun CallState.terminal(callId: String, status: CallLifecycleStatus): CallState =
    forCall(callId) { it.copy(status = status) }
