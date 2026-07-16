package com.fish.android.feature.chat

import android.content.res.Configuration
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import com.fish.android.core.designsystem.FishTheme

@PreviewTest
@Preview(name = "loaded phone light", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun LoadedPhoneLightScreenshot() {
    ScreenshotFrame(model = ChatSamples.loaded, darkTheme = false)
}

@PreviewTest
@Preview(
    name = "loaded phone dark",
    widthDp = 412,
    heightDp = 915,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun LoadedPhoneDarkScreenshot() {
    ScreenshotFrame(model = ChatSamples.loaded, darkTheme = true)
}

@PreviewTest
@Preview(name = "offline phone", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun OfflinePhoneScreenshot() {
    ScreenshotFrame(
        model = ChatSamples.offline,
        darkTheme = false,
        draft = "I can keep working on this while the connection returns.",
    )
}

@PreviewTest
@Preview(name = "failed send", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun FailedSendScreenshot() {
    ScreenshotFrame(model = ChatSamples.failed, darkTheme = false)
}

@PreviewTest
@Preview(name = "loading", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun LoadingScreenshot() {
    ScreenshotFrame(model = ChatSamples.loading, darkTheme = false)
}

@PreviewTest
@Preview(name = "large font", widthDp = 412, heightDp = 915, fontScale = 2f, showBackground = true)
@Composable
fun LargeFontScreenshot() {
    ScreenshotFrame(model = ChatSamples.loaded, darkTheme = false)
}

@PreviewTest
@Preview(name = "expanded tablet", widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
fun ExpandedTabletScreenshot() {
    ScreenshotFrame(model = ChatSamples.loaded, darkTheme = false)
}

@PreviewTest
@Preview(
    name = "rtl phone",
    widthDp = 412,
    heightDp = 915,
    locale = "ar",
    showBackground = true,
)
@Composable
fun RtlPhoneScreenshot() {
    ScreenshotFrame(model = ChatSamples.loaded, darkTheme = false)
}

@Composable
private fun ScreenshotFrame(
    model: ChatUiModel,
    darkTheme: Boolean,
    draft: String = "",
) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        ChatAdaptiveLayout(
            model = model,
            composerState = rememberTextFieldState(draft),
            onSend = {},
            onBack = {},
            onRetryEarlier = {},
            onSelectConversation = {},
        )
    }
}
