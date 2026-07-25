package space.fishhub.android.feature.presence

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.presence.PresenceDisplayStatus

// Component-level screenshot cases. Each preview `name` matches the `named:`
// string FishKit passes to assertThemedSnapshots so the pair can be compared
// side by side. Screen-level cases live in PresenceScreenshotTest.

@Composable
private fun ComponentStrip(darkTheme: Boolean, content: @Composable () -> Unit) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            content()
        }
    }
}

private val everyStatus = listOf(
    PresenceDisplayStatus.Online to "Online",
    PresenceDisplayStatus.Idle to "Idle",
    PresenceDisplayStatus.Away to "Away",
    PresenceDisplayStatus.Busy to "Busy",
    PresenceDisplayStatus.Invisible to "Invisible",
    PresenceDisplayStatus.Offline to "Offline",
)

@Composable
private fun PresenceIndicatorStates() {
    everyStatus.forEach { (status, label) ->
        PresenceIndicator(status = status, label = label)
    }
}

@Composable
private fun PresenceAvatarStates() {
    everyStatus.forEach { (status, label) ->
        PresenceAvatar(
            name = "Coach Jordan",
            presence = PresencePresentation(status = status, label = label),
        )
    }
}

@Composable
private fun PresenceSummaryStates() {
    everyStatus.forEach { (status, label) ->
        PresenceSummary(presence = PresencePresentation(status = status, label = label))
    }
    PresenceSummary(
        presence = PresencePresentation(
            status = PresenceDisplayStatus.Busy,
            label = "Busy",
            detail = "Until 4:00 PM",
        ),
    )
}

@PreviewTest
@Preview(name = "presence-indicators-light", widthDp = 412, showBackground = true)
@Composable
fun PresenceIndicatorsLightScreenshot() {
    ComponentStrip(darkTheme = false) { PresenceIndicatorStates() }
}

@PreviewTest
@Preview(
    name = "presence-indicators-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun PresenceIndicatorsDarkScreenshot() {
    ComponentStrip(darkTheme = true) { PresenceIndicatorStates() }
}

@PreviewTest
@Preview(name = "presence-avatars-light", widthDp = 412, showBackground = true)
@Composable
fun PresenceAvatarsLightScreenshot() {
    ComponentStrip(darkTheme = false) { PresenceAvatarStates() }
}

@PreviewTest
@Preview(
    name = "presence-avatars-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun PresenceAvatarsDarkScreenshot() {
    ComponentStrip(darkTheme = true) { PresenceAvatarStates() }
}

@PreviewTest
@Preview(name = "presence-summaries-light", widthDp = 412, showBackground = true)
@Composable
fun PresenceSummariesLightScreenshot() {
    ComponentStrip(darkTheme = false) { PresenceSummaryStates() }
}

@PreviewTest
@Preview(
    name = "presence-summaries-dark",
    widthDp = 412,
    showBackground = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
fun PresenceSummariesDarkScreenshot() {
    ComponentStrip(darkTheme = true) { PresenceSummaryStates() }
}
