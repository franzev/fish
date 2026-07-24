package space.fishhub.android.feature.chat

import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.presence.PresencePresentation
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryAnchor
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryCategory
import space.fishhub.android.feature.chat.sharedcontent.SharedContentEarlierState
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryIntent
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryItem
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryScreen
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryUiState
import space.fishhub.android.feature.chat.sharedcontent.SharedContentNativeActionResult
import space.fishhub.android.feature.chat.sharedcontent.SharedContentPreviewItem
import space.fishhub.android.feature.chat.sharedcontent.SharedContentPreviewScreen
import space.fishhub.android.feature.chat.sharedcontent.SharedContentTextDirection
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentHistoryBoundary
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentManualRetryState
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationContract
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationNotice
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentUnavailableReason

@RunWith(AndroidJUnit4::class)
class SharedContentNavigationTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun headerOriginOpensOneFullScreenRouteAndRestoresHeaderFocus() {
        composeRule.setContent {
            FishTheme(reducedMotion = true) {
                SharedContentNavigationContract()
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithTag(ParticipantDetailsTag, useUnmergedTree = true)
            .assertContentDescriptionEquals("Conversation details")
            .assertHeightIsAtLeast(48.dp)
        composeRule.onNodeWithTag(HeaderSharedContentTag)
            .assertContentDescriptionEquals("Shared content")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        composeRule.onNodeWithTag(GalleryTag)
            .assertHeightIsAtLeast(600.dp)
        composeRule.onAllNodes(isDialog()).assertCountEquals(0)
        composeRule.onNodeWithTag(OpenCountTag).assertTextEquals("Opened 1 time")
        composeRule.onNodeWithText("Refresh contract").performClick()
        composeRule.onNodeWithTag(OpenCountTag).assertTextEquals("Opened 1 time")

        composeRule.activity.onBackPressedDispatcher.onBackPressed()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag(HeaderSharedContentTag).assertIsFocused()

        composeRule.onNodeWithTag(HeaderSharedContentTag).performClick()
        composeRule.onNodeWithTag(OpenCountTag).assertTextEquals("Opened 2 times")
    }

    @Test
    fun detailsOriginVisibleAndSystemBackReturnThroughExplicitOrigin() {
        composeRule.setContent {
            FishTheme(reducedMotion = true) {
                SharedContentNavigationContract()
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithTag(ParticipantDetailsTag, useUnmergedTree = true)
            .assertContentDescriptionEquals("Conversation details")
            .performClick()
        composeRule.onNodeWithTag(DetailsSharedContentTag)
            .assertTextContains("Shared content")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        composeRule.onNodeWithTag(GalleryTag).assertExists()
        composeRule.onNodeWithContentDescription("Back")
            .assertHeightIsAtLeast(48.dp)
            .performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag(DetailsSharedContentTag).assertIsFocused()

        composeRule.activity.onBackPressedDispatcher.onBackPressed()
        composeRule.waitForIdle()
        composeRule.onNodeWithTag(ParticipantDetailsTag, useUnmergedTree = true)
            .assertIsFocused()
    }

    @Test
    fun identityRevocationClosesRouteAndStaleOrCrossConversationCallbacksFailClosed() {
        val lifecycle = GalleryLifecycleContract(
            conversationId = "conversation-a",
            identityGeneration = 7,
        )

        lifecycle.open()
        assertTrue(lifecycle.accept("conversation-a", generation = 7))
        assertFalse(lifecycle.accept("conversation-b", generation = 7))
        assertFalse(lifecycle.accept("conversation-a", generation = 6))

        lifecycle.revokeIdentity()

        assertFalse(lifecycle.isOpen)
        assertFalse(lifecycle.accept("conversation-a", generation = 7))
        assertEquals(1, lifecycle.openCount)
    }

    @Test
    fun galleryRecordsAndRestoresTheFocusedItemAnchor() {
        var focusedAnchor: String? = null
        composeRule.setContent {
            FishTheme(reducedMotion = true) {
                SharedContentGalleryScreen(
                    state = focusedFilesState(),
                    onBack = {},
                    onIntent = { intent ->
                        if (intent is SharedContentGalleryIntent.RecordAnchor) {
                            focusedAnchor = intent.focusedItemId
                        }
                    },
                    onSelectItem = {},
                )
            }
        }

        composeRule.waitUntil(timeoutMillis = 5_000) {
            focusedAnchor == "file-b"
        }
        composeRule.onNodeWithContentDescription(
            "Practice notes.pdf, PDF, 1 MB",
            useUnmergedTree = true,
        ).assertIsFocused()
    }

    @Test
    fun previewSerializesNativeActionsAndSurfacesRetryableFailures() {
        val firstActionFinished = CompletableDeferred<Unit>()
        var callCount = 0
        var firstCall = true

        composeRule.setContent {
            FishTheme(reducedMotion = true) {
                SharedContentPreviewScreen(
                    item = previewTestItem(),
                    onBack = {},
                    onOpenSource = {},
                    onNativeAction = {
                        callCount += 1
                        if (firstCall) {
                            firstCall = false
                            firstActionFinished.await()
                        }
                        SharedContentNativeActionResult.Unavailable
                    },
                    onDelete = {},
                )
            }
        }

        composeRule.onNodeWithText("Share").performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) { callCount == 1 }
        composeRule.onNodeWithText("Save").assertIsNotEnabled()
        composeRule.onNodeWithText("Download").assertIsNotEnabled()

        firstActionFinished.complete(Unit)
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Reconnect and try again.")
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        composeRule.onNodeWithText("Share").assertIsEnabled().performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) { callCount == 2 }
    }

    @Test
    fun productionNavigationSurfaceRemainsIntentionallyRed() {
        val requiredSymbols = listOf(
            "space.fishhub.android.feature.chat.sharedcontent.SharedContentOrigin",
            "space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryScreenKt",
        )
        val missing = requiredSymbols.filter { name ->
            runCatching { Class.forName(name) }.isFailure
        }

        assertEquals(
            "RED: missing Phase 13 shared-content navigation symbols",
            emptyList<String>(),
            missing,
        )
    }
}

private enum class NavigationOrigin {
    Header,
    Details,
}

private sealed interface NavigationContractRoute {
    data object Conversation : NavigationContractRoute
    data object Details : NavigationContractRoute
    data class Gallery(
        val origin: NavigationOrigin,
        val entry: Int,
    ) : NavigationContractRoute
}

private enum class FocusReturn {
    None,
    HeaderSharedContent,
    DetailsSharedContent,
    ParticipantDetails,
}

@Composable
private fun SharedContentNavigationContract() {
    var route: NavigationContractRoute by remember { mutableStateOf(NavigationContractRoute.Conversation) }
    var focusReturn by remember { mutableStateOf(FocusReturn.None) }
    var nextEntry by remember { mutableIntStateOf(0) }
    var openCount by remember { mutableIntStateOf(0) }
    val headerSharedContentFocus = remember { FocusRequester() }
    val participantDetailsFocus = remember { FocusRequester() }
    val participant = remember {
        ParticipantUiModel(
            id = "coach-jordan",
            displayName = "Coach Jordan",
            contextLabel = "Coach",
        )
    }

    fun openGallery(origin: NavigationOrigin) {
        nextEntry += 1
        route = NavigationContractRoute.Gallery(origin, nextEntry)
    }

    fun navigateBack() {
        route = when (val current = route) {
            NavigationContractRoute.Conversation -> current
            NavigationContractRoute.Details -> {
                focusReturn = FocusReturn.ParticipantDetails
                NavigationContractRoute.Conversation
            }
            is NavigationContractRoute.Gallery -> when (current.origin) {
                NavigationOrigin.Header -> {
                    focusReturn = FocusReturn.HeaderSharedContent
                    NavigationContractRoute.Conversation
                }
                NavigationOrigin.Details -> {
                    focusReturn = FocusReturn.DetailsSharedContent
                    NavigationContractRoute.Details
                }
            }
        }
    }

    BackHandler(enabled = route != NavigationContractRoute.Conversation, onBack = ::navigateBack)

    LaunchedEffect(route) {
        repeat(3) { withFrameNanos { } }
        when (focusReturn) {
            FocusReturn.HeaderSharedContent -> headerSharedContentFocus.requestFocus()
            FocusReturn.DetailsSharedContent -> Unit
            FocusReturn.ParticipantDetails -> participantDetailsFocus.requestFocus()
            FocusReturn.None -> Unit
        }
    }

    when (val current = route) {
        NavigationContractRoute.Conversation -> {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(FishTheme.colors.background),
            ) {
                ChatTopBar(
                    participant = participant,
                    presence = PresencePresentation(label = "Online"),
                    showBack = false,
                    onBack = {},
                    onOpenSharedContent = { openGallery(NavigationOrigin.Header) },
                    onOpenParticipantDetails = { route = NavigationContractRoute.Details },
                    sharedContentModifier = Modifier
                        .testTag(HeaderSharedContentTag)
                        .focusRequester(headerSharedContentFocus)
                        .focusable(),
                    participantDetailsModifier = Modifier
                        .testTag(ParticipantDetailsTag)
                        .focusRequester(participantDetailsFocus)
                        .focusable(),
                )
            }
        }
        NavigationContractRoute.Details -> {
            ParticipantDetailsSheet(
                participant = participant,
                presence = PresencePresentation(label = "Online"),
                onDismiss = ::navigateBack,
                onOpenSharedContent = { openGallery(NavigationOrigin.Details) },
                onRemoveFriend = {},
                onBlock = {},
                sharedContentModifier = Modifier.testTag(DetailsSharedContentTag),
                requestSharedContentFocus =
                    focusReturn == FocusReturn.DetailsSharedContent,
            )
        }
        is NavigationContractRoute.Gallery -> {
            LaunchedEffect(current.entry) {
                openCount += 1
            }
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(FishTheme.colors.background)
                    .testTag(GalleryTag),
            ) {
                FishTopBar(title = "Shared content", showBack = true, onBack = ::navigateBack)
                androidx.compose.material3.Text(
                    text = if (openCount == 1) "Opened 1 time" else "Opened $openCount times",
                    modifier = Modifier.testTag(OpenCountTag),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.body,
                )
                var refreshContract by remember { mutableIntStateOf(0) }
                FishButton(
                    label = "Refresh contract",
                    onClick = { refreshContract += 1 },
                    variant = FishButtonVariant.Ghost,
                )
                Box(modifier = Modifier.testTag("recomposition-$refreshContract"))
            }
        }
    }
}

