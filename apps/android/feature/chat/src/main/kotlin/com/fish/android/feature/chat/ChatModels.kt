package com.fish.android.feature.chat

import androidx.compose.runtime.Immutable

@Immutable
data class ChatUiModel(
    val screenState: ChatScreenState,
    val participant: ParticipantUiModel? = null,
    val messages: List<MessageUiModel> = emptyList(),
    val conversations: List<ConversationPreviewUiModel> = emptyList(),
    val selectedConversationId: String? = null,
    val connection: ChatConnectionUiState = ChatConnectionUiState.Connected,
    val pagination: OlderMessagesUiState = OlderMessagesUiState.Idle,
    val typingParticipantName: String? = null,
    val hasPreviousDestination: Boolean = false,
    val isSending: Boolean = false,
    val notice: String? = null,
)

enum class ChatScreenState { Loading, Available, Unavailable }

@Immutable
data class ParticipantUiModel(
    val id: String,
    val displayName: String,
    val contextLabel: String,
)

@Immutable
data class ConversationPreviewUiModel(
    val conversationId: String,
    val participantName: String,
    val snippet: String,
    val timeLabel: String,
    val unreadCount: Int,
)

@Immutable
data class MessageUiModel(
    val id: String,
    val senderName: String,
    val body: String,
    val timeLabel: String,
    val isOutgoing: Boolean,
    val delivery: MessageDeliveryUiState? = null,
    val groupedWithPrevious: Boolean = false,
    val groupedWithNext: Boolean = false,
    val dateLabel: String? = null,
    val startsUnread: Boolean = false,
    val deleted: Boolean = false,
)

enum class MessageDeliveryUiState { Sending, Sent, Delivered, Read, Failed }
enum class ChatConnectionUiState { Connected, Connecting, Reconnecting, Offline }
enum class OlderMessagesUiState { Idle, Loading, Failed }

sealed interface ChatRouteUiState {
    data object Loading : ChatRouteUiState
    data class SignedOut(
        val email: String = "",
        val password: String = "",
        val submitting: Boolean = false,
        val notice: String? = null,
    ) : ChatRouteUiState
    data class Conversation(
        val model: ChatUiModel,
        val draft: String,
        val notice: String? = null,
    ) : ChatRouteUiState
    data class ConversationList(
        val conversations: List<ConversationPreviewUiModel>,
        val selectedConversationId: String?,
        val notice: String? = null,
    ) : ChatRouteUiState
}
