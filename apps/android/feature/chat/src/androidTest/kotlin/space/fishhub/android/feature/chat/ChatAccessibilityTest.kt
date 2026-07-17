package space.fishhub.android.feature.chat

import androidx.activity.ComponentActivity
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.core.designsystem.FishTheme
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
}