private class GalleryLifecycleContract(
    private val conversationId: String,
    private val identityGeneration: Int,
) {
    var isOpen: Boolean = false
        private set
    var openCount: Int = 0
        private set
    private var revoked = false

    fun open() {
        if (!isOpen && !revoked) {
            isOpen = true
            openCount += 1
        }
    }

    fun accept(callbackConversationId: String, generation: Int): Boolean =
        isOpen &&
            !revoked &&
            callbackConversationId == conversationId &&
            generation == identityGeneration

    fun revokeIdentity() {
        revoked = true
        isOpen = false
    }
}

private const val GalleryTag = "shared-content-gallery"
private const val HeaderSharedContentTag = "header-shared-content"
private const val ParticipantDetailsTag = "participant-details"
private const val DetailsSharedContentTag = "details-shared-content"
private const val OpenCountTag = "shared-content-open-count"

private fun focusedFilesState() = SharedContentGalleryUiState(
    categories = listOf(SharedContentGalleryCategory.Files),
    selectedCategory = SharedContentGalleryCategory.Files,
    showCategoryControl = false,
    items = listOf(
        SharedContentGalleryItem.File(
            itemId = "file-a",
            kind = "document",
            filename = "Conversation outline.pdf",
            filenameDirection = SharedContentTextDirection.Natural,
            friendlyType = "PDF",
            sizeLabel = "1 MB",
            accessibilityLabel = "Conversation outline.pdf, PDF, 1 MB",
            selectionEnabled = true,
        ),
        SharedContentGalleryItem.File(
            itemId = "file-b",
            kind = "document",
            filename = "Practice notes.pdf",
            filenameDirection = SharedContentTextDirection.Natural,
            friendlyType = "PDF",
            sizeLabel = "1 MB",
            accessibilityLabel = "Practice notes.pdf, PDF, 1 MB",
            selectionEnabled = true,
        ),
    ),
    anchors = mapOf(
        SharedContentGalleryCategory.Files to SharedContentGalleryAnchor(
            itemId = "file-b",
            focusedItemId = "file-b",
        ),
    ),
    presentation = SharedContentPresentationContract(
        source = "authoritative",
        stale = false,
        retainedHistoryComplete = true,
        notice = SharedContentPresentationNotice.None,
        boundary = SharedContentHistoryBoundary.None,
        unavailableReason = SharedContentUnavailableReason.None,
        manualRetry = SharedContentManualRetryState.Hidden,
    ),
    earlierState = SharedContentEarlierState.Hidden,
    itemSelectionEnabled = true,
)

private fun previewTestItem() = SharedContentPreviewItem(
    itemId = "preview-document",
    conversationId = "conversation-a",
    sourceMessageId = "message-a",
    kind = "document",
    category = "files",
    title = "Coaching notes.pdf",
    description = null,
    originalName = "Coaching notes.pdf",
    mimeType = "application/pdf",
    byteSize = 4,
    width = null,
    height = null,
    durationMs = null,
    linkUrl = null,
    attachmentId = "attachment-a",
    senderName = "Coach Jordan",
    sourceDateLabel = "Jul 24, 2026 at 6:30 PM",
    contentVersion = "version-a",
    canDelete = false,
    canExport = true,
)
