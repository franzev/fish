package space.fishhub.android.feature.presence

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.presence.PresenceDisplayStatus
import space.fishhub.android.data.presence.PresencePreference
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PresenceAccessibilityTest {
    @get:Rule val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun accountTriggerCombinesIdentityAndStatusAndKeepsTouchTarget() {
        var clicked = false
        composeRule.setContent {
            FishTheme {
                PresenceAccountTrigger(
                    displayName = "Franz",
                    presence = PresencePresentation(PresenceDisplayStatus.Busy, "Do not disturb"),
                    onClick = { clicked = true },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription(
            "Franz, Do not disturb, account and status",
        )
            .assertHeightIsAtLeast(48.dp)
            .assertWidthIsAtLeast(48.dp)
            .performClick()
        assertTrue(clicked)
    }

    @Test
    fun statusRowsExposeSelectionAndMinimumTarget() {
        composeRule.setContent {
            FishTheme {
                PresenceAccountSheetPreviewContent(
                    page = "status",
                    state = PresenceUiState(
                        own = PresencePresentation(PresenceDisplayStatus.Away, "Away"),
                        ownPreference = PresencePreference.Away,
                    ),
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithText("Away")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Back")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Close")
            .assertHeightIsAtLeast(48.dp)
    }
}
