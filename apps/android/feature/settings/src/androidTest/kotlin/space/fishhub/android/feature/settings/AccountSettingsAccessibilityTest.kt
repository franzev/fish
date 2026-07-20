package space.fishhub.android.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import space.fishhub.android.core.designsystem.FishTheme

@RunWith(AndroidJUnit4::class)
class AccountSettingsAccessibilityTest {
    @get:Rule val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun accountRowsAndDismissControlsHaveAccessibleTargets() {
        composeRule.setContent {
            FishTheme { AccountSettingsPreviewContent() }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithText("Notifications")
            .assertHeightIsAtLeast(48.dp)
            .assertWidthIsAtLeast(48.dp)
        composeRule.onNodeWithText("Sign out")
            .assertHeightIsAtLeast(48.dp)

        composeRule.setContent {
            FishTheme { AccountSettingsPreviewContent(page = "presence") }
        }
        composeRule.onNodeWithContentDescription("Back")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithContentDescription("Close")
            .assertHeightIsAtLeast(48.dp)
    }
}
