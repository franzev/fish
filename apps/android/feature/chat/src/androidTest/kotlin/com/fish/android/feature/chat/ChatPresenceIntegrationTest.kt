package com.fish.android.feature.chat

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.data.presence.PresenceDisplayStatus
import com.fish.android.feature.presence.PresenceAccountTrigger
import com.fish.android.feature.presence.PresencePresentation
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatPresenceIntegrationTest {
    @get:Rule val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun headerUpdatesParticipantAndPresenceWithoutRemounting() {
        var participant by mutableStateOf(
            ParticipantUiModel("coach-1", "Coach Jordan", "Coach"),
        )
        var presence by mutableStateOf(
            PresencePresentation(PresenceDisplayStatus.Online, "Online"),
        )
        composeRule.setContent {
            FishTheme {
                ChatTopBar(
                    participant = participant,
                    presence = presence,
                    showBack = false,
                    onBack = {},
                    accountContent = {
                        PresenceAccountTrigger(
                            displayName = "Franz",
                            presence = PresencePresentation(
                                PresenceDisplayStatus.Idle,
                                "Idle",
                            ),
                            onClick = {},
                        )
                    },
                )
            }
        }

        composeRule.onNodeWithText("Online").assertExists()
        composeRule.onNodeWithContentDescription("Coach Jordan, Online").assertExists()

        composeRule.runOnIdle {
            participant = ParticipantUiModel("coach-2", "Coach Mina", "Coach")
            presence = PresencePresentation(PresenceDisplayStatus.Away, "Away")
        }

        composeRule.onNodeWithText("Away").assertExists()
        composeRule.onNodeWithContentDescription("Coach Mina, Away").assertExists()
        composeRule.onNodeWithContentDescription("Voice call Coach Mina")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Franz, Idle, account and status")
            .assertHeightIsAtLeast(48.dp)
    }
}
