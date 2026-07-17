package space.fishhub.android.feature.call

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.CallSessionState

@PreviewTest
@Preview(name = "incoming audio light", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun IncomingAudioCallScreenshot() {
    ScreenshotCall(
        sampleCall(CallLifecycleStatus.Ringing, CallDirection.Incoming),
        darkTheme = false,
    )
}

@PreviewTest
@Preview(
    name = "active audio dark",
    widthDp = 412,
    heightDp = 915,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun ActiveAudioCallScreenshot() {
    ScreenshotCall(
        sampleCall(CallLifecycleStatus.Active, CallDirection.Outgoing),
        darkTheme = true,
        media = CallMediaState(localSpeaking = true, remoteSpeaking = true),
    )
}

@PreviewTest
@Preview(name = "active video", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun ActiveVideoCallScreenshot() {
    ScreenshotCall(
        sampleCall(
            CallLifecycleStatus.Active,
            CallDirection.Incoming,
            CallKind.Video,
            cameraEnabled = true,
        ),
        darkTheme = false,
        media = CallMediaState(remoteMuted = true),
    )
}

@PreviewTest
@Preview(
    name = "reconnecting large font",
    widthDp = 412,
    heightDp = 915,
    fontScale = 2f,
    showBackground = true,
)
@Composable
fun ReconnectingLargeFontCallScreenshot() {
    ScreenshotCall(
        sampleCall(CallLifecycleStatus.Reconnecting, CallDirection.Incoming),
        darkTheme = false,
    )
}

@Composable
private fun ScreenshotCall(
    call: CallSessionState,
    darkTheme: Boolean,
    media: CallMediaState = CallMediaState(),
) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        CallScreen(
            call = call,
            mediaState = media,
            notice = null,
            busy = false,
            qualityPreference = VideoQualityPreference.Auto,
            audioEndpoints = emptyList(),
            mediaEngine = null,
            onAnswer = {},
            onDecline = {},
            onCancel = {},
            onEnd = {},
            onToggleMute = {},
            onToggleCamera = {},
            onSwitchCamera = {},
            onSelectAudioEndpoint = {},
            onQualityPreference = {},
            onOpenMessages = {},
            onClear = {},
            onOpenAppSettings = {},
        )
    }
}

private fun sampleCall(
    status: CallLifecycleStatus,
    direction: CallDirection,
    kind: CallKind = CallKind.Audio,
    cameraEnabled: Boolean = false,
) = CallSessionState(
    callId = "call-1",
    counterpartId = "coach-1",
    counterpartName = "Coach Mina",
    kind = kind,
    direction = direction,
    status = status,
    cameraEnabled = cameraEnabled,
    expiresAt = "2026-07-17T10:00:45Z",
    connectedAt = if (status in setOf(
            CallLifecycleStatus.Active,
            CallLifecycleStatus.Reconnecting,
        )
    ) "2026-07-17T10:00:04Z" else null,
)
