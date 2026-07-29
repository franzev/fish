package space.fishhub.android.feature.friends

import androidx.activity.ComponentActivity
import androidx.compose.runtime.mutableStateOf
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
import space.fishhub.android.feature.friends.views.FriendsPreviewContent

@RunWith(AndroidJUnit4::class)
class FriendsAccessibilityTest {
    @get:Rule val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun friendsActionsAndRowsKeepAccessibleTargetsAndNames() {
        val page = mutableStateOf("input")
        composeRule.setContent {
            FishTheme { FriendsPreviewContent(page = page.value) }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription("Back")
            .assertHeightIsAtLeast(48.dp)
            .assertWidthIsAtLeast(48.dp)
        composeRule.onNodeWithText("Search")
            .assertHeightIsAtLeast(48.dp)

        composeRule.runOnIdle { page.value = "candidate" }
        composeRule.onNodeWithText("Add friend")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithText("Search again")
            .assertHeightIsAtLeast(48.dp)

        composeRule.runOnIdle { page.value = "requests" }
        composeRule.onNodeWithContentDescription("Sam Lee, @sam_lee")
            .assertHeightIsAtLeast(48.dp)
            .assertWidthIsAtLeast(48.dp)

        composeRule.runOnIdle { page.value = "review" }
        composeRule.onNodeWithText("Accept request")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithText("Decline")
            .assertHeightIsAtLeast(48.dp)
    }
}
