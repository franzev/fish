package com.fish.android.feature.chat

import androidx.activity.ComponentActivity
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.fish.android.core.designsystem.FishTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatAccessibilityTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun loadedConversationPassesAccessibilityChecks() {
        composeRule.setContent { TestChat() }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithText("Coach Jordan").assertExists()
        composeRule.onNodeWithText("Message").performClick()
    }

    @Test
    fun sendActionRetainsTargetAndInvokesOnce() {
        var sent = false
        composeRule.setContent {
            FishTheme {
                MessageComposer(
                    state = rememberTextFieldState("I practiced the final sentence."),
                    onSend = { sent = true },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription("Send message")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(sent)
    }

    @Test
    fun signInImeNextMovesFocusToPassword() {
        composeRule.setContent {
            FishTheme {
                SignInScreen(
                    state = ChatRouteUiState.SignedOut(),
                    onEmailChange = {},
                    onPasswordChange = {},
                    onSignIn = {},
                )
            }
        }

        val fields = composeRule.onAllNodes(hasSetTextAction())
        fields[0].performClick().performImeAction()
        fields[1].assertIsFocused()
    }

    @Composable
    private fun TestChat() {
        FishTheme(reducedMotion = true) {
            ChatAdaptiveLayout(
                model = ChatSamples.loaded,
                composerState = rememberTextFieldState(),
                onSend = {},
                onBack = {},
                onRetryEarlier = {},
                onSelectConversation = {},
            )
        }
    }
}
