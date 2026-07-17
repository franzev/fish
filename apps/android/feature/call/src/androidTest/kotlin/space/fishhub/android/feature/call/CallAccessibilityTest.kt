package space.fishhub.android.feature.call

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.CallSessionState
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CallAccessibilityTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun incomingActionsAreLargeLabeledAndInvokeOnce() {
        var answered = 0
        var declined = 0
        composeRule.setContent {
            FishTheme {
                TestCallScreen(
                    call = sampleCall(
                        status = CallLifecycleStatus.Ringing,
                        direction = CallDirection.Incoming,
                    ),
                    onAnswer = { answered += 1 },
                    onDecline = { declined += 1 },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithText("Answer")
            .assertHeightIsAtLeast(48.dp)
            .performClick()
        composeRule.onNodeWithText("Decline")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(answered == 1)
        assertTrue(declined == 1)
    }

    @Test
    fun activeVideoControlsAndDataSaverAreAccessible() {
        composeRule.setContent {
            FishTheme {
                TestCallScreen(
                    call = sampleCall(
                        status = CallLifecycleStatus.Active,
                        direction = CallDirection.Outgoing,
                        kind = CallKind.Video,
                        cameraEnabled = true,
                    ),
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription("Mute").assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Turn camera off").assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Switch camera").assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Call settings").performClick()
        composeRule.onNodeWithText("Use less data").assertExists()
        composeRule.onNodeWithContentDescription("End call").assertHeightIsAtLeast(48.dp)
    }
}

@androidx.compose.runtime.Composable
private fun TestCallScreen(
    call: CallSessionState,
    onAnswer: () -> Unit = {},
    onDecline: () -> Unit = {},
) {
    CallScreen(
        call = call,
        mediaState = CallMediaState(),
        notice = null,
        busy = false,
        qualityPreference = VideoQualityPreference.Auto,
        audioEndpoints = emptyList(),
        mediaEngine = null,
        onAnswer = onAnswer,
        onDecline = onDecline,
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
    connectedAt = if (status == CallLifecycleStatus.Active) "2026-07-17T10:00:04Z" else null,
)
