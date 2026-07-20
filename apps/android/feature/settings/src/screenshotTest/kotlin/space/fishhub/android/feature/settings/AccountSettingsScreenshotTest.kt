package space.fishhub.android.feature.settings

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.core.designsystem.FishTheme

@PreviewTest
@Preview(name = "account light", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AccountSettingsLightScreenshot() = SettingsFrame("account", false)

@PreviewTest
@Preview(
    name = "account dark",
    widthDp = 412,
    heightDp = 640,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun AccountSettingsDarkScreenshot() = SettingsFrame("account", true)

@PreviewTest
@Preview(name = "account compact", widthDp = 320, heightDp = 640, showBackground = true)
@Composable
fun AccountSettingsCompactScreenshot() = SettingsFrame("account", false)

@PreviewTest
@Preview(name = "account large font", widthDp = 412, heightDp = 915, fontScale = 2f)
@Composable
fun AccountSettingsLargeFontScreenshot() = SettingsFrame("account", false)

@PreviewTest
@Preview(name = "presence rtl", widthDp = 412, heightDp = 640, locale = "ar")
@Composable
fun AccountSettingsPresenceRtlScreenshot() = SettingsFrame("presence", false)

@PreviewTest
@Preview(name = "blocked list", widthDp = 412, heightDp = 640, showBackground = true)
@Composable
fun AccountSettingsBlockedScreenshot() = SettingsFrame("blocked", false)

@Composable
private fun SettingsFrame(page: String, darkTheme: Boolean) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        AccountSettingsPreviewContent(page = page)
    }
}
