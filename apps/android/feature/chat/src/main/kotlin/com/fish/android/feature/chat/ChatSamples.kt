package com.fish.android.feature.chat

import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.fish.android.core.designsystem.FishTheme

object ChatSamples {
    val loaded = ChatUiModel(
        screenState = ChatScreenState.Available,
        participant = ParticipantUiModel(
            id = "coach-1",
            displayName = "Coach Jordan",
            contextLabel = "Your English coach",
        ),
        selectedConversationId = "conversation-1",
        conversations = listOf(
            ConversationPreviewUiModel(
                conversationId = "conversation-1",
                participantName = "Coach Jordan",
                snippet = "Try the final sentence once more.",
                timeLabel = "10:42",
                unreadCount = 0,
            ),
            ConversationPreviewUiModel(
                conversationId = "conversation-2",
                participantName = "Mina Santos",
                snippet = "I practiced before the meeting.",
                timeLabel = "Yesterday",
                unreadCount = 2,
            ),
        ),
        messages = listOf(
            MessageUiModel(
                id = "m1",
                senderName = "Coach Jordan",
                body = "Good morning. How did the presentation practice feel?",
                timeLabel = "10:36",
                isOutgoing = false,
                dateLabel = "Today",
                groupedWithNext = true,
            ),
            MessageUiModel(
                id = "m2",
                senderName = "Coach Jordan",
                body = "You can send the opening sentence when you are ready.",
                timeLabel = "10:37",
                isOutgoing = false,
                groupedWithPrevious = true,
            ),
            MessageUiModel(
                id = "m3",
                senderName = "Franz",
                body = "I felt calmer today. My opening was: Thank you for joining. I will walk you through the main findings.",
                timeLabel = "10:40",
                isOutgoing = true,
                delivery = MessageDeliveryUiState.Read,
                startsUnread = true,
            ),
            MessageUiModel(
                id = "m4",
                senderName = "Coach Jordan",
                body = "Clear and professional. Try the final sentence once more, a little more slowly.",
                timeLabel = "10:42",
                isOutgoing = false,
            ),
        ),
    )

    val loading = ChatUiModel(screenState = ChatScreenState.Loading)
    val unavailable = ChatUiModel(
        screenState = ChatScreenState.Unavailable,
        hasPreviousDestination = true,
    )
    val offline = loaded.copy(connection = ChatConnectionUiState.Offline)
    val failed = loaded.copy(
        messages = loaded.messages + MessageUiModel(
            id = "failed",
            senderName = "Franz",
            body = "I will practice that before our next session.",
            timeLabel = "10:44",
            isOutgoing = true,
            delivery = MessageDeliveryUiState.Failed,
        ),
    )
}

@Preview(name = "Personal chat light", showBackground = true)
@Composable
private fun ChatLightPreview() {
    FishTheme(darkTheme = false) {
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

@Preview(name = "Personal chat dark", showBackground = true)
@Composable
private fun ChatDarkPreview() {
    FishTheme(darkTheme = true) {
        ChatAdaptiveLayout(
            model = ChatSamples.offline,
            composerState = rememberTextFieldState("I can keep this draft here."),
            onSend = {},
            onBack = {},
            onRetryEarlier = {},
            onSelectConversation = {},
        )
    }
}
