package space.fishhub.android.feature.chat

import androidx.compose.runtime.Immutable
import space.fishhub.android.data.chat.model.ChatGif

@Immutable
data class ChatUiModel(
    val screenState: ChatScreenState,
    val currentUserDisplayName: String = "",
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
    val gif: GifUiModel? = null,
    val sticker: StickerUiModel? = null,
    val gifPlaying: Boolean = false,
    val gifUnavailable: Boolean = false,
)

@Immutable
data class GifUiModel(
    val provider: String,
    val providerId: String,
    val title: String,
    val description: String,
    val sourceUrl: String,
    val posterUrl: String,
    val previewUrl: String,
    val mediaUrl: String,
    val width: Int,
    val height: Int,
) {
    fun toChatGif(): ChatGif = ChatGif(
        provider = provider,
        providerId = providerId,
        title = title,
        description = description,
        sourceUrl = sourceUrl,
        posterUrl = posterUrl,
        previewUrl = previewUrl,
        mediaUrl = mediaUrl,
        width = width,
        height = height,
    )

    companion object {
        fun from(gif: ChatGif): GifUiModel = GifUiModel(
            provider = gif.provider,
            providerId = gif.providerId,
            title = gif.title,
            description = gif.description,
            sourceUrl = gif.sourceUrl,
            posterUrl = gif.posterUrl,
            previewUrl = gif.previewUrl,
            mediaUrl = gif.mediaUrl,
            width = gif.width,
            height = gif.height,
        )
    }
}

@Immutable
data class StickerUiModel(
    val id: String,
    val phrase: String,
    val description: String,
    val assetPath: String?,
) {
    val available: Boolean get() = assetPath != null
}

@Immutable
sealed interface ComposerMediaUiModel {
    @Immutable
    data class Gif(val value: GifUiModel) : ComposerMediaUiModel

    @Immutable
    data class Sticker(val value: StickerUiModel) : ComposerMediaUiModel
}

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
        val pendingMedia: ComposerMediaUiModel? = null,
        val pendingGifQuery: String = "",
        val notice: String? = null,
    ) : ChatRouteUiState
    data class ConversationList(
        val currentUserDisplayName: String = "",
        val conversations: List<ConversationPreviewUiModel>,
        val selectedConversationId: String?,
        val notice: String? = null,
    ) : ChatRouteUiState
}
