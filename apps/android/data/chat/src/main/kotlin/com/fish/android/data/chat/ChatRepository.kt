package com.fish.android.data.chat

import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatMessageCursor
import com.fish.android.data.chat.model.ChatReadState
import com.fish.android.data.chat.model.UserRole
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

sealed interface ChatResult<out T> {
    data class Success<T>(val value: T) : ChatResult<T>
    data class Failure(
        val message: String,
        val recoverable: Boolean,
        val category: FailureCategory,
    ) : ChatResult<Nothing>
}

enum class FailureCategory { Authentication, Authorization, Network, Remote, Local, Configuration }

sealed interface ChatAuthState {
    data object Loading : ChatAuthState
    data object SignedOut : ChatAuthState
    data class SignedIn(val userId: String, val email: String?) : ChatAuthState
}

data class AuthorizedConversation(
    val conversationId: String,
    val currentUserId: String,
    val currentUserRole: UserRole,
    val currentUserDisplayName: String,
    val participantId: String,
    val participantRole: UserRole,
    val participantDisplayName: String,
    val latestMessageText: String?,
    val latestMessageCreatedAt: String?,
    val unreadCount: Int,
)

data class ConversationSnapshot(
    val conversation: AuthorizedConversation,
    val messages: List<ChatMessage>,
    val readStates: List<ChatReadState>,
    val hasMoreOlder: Boolean,
    val oldestCursor: ChatMessageCursor?,
)

data class MessagePage(
    val messages: List<ChatMessage>,
    val hasMoreOlder: Boolean,
    val oldestCursor: ChatMessageCursor?,
)

sealed interface ChatRealtimeEvent {
    data object Connecting : ChatRealtimeEvent
    data object Connected : ChatRealtimeEvent
    data object Disconnected : ChatRealtimeEvent
    data object ConversationUnavailable : ChatRealtimeEvent
    data class MessageChanged(val message: ChatMessage) : ChatRealtimeEvent
    data class ReadStateChanged(val readState: ChatReadState) : ChatRealtimeEvent
}

interface ChatRepository {
    val authState: StateFlow<ChatAuthState>

    fun observeMessages(conversationId: String): Flow<List<ChatMessage>>
    fun observeReadStates(conversationId: String): Flow<List<ChatReadState>>
    fun observeDraft(conversationId: String): Flow<String>
    fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent>

    suspend fun signIn(email: String, password: String): ChatResult<Unit>
    suspend fun signOut()
    suspend fun listAuthorizedConversations(): ChatResult<List<AuthorizedConversation>>
    suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot>
    suspend fun loadOlder(
        conversationId: String,
        cursor: ChatMessageCursor,
    ): ChatResult<MessagePage>
    suspend fun sendMessage(
        conversationId: String,
        body: String,
        clientRequestId: String,
    ): ChatResult<ChatMessage>
    suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState>
    suspend fun saveDraft(conversationId: String, draft: String)
    suspend fun clearCachedUserData()
}
