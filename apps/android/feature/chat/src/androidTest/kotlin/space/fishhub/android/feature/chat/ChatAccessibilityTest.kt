package space.fishhub.android.feature.chat

import androidx.activity.ComponentActivity
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.longClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.presence.PresencePresentation
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatAccessibilityTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun loadedConversationPassesAccessibilityChecks() {
        composeRule.setContent { TestChat() }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithText("Coach Jordan").assertExists()
        composeRule.onNodeWithText("Message").performClick()
    }

    @Test
    fun sendActionRetainsTargetAndInvokesOnce() {
        var sent = false
        composeRule.setContent {
            FishTheme {
                MessageComposer(
                    state = rememberTextFieldState("I practiced the final sentence."),
                    onSend = { sent = true },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription("Send message")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(sent)
    }

    @Test
    fun stickerOnlySendRetainsTargetAndInvokesOnce() {
        var sent = false
        composeRule.setContent {
            FishTheme {
                MessageComposer(
                    state = rememberTextFieldState(),
                    pendingMedia = ComposerMediaUiModel.Sticker(
                        StickerUiModel(
                            id = "aquatic-hello-otter",
                            phrase = "Hello!",
                            description = "A cheerful sea otter waving hello",
                            assetPath = "aquatic/hello-otter.webp",
                        ),
                    ),
                    onSend = { sent = true },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription("Send message")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(sent)
    }

    @Test
    fun mediaTriggerRetainsTargetAndUnknownStickerIsReadable() {
        var opened = false
        composeRule.setContent {
            FishTheme {
                androidx.compose.foundation.layout.Column {
                    MessageComposer(
                        state = rememberTextFieldState(),
                        onSend = {},
                        onOpenMediaPicker = { opened = true },
                    )
                    MessageBubble(
                        message = MessageUiModel(
                            id = "unknown-sticker",
                            senderName = "Coach Jordan",
                            body = "",
                            timeLabel = "10:30 AM",
                            isOutgoing = false,
                            sticker = StickerUiModel(
                                id = "future-sticker",
                                phrase = "Sticker unavailable",
                                description = "Sticker unavailable",
                                assetPath = null,
                            ),
                        ),
                    )
                }
            }
        }

        composeRule.onNodeWithContentDescription("Add emoji, GIF, or sticker")
            .assertHeightIsAtLeast(48.dp)
            .performClick()
        composeRule.onNodeWithContentDescription(
            "Coach Jordan. Sticker unavailable. 10:30 AM",
        ).assertExists()
        assertTrue(opened)
    }

    @Test
    fun pickerHasLabeledTabsCloseTargetAndNoSearchAutofocus() {
        var closed = false
        var selectedTab: MediaPickerTab? = null
        composeRule.setContent {
            FishTheme {
                ChatMediaPickerSheet(
                    state = MediaPickerUiState(emojiQuery = "face"),
                    onDismiss = { closed = true },
                    onTabSelected = { selectedTab = it },
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

        composeRule.onNodeWithText("Emoji").assertExists()
        composeRule.onNodeWithText("GIFs").performClick()
        composeRule.onAllNodes(hasSetTextAction())[0].assertIsNotFocused()
        composeRule.onNodeWithContentDescription("Close media picker")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(selectedTab == MediaPickerTab.Gif)
        assertTrue(closed)
    }

    @Test
    fun sharedCatalogAndStickerAssetsArePackagedTogether() {
        val context = androidx.test.core.app.ApplicationProvider.getApplicationContext<android.content.Context>()
        val catalog = ChatMediaCatalog.load(context)

        assertEquals(9, catalog.emojiGroups.size)
        assertEquals(32, catalog.stickers.size)
        context.assets.open(catalog.stickers.first().assetPath).use { asset ->
            assertTrue(asset.available() > 0)
        }
    }

    @Test
    fun signInImeNextMovesFocusToPassword() {
        composeRule.setContent {
            FishTheme {
                SignInScreen(
                    state = ChatRouteUiState.SignedOut(),
                    onEmailChange = {},
                    onPasswordChange = {},
                    onSignIn = {},
                )
            }
        }

        val fields = composeRule.onAllNodes(hasSetTextAction())
        fields[0].performClick().performImeAction()
        fields[1].assertIsFocused()
    }

    @Test
    fun mixedAttachmentsKeepOrderedLabelsAndFileTouchTarget() {
        var openedFile: String? = null
        composeRule.setContent {
            FishTheme {
                MessageBubble(
                    message = MessageUiModel(
                        id = "attachments",
                        senderName = "Coach Jordan",
                        body = "",
                        timeLabel = "10:30 AM",
                        isOutgoing = false,
                        attachments = listOf(
                            attachment("photo-1", 0, AttachmentUiKind.Photo, "Photo"),
                            attachment("file-1", 1, AttachmentUiKind.File, "practice notes.pdf"),
                            attachment("missing", 2, AttachmentUiKind.Unavailable, "Attachment", false),
                        ),
                    ),
                    onFileAttachmentClick = { openedFile = it },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithContentDescription(
            "Coach Jordan. Photo: Photo. 10:30 AM",
        ).assertExists()
        composeRule.onNodeWithContentDescription(
            "Coach Jordan. File: practice notes.pdf. PDF · 1 KB. 10:30 AM",
        ).assertHeightIsAtLeast(48.dp).performClick()
        composeRule.onNodeWithContentDescription(
            "Coach Jordan. Attachment. Attachment unavailable. 10:30 AM",
        ).assertExists()

        assertEquals("file-1", openedFile)
    }

    @Test
    fun attachmentSourceAndPreviewKeepOneClearActionAndAccessibleTargets() {
        var removed: String? = null
        var added = false
        composeRule.setContent {
            FishTheme {
                AttachmentPreviewScreen(
                    attachments = listOf(
                        localAttachment("photo", 0, true, "Photo"),
                        localAttachment("file", 1, false, "practice notes.pdf"),
                    ),
                    importing = false,
                    notice = null,
                    onRemove = { removed = it },
                    onAddToMessage = { added = true },
                    onDismiss = {},
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onNodeWithText("Item 1").assertExists()
        composeRule.onNodeWithText("Item 2").assertExists()
        composeRule.onAllNodesWithText("Remove")[0]
            .assertHeightIsAtLeast(48.dp)
            .performClick()
        composeRule.onNodeWithText("Add to message")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertEquals("photo", removed)
        assertTrue(added)
    }

    @Test
    fun composerAttachmentTriggerAndRemovalRemainReachable() {
        var pickerOpened = false
        var removed: String? = null
        composeRule.setContent {
            FishTheme {
                MessageComposer(
                    state = rememberTextFieldState(),
                    onSend = {},
                    pendingAttachments = listOf(localAttachment("file", 0, false, "lesson.pdf")),
                    onOpenAttachmentPicker = { pickerOpened = true },
                    onRemovePendingAttachment = { removed = it },
                )
            }
        }

        composeRule.onNodeWithContentDescription("Add photos or files")
            .assertHeightIsAtLeast(48.dp)
            .performClick()
        composeRule.onNodeWithContentDescription("Remove lesson.pdf")
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(pickerOpened)
        assertEquals("file", removed)
    }

    @Test
    fun attachmentQueueAnnouncesOneSummaryAndKeepsRecoveryActionsDistinct() {
        var retried: String? = null
        var removed: String? = null
        val failed = localAttachment("file", 0, false, "lesson.pdf").copy(
            transferState = AttachmentTransferUiState.Failed,
            retryable = true,
            failureReason = AttachmentFailureUiReason.LocalCopyUnavailable,
        )
        composeRule.setContent {
            FishTheme {
                ComposerAttachmentQueue(
                    attachments = listOf(failed),
                    onRetry = { retried = it },
                    onRemove = { removed = it },
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onAllNodesWithContentDescription(
            "lesson.pdf. Needs attention. This file is no longer available. Remove it and choose it again.",
        ).assertCountEquals(1)
        composeRule.onAllNodesWithContentDescription("Try lesson.pdf again")
            .assertCountEquals(1)[0]
            .assertHeightIsAtLeast(48.dp)
            .performClick()
        composeRule.onAllNodesWithContentDescription("Remove lesson.pdf")
            .assertCountEquals(1)[0]
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertEquals("file", retried)
        assertEquals("file", removed)
    }

    @Test
    fun photoViewerAnnouncesPhotoOnceAndKeepsCloseAsASeparateAction() {
        var dismissed = false
        composeRule.setContent {
            FishTheme {
                AttachmentPhotoViewer(
                    attachment = attachment(
                        id = "photo",
                        position = 0,
                        kind = AttachmentUiKind.Photo,
                        name = "Practice photo",
                    ).copy(displayUrl = "https://example.invalid/practice-photo.jpg"),
                    onDismiss = { dismissed = true },
                    onLoadError = {},
                )
            }
        }
        composeRule.enableAccessibilityChecks()

        composeRule.onAllNodesWithContentDescription(
            "Photo viewer: Practice photo. Pinch to zoom.",
        ).assertCountEquals(1)
        composeRule.onAllNodesWithContentDescription("Close photo viewer")
            .assertCountEquals(1)[0]
            .assertHeightIsAtLeast(48.dp)
            .performClick()

        assertTrue(dismissed)
    }

    @Test
    fun messageActionsExposeReplyAndRequireDeletionConfirmation() {
        var replied = false
        var deleted = false
        composeRule.setContent {
            FishTheme {
                ChatMessageActionsSheet(
                    message = actionableMessage(),
                    onDismiss = {},
                    onReply = { replied = true },
                    onEdit = {},
                    onDelete = { deleted = true },
                    onReact = {},
                )
            }
        }
        composeRule.onNodeWithTag("message-actions-sheet").assertExists()
        composeRule.onNodeWithText("Reply").performClick()
        assertTrue(replied)
        composeRule.onNode(hasText("Delete message") and hasClickAction()).performClick()
        composeRule.onNodeWithText(
            "Delete this message? People in this conversation will see that it was deleted.",
        ).assertExists()
        assertTrue(!deleted)
        composeRule.onNode(hasText("Delete message") and hasClickAction()).performClick()
        assertTrue(deleted)
    }

    @Test
    fun reactionPickerSearchesTheSharedCatalog() {
        var reaction: String? = null
        composeRule.setContent {
            FishTheme {
                ChatMessageActionsSheet(
                    message = actionableMessage(),
                    onDismiss = {},
                    onReply = {},
                    onEdit = {},
                    onDelete = {},
                    onReact = { reaction = it },
                    emojiCatalog = ChatMediaCatalog(
                        emojiGroups = listOf(
                            EmojiCatalogGroup(
                                name = "Smileys",
                                slug = "smileys",
                                emojis = listOf(
                                    EmojiCatalogEntry("👍", "thumbs up", "thumbs-up"),
                                ),
                            ),
                        ),
                        stickers = emptyList(),
                    ),
                )
            }
        }

        composeRule.onNode(hasText("Add a reaction") and hasClickAction()).performClick()
        composeRule.onNode(hasSetTextAction()).performTextInput("thumbs")
        composeRule.onNodeWithContentDescription("thumbs up").performClick()

        assertEquals("👍", reaction)
    }

    @Test
    fun longPressOpensActionsWithoutAddingAPersistentControl() {
        var opened = false
        composeRule.setContent {
            FishTheme {
                MessageBubble(
                    message = actionableMessage(),
                    onOpenActions = { opened = true },
                )
            }
        }

        composeRule.onNodeWithContentDescription(
            "You. I practiced this sentence. 10:30 AM",
        ).performTouchInput { longClick() }

        assertTrue(opened)
        composeRule.onAllNodesWithContentDescription("More actions for message")
            .assertCountEquals(0)
    }

    @Test
    fun reactionsAreReachableAndFocusedMessageIsEmphasized() {
        var reaction: String? = null
        composeRule.setContent {
            FishTheme(reducedMotion = true) {
                ChatTranscript(
                    messages = listOf(
                        actionableMessage().copy(
                            reactions = listOf(ReactionUiModel("👍", 2, true)),
                        ),
                    ),
                    pagination = OlderMessagesUiState.Idle,
                    typingParticipantName = null,
                    focusedMessageId = "message-action",
                    onRetryEarlier = {},
                    onToggleReaction = { _, emoji -> reaction = emoji },
                )
            }
        }

        composeRule.onNodeWithTag("focused-message").assertExists()
        composeRule.onNodeWithContentDescription("👍 reaction, 2 people, including you")
            .assertHeightIsAtLeast(48.dp)
            .assertIsSelected()
            .performClick()
        assertEquals("👍", reaction)
    }

    @Test
    fun friendSafetyActionsUseAConfirmationStep() {
        var removed = false
        var dismissed = false
        composeRule.setContent {
            FishTheme {
                ParticipantDetailsSheet(
                    participant = ParticipantUiModel(
                        id = "friend-1",
                        displayName = "Sam",
                        contextLabel = "Personal coaching conversation",
                        username = "sam",
                        friendSafetyAvailable = true,
                    ),
                    presence = PresencePresentation(label = "Online"),
                    onDismiss = { dismissed = true },
                    onRemoveFriend = { removed = true },
                    onBlock = {},
                )
            }
        }

        composeRule.onNodeWithText("@sam").assertExists()
        composeRule.onNodeWithText("Unfriend").performClick()
        composeRule.onNodeWithText(
            "Unfriend Sam? You can add each other again later.",
        ).assertExists()
        assertTrue(!removed)
        composeRule.onNodeWithText("Unfriend").performClick()
        assertTrue(removed)
        assertTrue(dismissed)
    }

    @Composable
    private fun TestChat() {
        FishTheme(reducedMotion = true) {
            ChatAdaptiveLayout(
                model = ChatSamples.loaded,
                composerState = rememberTextFieldState(),
                onSend = {},
                onBack = {},
                onRetryEarlier = {},
                onSelectConversation = {},
            )
        }
    }

    private fun attachment(
        id: String,
        position: Int,
        kind: AttachmentUiKind,
        name: String,
        available: Boolean = true,
    ) = AttachmentUiModel(
        id = id,
        position = position,
        kind = kind,
        available = available,
        name = name,
        mimeType = when (kind) {
            AttachmentUiKind.Photo -> "image/webp"
            AttachmentUiKind.Voice -> "audio/mp4"
            AttachmentUiKind.File -> "application/pdf"
            AttachmentUiKind.Unavailable -> null
        },
        byteSize = 1024L.takeIf { available },
        width = 1200.takeIf { kind == AttachmentUiKind.Photo },
        height = 800.takeIf { kind == AttachmentUiKind.Photo },
        thumbnailUrl = null,
        displayUrl = null,
        contentVersion = "v1",
    )

    private fun localAttachment(
        id: String,
        position: Int,
        photo: Boolean,
        name: String,
    ) = LocalAttachmentUiModel(
        id = id,
        position = position,
        isPhoto = photo,
        inPreview = true,
        name = name,
        mimeType = if (photo) "image/webp" else "application/pdf",
        byteSize = 1024,
        width = 1200.takeIf { photo },
        height = 800.takeIf { photo },
        localPath = "/private/$id",
        thumbnailPath = null,
    )

    private fun actionableMessage() = MessageUiModel(
        id = "message-action",
        senderName = "Franz",
        body = "I practiced this sentence",
        timeLabel = "10:30 AM",
        isOutgoing = true,
        actionsEnabled = true,
        canEdit = true,
        canDelete = true,
    )
}
