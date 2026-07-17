package space.fishhub.android.feature.call

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.isLive

@Composable
fun CallRoute(
    coordinator: CallCoordinator,
    minimized: Boolean,
    onMinimizedChange: (Boolean) -> Unit,
    onAnswer: (String) -> Unit,
    onOpenAppSettings: () -> Unit,
    pictureInPicture: Boolean = false,
) {
    val state by coordinator.state.collectAsStateWithLifecycle()
    val mediaState by coordinator.mediaState.collectAsStateWithLifecycle()
    val notice by coordinator.notice.collectAsStateWithLifecycle()
    val busy by coordinator.busy.collectAsStateWithLifecycle()
    val qualityPreference by coordinator.qualityPreference.collectAsStateWithLifecycle()
    val audioEndpoints by coordinator.audioEndpoints.collectAsStateWithLifecycle()
    val call = state.current

    LaunchedEffect(call.callId, call.status) {
        if (
            call.status in setOf(
                CallLifecycleStatus.RequestingPermission,
                CallLifecycleStatus.Ringing,
                CallLifecycleStatus.Ended,
                CallLifecycleStatus.Rejected,
                CallLifecycleStatus.Cancelled,
                CallLifecycleStatus.Missed,
                CallLifecycleStatus.Failed,
            )
        ) {
            onMinimizedChange(false)
        }
    }

    when {
        call.status == CallLifecycleStatus.Idle -> Unit
        minimized && call.isLive -> CompactCallBar(
            call = call,
            busy = busy,
            onReturn = { onMinimizedChange(false) },
            onEnd = { call.callId?.let(coordinator::end) },
        )
        else -> CallScreen(
            call = call,
            mediaState = mediaState,
            notice = notice,
            busy = busy,
            qualityPreference = qualityPreference,
            audioEndpoints = audioEndpoints,
            mediaEngine = coordinator.mediaEngine,
            onAnswer = { call.callId?.let(onAnswer) },
            onDecline = { call.callId?.let(coordinator::reject) },
            onCancel = { call.callId?.let(coordinator::cancel) },
            onEnd = { call.callId?.let(coordinator::end) },
            onToggleMute = { coordinator.setMuted(!call.muted) },
            onToggleCamera = { coordinator.setCameraEnabled(!call.cameraEnabled) },
            onSwitchCamera = coordinator::switchCamera,
            onSelectAudioEndpoint = coordinator::selectAudioEndpoint,
            onQualityPreference = coordinator::setQualityPreference,
            onOpenMessages = { onMinimizedChange(true) },
            onClear = coordinator::clear,
            onOpenAppSettings = onOpenAppSettings,
            pictureInPicture = pictureInPicture,
        )
    }
}
