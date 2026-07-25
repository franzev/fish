package space.fishhub.android.feature.call

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaEngine
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
fun CallScreen(
    call: CallSessionState,
    mediaState: CallMediaState,
    notice: String?,
    busy: Boolean,
    qualityPreference: VideoQualityPreference,
    audioEndpoints: List<CallAudioEndpoint>,
    mediaEngine: CallMediaEngine?,
    onAnswer: () -> Unit,
    onDecline: () -> Unit,
    onCancel: () -> Unit,
    onEnd: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onSelectAudioEndpoint: (String) -> Unit,
    onQualityPreference: (VideoQualityPreference) -> Unit,
    onOpenMessages: () -> Unit,
    onClear: () -> Unit,
    onOpenAppSettings: () -> Unit,
    pictureInPicture: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val inProgress = call.status in setOf(
        CallLifecycleStatus.Connecting,
        CallLifecycleStatus.Active,
        CallLifecycleStatus.Reconnecting,
    )
    val videoStage = call.kind == CallKind.Video && inProgress
    if (pictureInPicture && videoStage) {
        VideoStage(
            call = call,
            mediaState = mediaState,
            mediaEngine = mediaEngine,
            modifier = modifier.fillMaxSize(),
        )
        return
    }
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
    ) {
        if (videoStage) {
            VideoStage(
                call = call,
                mediaState = mediaState,
                mediaEngine = mediaEngine,
                modifier = Modifier.weight(1f),
            )
        } else {
            Spacer(Modifier.weight(1f))
        }
        CallPanel(
            call = call,
            mediaState = mediaState,
            notice = notice,
            busy = busy,
            qualityPreference = qualityPreference,
            audioEndpoints = audioEndpoints,
            videoStage = videoStage,
            onAnswer = onAnswer,
            onDecline = onDecline,
            onCancel = onCancel,
            onEnd = onEnd,
            onToggleMute = onToggleMute,
            onToggleCamera = onToggleCamera,
            onSwitchCamera = onSwitchCamera,
            onSelectAudioEndpoint = onSelectAudioEndpoint,
            onQualityPreference = onQualityPreference,
            onOpenMessages = onOpenMessages,
            onClear = onClear,
            onOpenAppSettings = onOpenAppSettings,
        )
        if (!videoStage) Spacer(Modifier.weight(1f))
    }
}
