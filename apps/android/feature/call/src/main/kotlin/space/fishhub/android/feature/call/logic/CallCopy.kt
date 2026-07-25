package space.fishhub.android.feature.call.logic

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.feature.call.R
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun callCopy(call: CallSessionState): Pair<String, String> {
    val name = call.counterpartName ?: stringResource(R.string.call_partner_default)
    return when (call.status) {
        CallLifecycleStatus.RequestingPermission -> stringResource(R.string.call_preparing, name) to
            stringResource(R.string.call_preparing_status)
        CallLifecycleStatus.Ringing -> if (call.direction == CallDirection.Incoming) {
            stringResource(R.string.call_incoming, name) to stringResource(
                if (call.kind == CallKind.Video) R.string.call_incoming_video_status
                else R.string.call_incoming_audio_status,
            )
        } else {
            stringResource(R.string.call_outgoing, name) to stringResource(
                if (call.kind == CallKind.Video) R.string.call_outgoing_video_status
                else R.string.call_outgoing_audio_status,
            )
        }
        CallLifecycleStatus.Connecting -> stringResource(R.string.call_connecting, name) to
            stringResource(R.string.call_connecting_status)
        CallLifecycleStatus.Reconnecting -> stringResource(R.string.call_reconnecting, name) to
            stringResource(R.string.call_reconnecting_status)
        CallLifecycleStatus.Active -> stringResource(R.string.call_active, name) to stringResource(
            if (call.muted) R.string.call_microphone_muted else R.string.call_microphone_on,
        )
        CallLifecycleStatus.Missed -> if (call.direction == CallDirection.Outgoing) {
            stringResource(R.string.call_no_answer) to
                stringResource(R.string.call_no_answer_status, name)
        } else {
            stringResource(R.string.call_missed) to
                stringResource(R.string.call_missed_status, name)
        }
        CallLifecycleStatus.Rejected -> stringResource(R.string.call_declined) to
            stringResource(R.string.call_messages_available)
        CallLifecycleStatus.Cancelled -> stringResource(R.string.call_cancelled) to
            stringResource(R.string.call_messages_available)
        CallLifecycleStatus.Failed -> stringResource(R.string.call_failed) to
            stringResource(R.string.call_messages_available)
        else -> stringResource(R.string.call_ended) to
            stringResource(R.string.call_messages_available)
    }
}
