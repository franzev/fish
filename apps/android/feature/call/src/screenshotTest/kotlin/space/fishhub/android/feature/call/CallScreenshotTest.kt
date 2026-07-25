package space.fishhub.android.feature.call

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.call.views.CallControls
import space.fishhub.android.feature.call.views.CallActivityPanel
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.screens.CallOverlay
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
        CallOverlay(
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

// Component-level cases. Each `name` matches the `named:` string FishKit passes
// to assertThemedSnapshots so the pair can be compared side by side.

@Composable
private fun CallComponentStrip(darkTheme: Boolean, content: @Composable () -> Unit) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            content()
        }
    }
}

@Composable
private fun CallControlStates() {
    CallControls(
        call = sampleCall(CallLifecycleStatus.Active, CallDirection.Outgoing),
        busy = false,
        settingsOpen = false,
        onToggleMute = {},
        onToggleCamera = {},
        onSwitchCamera = {},
        onOpenMessages = {},
        onToggleSettings = {},
        onEnd = {},
    )
    CallControls(
        call = sampleCall(CallLifecycleStatus.Active, CallDirection.Outgoing, CallKind.Video, true),
        busy = true,
        settingsOpen = false,
        onToggleMute = {},
        onToggleCamera = {},
        onSwitchCamera = {},
        onOpenMessages = {},
        onToggleSettings = {},
        onEnd = {},
    )
}

@Composable
private fun CallActivityStates() {
    CallActivityPanel(
        call = sampleCall(CallLifecycleStatus.Active, CallDirection.Incoming),
        media = CallMediaState(),
    )
    CallActivityPanel(
        call = sampleCall(CallLifecycleStatus.Active, CallDirection.Incoming).copy(muted = true),
        media = CallMediaState(),
    )
}

@PreviewTest
@Preview(name = "call-control-states-light", widthDp = 412, showBackground = true)
@Composable
fun CallControlStatesLightScreenshot() {
    CallComponentStrip(darkTheme = false) { CallControlStates() }
}

@PreviewTest
@Preview(
    name = "call-control-states-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun CallControlStatesDarkScreenshot() {
    CallComponentStrip(darkTheme = true) { CallControlStates() }
}

@PreviewTest
@Preview(name = "call-activity-states-light", widthDp = 412, showBackground = true)
@Composable
fun CallActivityStatesLightScreenshot() {
    CallComponentStrip(darkTheme = false) { CallActivityStates() }
}
