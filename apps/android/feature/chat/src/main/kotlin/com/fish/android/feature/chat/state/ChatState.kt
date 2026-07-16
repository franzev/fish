@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package com.fish.android.feature.chat.state

import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatMessageCursor
import com.fish.android.data.chat.model.ChatReadState
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

@Serializable
enum class OutgoingMessageStatus {
    @SerialName("sent") Sent,
    @SerialName("delivered") Delivered,
    @SerialName("read") Read,
}

@Serializable
enum class RealtimeConnectionStatus {
    @SerialName("idle") Idle,
    @SerialName("connecting") Connecting,
    @SerialName("connected") Connected,
    @SerialName("disconnected") Disconnected,
}

@Serializable
data class ChatComposerState(
    val draft: String = "",
    val replyTargetId: String? = null,
    val editTargetId: String? = null,
)

@Serializable
data class ChatPaginationState(
    val oldestLoadedCursor: ChatMessageCursor? = null,
    val hasMoreOlder: Boolean = false,
    val isLoadingOlder: Boolean = false,
    val hasLoadError: Boolean = false,
)

@Serializable
data class ChatRealtimeState(
    val status: RealtimeConnectionStatus = RealtimeConnectionStatus.Idle,
)

@Serializable
data class ChatConversationState(
    val conversationId: String,
    val messages: List<ChatMessage> = emptyList(),
    val readStates: List<ChatReadState> = emptyList(),
    val composer: ChatComposerState = ChatComposerState(),
    val realtime: ChatRealtimeState = ChatRealtimeState(),
    val pagination: ChatPaginationState = ChatPaginationState(),
)

@Serializable
data class ChatState(
    val conversations: Map<String, ChatConversationState> = emptyMap(),
)

@Serializable
data class UnreadMessageSummary(
    val count: Int,
    val oldestUnreadAt: String?,
    val latestUnreadMessageId: String?,
)

@Serializable
data class ReplyPreview(
    val id: String,
    val authorName: String,
    val snippet: String,
)

@Serializable
@JsonClassDiscriminator("type")
sealed interface ChatEvent {
    @Serializable
    @SerialName("hydrateConversation")
    data class HydrateConversation(
        val conversationId: String,
        val messages: List<ChatMessage>,
        val readStates: List<ChatReadState>,
    ) : ChatEvent

    @Serializable
    @SerialName("draftChanged")
    data class DraftChanged(val conversationId: String, val draft: String) : ChatEvent

    @Serializable
    @SerialName("sendOptimisticMessage")
    data class SendOptimisticMessage(val message: ChatMessage) : ChatEvent

    @Serializable
    @SerialName("confirmSentMessage")
    data class ConfirmSentMessage(
        val message: ChatMessage,
        val localRequestId: String? = null,
    ) : ChatEvent

    @Serializable
    @SerialName("markMessageFailed")
    data class MarkMessageFailed(
        val conversationId: String,
        val clientRequestId: String,
        val reason: String? = null,
    ) : ChatEvent

    @Serializable
    @SerialName("mergeRemoteMessage")
    data class MergeRemoteMessage(
        val message: ChatMessage,
        val localRequestId: String? = null,
    ) : ChatEvent

    @Serializable
    @SerialName("mergeReadState")
    data class MergeReadState(
        val conversationId: String,
        val readState: ChatReadState,
    ) : ChatEvent

    @Serializable
    @SerialName("setReplyTarget")
    data class SetReplyTarget(val conversationId: String, val messageId: String?) : ChatEvent

    @Serializable
    @SerialName("setEditTarget")
    data class SetEditTarget(val conversationId: String, val messageId: String?) : ChatEvent

    @Serializable
    @SerialName("setRealtimeStatus")
    data class SetRealtimeStatus(
        val conversationId: String,
        val status: RealtimeConnectionStatus,
    ) : ChatEvent

    @Serializable
    @SerialName("clearComposer")
    data class ClearComposer(val conversationId: String) : ChatEvent

    @Serializable
    @SerialName("hydrateWindow")
    data class HydrateWindow(
        val conversationId: String,
        val messages: List<ChatMessage>,
        val readStates: List<ChatReadState>,
        val hasMoreOlder: Boolean,
        val oldestCursor: ChatMessageCursor?,
    ) : ChatEvent

    @Serializable
    @SerialName("olderMessagesRequested")
    data class OlderMessagesRequested(val conversationId: String) : ChatEvent

    @Serializable
    @SerialName("olderPageLoaded")
    data class OlderPageLoaded(
        val conversationId: String,
        val messages: List<ChatMessage>,
        val hasMoreOlder: Boolean,
        val oldestCursor: ChatMessageCursor?,
    ) : ChatEvent

    @Serializable
    @SerialName("olderPageLoadFailed")
    data class OlderPageLoadFailed(val conversationId: String) : ChatEvent
}
