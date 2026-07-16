package com.fish.android.feature.chat

import android.content.res.Configuration
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
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

@PreviewTest
@Preview(name = "selected sticker preview", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun SelectedStickerPreviewScreenshot() {
    ScreenshotFrame(
        model = ChatSamples.loaded,
        darkTheme = false,
        pendingMedia = ComposerMediaUiModel.Sticker(
            StickerUiModel(
                id = "aquatic-hello-otter",
                phrase = "Hello!",
                description = "A cheerful sea otter waving hello",
                assetPath = "aquatic/hello-otter.webp",
            ),
        ),
    )
}

@PreviewTest
@Preview(name = "unknown sticker message", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun UnknownStickerScreenshot() {
    ScreenshotFrame(
        model = ChatSamples.loaded.copy(
            messages = ChatSamples.loaded.messages + MessageUiModel(
                id = "unknown-sticker",
                senderName = "Coach Jordan",
                body = "",
                timeLabel = "10:42 AM",
                isOutgoing = false,
                sticker = StickerUiModel(
                    id = "aquatic-future-sticker",
                    phrase = "Sticker unavailable",
                    description = "Sticker unavailable",
                    assetPath = null,
                ),
            ),
        ),
        darkTheme = false,
    )
}

@PreviewTest
@Preview(name = "emoji picker search", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun EmojiPickerScreenshot() {
    PickerScreenshot(
        MediaPickerUiState(
            emojiQuery = "smile",
            emojiResults = listOf(
                EmojiCatalogEntry("😀", "grinning face", "grinning_face"),
                EmojiCatalogEntry("😊", "smiling face", "smiling_face"),
                EmojiCatalogEntry("🙂", "slightly smiling face", "slightly_smiling_face"),
            ),
        ),
    )
}

@PreviewTest
@Preview(name = "sticker picker", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun StickerPickerScreenshot() {
    PickerScreenshot(
        MediaPickerUiState(
            activeTab = MediaPickerTab.Sticker,
            stickers = screenshotStickers,
        ),
    )
}

@PreviewTest
@Preview(name = "GIF picker loading", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun GifPickerLoadingScreenshot() {
    PickerScreenshot(
        MediaPickerUiState(
            activeTab = MediaPickerTab.Gif,
            gifAvailable = true,
            loadingGifs = true,
            animateGifPreviews = false,
        ),
    )
}

@Composable
private fun ScreenshotFrame(
    model: ChatUiModel,
    darkTheme: Boolean,
    draft: String = "",
    pendingMedia: ComposerMediaUiModel? = null,
) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        ChatAdaptiveLayout(
            model = model,
            composerState = rememberTextFieldState(draft),
            onSend = {},
            onBack = {},
            onRetryEarlier = {},
            onSelectConversation = {},
            pendingMedia = pendingMedia,
        )
    }
}

@Composable
private fun PickerScreenshot(state: MediaPickerUiState) {
    FishTheme(reducedMotion = true) {
        androidx.compose.foundation.layout.Box(
            modifier = androidx.compose.ui.Modifier
                .fillMaxSize()
                .background(FishTheme.colors.background),
            contentAlignment = androidx.compose.ui.Alignment.BottomCenter,
        ) {
            ChatMediaPickerContent(
                state = state,
                onDismiss = {},
                onTabSelected = {},
                onQueryChanged = {},
                onEmojiSelected = {},
                onGifSelected = {},
                onStickerSelected = {},
                onRetryGifs = {},
                onLoadMoreGifs = {},
                onToggleGifAnimations = {},
            )
        }
    }
}

private val screenshotStickers = listOf(
    StickerCatalogItem(
        id = "aquatic-hello-otter",
        phrase = "Hello!",
        animal = "sea otter",
        description = "A cheerful sea otter waving hello",
        sourcePath = "/stickers/aquatic/hello-otter.webp",
        styles = listOf("cute"),
        keywords = listOf("hello"),
    ),
    StickerCatalogItem(
        id = "aquatic-thank-you-octopus",
        phrase = "Thank you",
        animal = "octopus",
        description = "A grateful coral octopus saying thank you",
        sourcePath = "/stickers/aquatic/thank-you-octopus.webp",
        styles = listOf("cute"),
        keywords = listOf("thanks"),
    ),
    StickerCatalogItem(
        id = "aquatic-awesome-dolphin",
        phrase = "Awesome!",
        animal = "dolphin",
        description = "An excited dolphin saying awesome",
        sourcePath = "/stickers/aquatic/awesome-dolphin.webp",
        styles = listOf("expressive"),
        keywords = listOf("great"),
    ),
)
