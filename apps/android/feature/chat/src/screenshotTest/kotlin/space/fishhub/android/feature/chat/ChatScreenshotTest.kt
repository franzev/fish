package space.fishhub.android.feature.chat

import android.content.res.Configuration
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import space.fishhub.android.data.chat.MessageSearchCursor
import space.fishhub.android.core.designsystem.FishTheme

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
@Preview(name = "message search initial", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun MessageSearchInitialScreenshot() {
    MessageSearchScreenshot(state = MessageSearchUiState(visible = true))
}

@PreviewTest
@Preview(name = "message search loading", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun MessageSearchLoadingScreenshot() {
    MessageSearchScreenshot(
        state = MessageSearchUiState(
            visible = true,
            query = "practice",
            submittedQuery = "practice",
            loading = true,
        ),
    )
}

@PreviewTest
@Preview(name = "message search results", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun MessageSearchResultsScreenshot() {
    MessageSearchScreenshot(state = searchResultsState())
}

@PreviewTest
@Preview(name = "message search empty", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun MessageSearchEmptyScreenshot() {
    MessageSearchScreenshot(
        state = MessageSearchUiState(
            visible = true,
            query = "unfamiliar",
            submittedQuery = "unfamiliar",
        ),
    )
}

@PreviewTest
@Preview(name = "message search failure", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun MessageSearchFailureScreenshot() {
    MessageSearchScreenshot(
        state = MessageSearchUiState(
            visible = true,
            query = "practice",
            submittedQuery = "practice",
            notice = "Search is taking a little longer. Check your connection and try again.",
        ),
    )
}

@PreviewTest
@Preview(name = "message search loading more", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun MessageSearchLoadingMoreScreenshot() {
    MessageSearchScreenshot(
        state = searchResultsState().copy(
            loadingMore = true,
            nextCursor = MessageSearchCursor("2026-07-16T00:00:00Z", "message-2"),
        ),
    )
}

@PreviewTest
@Preview(
    name = "message search dark",
    widthDp = 412,
    heightDp = 915,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun MessageSearchDarkScreenshot() {
    MessageSearchScreenshot(state = searchResultsState(), darkTheme = true)
}

@PreviewTest
@Preview(name = "message search large font", widthDp = 412, heightDp = 915, fontScale = 2f, showBackground = true)
@Composable
fun MessageSearchLargeFontScreenshot() {
    MessageSearchScreenshot(state = searchResultsState())
}

@PreviewTest
@Preview(
    name = "message search rtl",
    widthDp = 412,
    heightDp = 915,
    locale = "ar",
    showBackground = true,
)
@Composable
fun MessageSearchRtlScreenshot() {
    MessageSearchScreenshot(state = searchResultsState())
}

@PreviewTest
@Preview(name = "message search expanded", widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
fun MessageSearchExpandedScreenshot() {
    MessageSearchScreenshot(state = searchResultsState())
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

@PreviewTest
@Preview(name = "attachments 0 compact", widthDp = 360, heightDp = 640, showBackground = true)
@Composable
fun AttachmentZeroScreenshot() {
    FishTheme(reducedMotion = true) {
        AttachmentPreviewScreen(
            attachments = emptyList(),
            importing = false,
            notice = null,
            onRemove = {},
            onAddToMessage = {},
            onDismiss = {},
        )
    }
}

@PreviewTest
@Preview(name = "attachments 1 photo", widthDp = 360, heightDp = 640, showBackground = true)
@Composable
fun AttachmentOnePhotoScreenshot() {
    AttachmentQueueScreenshot(attachments = attachmentScreenshotItems(1, AttachmentMatrixKind.Photos))
}

@PreviewTest
@Preview(
    name = "attachments 2 files dark",
    widthDp = 412,
    heightDp = 720,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
    showBackground = true,
)
@Composable
fun AttachmentTwoFilesDarkScreenshot() {
    AttachmentQueueScreenshot(
        attachments = attachmentScreenshotItems(2, AttachmentMatrixKind.Files),
        darkTheme = true,
    )
}

@PreviewTest
@Preview(
    name = "attachments 3 mixed RTL",
    widthDp = 412,
    heightDp = 720,
    locale = "ar",
    showBackground = true,
)
@Composable
fun AttachmentThreeMixedRtlScreenshot() {
    AttachmentQueueScreenshot(attachments = attachmentScreenshotItems(3, AttachmentMatrixKind.Mixed))
}

@PreviewTest
@Preview(name = "attachments 4 active expanded", widthDp = 1024, heightDp = 600, showBackground = true)
@Composable
fun AttachmentFourActiveExpandedScreenshot() {
    AttachmentQueueScreenshot(
        attachments = attachmentScreenshotItems(4, AttachmentMatrixKind.Mixed).mapIndexed { index, item ->
            item.copy(
                transferState = listOf(
                    AttachmentTransferUiState.Preparing,
                    AttachmentTransferUiState.Uploading,
                    AttachmentTransferUiState.Checking,
                    AttachmentTransferUiState.Waiting,
                )[index],
                progressFraction = if (index == 1) 0.58f else 0f,
            )
        },
    )
}

@PreviewTest
@Preview(name = "attachments 5 partial failure compact", widthDp = 320, heightDp = 720, showBackground = true)
@Composable
fun AttachmentFivePartialFailureScreenshot() {
    AttachmentQueueScreenshot(
        attachments = attachmentScreenshotItems(5, AttachmentMatrixKind.Mixed).mapIndexed { index, item ->
            if (index == 0) {
                item.copy(
                    transferState = AttachmentTransferUiState.Failed,
                    retryable = true,
                    failureReason = AttachmentFailureUiReason.SafetyCheckFailed,
                )
            } else {
                item
            }
        },
    )
}

@PreviewTest
@Preview(
    name = "attachment recovery 200 percent font",
    widthDp = 412,
    heightDp = 915,
    fontScale = 2f,
    showBackground = true,
)
@Composable
fun AttachmentRecoveryLargeFontScreenshot() {
    AttachmentQueueScreenshot(
        attachments = listOf(
            attachmentScreenshotItem(0, isPhoto = false).copy(
                name = "client coaching notes with a long descriptive filename.pdf",
                transferState = AttachmentTransferUiState.Failed,
                retryable = true,
                failureReason = AttachmentFailureUiReason.LocalCopyUnavailable,
            ),
        ),
    )
}

@PreviewTest
@Preview(name = "attachment preview photo", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun AttachmentPreviewPhotoScreenshot() {
    FishTheme(reducedMotion = true) {
        AttachmentPreviewScreen(
            attachments = attachmentScreenshotItems(2, AttachmentMatrixKind.Mixed),
            importing = false,
            notice = null,
            onRemove = {},
            onAddToMessage = {},
            onDismiss = {},
        )
    }
}

@PreviewTest
@Preview(name = "attachment source sheet", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun AttachmentSourceSheetScreenshot() {
    FishTheme(reducedMotion = true) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(FishTheme.colors.background),
            contentAlignment = Alignment.BottomCenter,
        ) {
            AttachmentSourceContent(
                remainingSlots = 3,
                cameraAvailable = true,
                onChoosePhotos = {},
                onTakePhoto = {},
                onChooseFile = {},
                onDismiss = {},
                modifier = Modifier.background(FishTheme.colors.surface),
            )
        }
    }
}

@PreviewTest
@Preview(name = "sent mixed attachments", widthDp = 412, heightDp = 720, showBackground = true)
@Composable
fun SentMixedAttachmentsScreenshot() {
    FishTheme(reducedMotion = true) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            contentAlignment = Alignment.TopStart,
        ) {
            MessageAttachmentGroup(
                attachments = sentAttachmentScreenshotItems(),
                author = "Coach Jordan",
                timeLabel = "10:42 AM",
                onPhotoClick = {},
                onFileClick = {},
                onPhotoLoadError = {},
            )
        }
    }
}

@PreviewTest
@Preview(name = "attachment photo viewer", widthDp = 412, heightDp = 915, showBackground = true)
@Composable
fun AttachmentPhotoViewerScreenshot() {
    FishTheme(reducedMotion = true) {
        AttachmentPhotoViewerContent(
            attachment = sentPhotoScreenshotItem(position = 0),
            onDismiss = {},
            onLoadError = {},
        )
    }
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

@Composable
private fun MessageSearchScreenshot(
    state: MessageSearchUiState,
    darkTheme: Boolean = false,
) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        MessageSearchScreen(
            state = state,
            onQueryChanged = {},
            onSubmitQuery = {},
            onRetry = {},
            onLoadMore = {},
            onResultSelected = {},
            onClose = {},
            modifier = Modifier.fillMaxSize(),
        )
    }
}

private fun searchResultsState() = MessageSearchUiState(
    visible = true,
    query = "practice",
    submittedQuery = "practice",
    results = listOf(
        MessageSearchResultUiModel(
            id = "message-1",
            senderLabel = "You",
            dateTimeLabel = "Today, 10:30 AM",
            excerpt = "I will practice this sentence before our next call.",
            accessibilityLabel = "You. I will practice this sentence before our next call. Today, 10:30 AM",
        ),
        MessageSearchResultUiModel(
            id = "message-2",
            senderLabel = "Coach Jordan",
            dateTimeLabel = "Yesterday, 4:15 PM",
            excerpt = "Try using ‘could you’ when you want the request to feel softer.",
            accessibilityLabel = "Coach Jordan. Try using could you when you want the request to feel softer. Yesterday, 4:15 PM",
        ),
    ),
    nextCursor = MessageSearchCursor("2026-07-16T00:00:00Z", "message-2"),
)

@Composable
private fun AttachmentQueueScreenshot(
    attachments: List<LocalAttachmentUiModel>,
    darkTheme: Boolean = false,
) {
    FishTheme(darkTheme = darkTheme, reducedMotion = true) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(FishTheme.colors.background)
                .padding(FishTheme.spacing.page),
            contentAlignment = Alignment.TopCenter,
        ) {
            ComposerAttachmentQueue(attachments = attachments, onRemove = {}, onRetry = {})
        }
    }
}

private enum class AttachmentMatrixKind { Photos, Files, Mixed }

private fun attachmentScreenshotItems(
    count: Int,
    kind: AttachmentMatrixKind,
): List<LocalAttachmentUiModel> = List(count) { position ->
    attachmentScreenshotItem(
        position = position,
        isPhoto = when (kind) {
            AttachmentMatrixKind.Photos -> true
            AttachmentMatrixKind.Files -> false
            AttachmentMatrixKind.Mixed -> position % 2 != 0
        },
    )
}

private fun attachmentScreenshotItem(position: Int, isPhoto: Boolean) = LocalAttachmentUiModel(
    id = "screenshot-attachment-$position",
    position = position,
    isPhoto = isPhoto,
    inPreview = false,
    name = if (isPhoto) "Coaching photo ${position + 1}" else "coaching-notes-${position + 1}.pdf",
    mimeType = if (isPhoto) "image/jpeg" else "application/pdf",
    byteSize = 128_000L + position,
    width = 1200.takeIf { isPhoto },
    height = 800.takeIf { isPhoto },
    localPath = if (isPhoto) AttachmentScreenshotPhotoUri else "/private/screenshot-attachment-$position",
    thumbnailPath = null,
    transferState = AttachmentTransferUiState.Ready,
)

private fun sentAttachmentScreenshotItems(): List<AttachmentUiModel> = listOf(
    sentPhotoScreenshotItem(position = 0),
    AttachmentUiModel(
        id = "sent-file",
        position = 1,
        kind = AttachmentUiKind.File,
        available = true,
        name = "coaching-notes.pdf",
        mimeType = "application/pdf",
        byteSize = 256_000,
        width = null,
        height = null,
        thumbnailUrl = null,
        displayUrl = null,
        contentVersion = "screenshot",
    ),
    sentPhotoScreenshotItem(position = 2),
)

private fun sentPhotoScreenshotItem(position: Int) = AttachmentUiModel(
    id = "sent-photo-$position",
    position = position,
    kind = AttachmentUiKind.Photo,
    available = true,
    name = "Coaching photo ${position + 1}",
    mimeType = "image/webp",
    byteSize = 128_000,
    width = 360,
    height = 240,
    thumbnailUrl = AttachmentScreenshotPhotoUri,
    displayUrl = AttachmentScreenshotPhotoUri,
    contentVersion = "screenshot",
)

private const val AttachmentScreenshotPhotoUri =
    "file:///android_asset/aquatic/hello-otter.webp"

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
