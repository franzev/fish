package space.fishhub.android.data.chat

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.UserRole
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import android.net.Uri
import space.fishhub.android.data.chat.model.LocalAttachmentDraft

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

data class AuthorizedChatIdentity(
    val userId: String,
    val role: UserRole,
    val displayName: String,
)

data class AuthorizedChatDirectory(
    val currentUser: AuthorizedChatIdentity,
    val conversations: List<AuthorizedConversation>,
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

/** Ephemeral delivery credentials. These values are never persisted in Room. */
data class AttachmentDelivery(
    val attachmentId: String,
    val thumbnailUrl: String?,
    val displayUrl: String?,
    val expiresAt: String?,
)

enum class AttachmentImportKind { Image, File }

/** The URI is consumed immediately and is never persisted. */
data class AttachmentImportSource(
    val uri: Uri,
    val kind: AttachmentImportKind,
)

data class AttachmentImportIssue(
    val name: String?,
    val message: String,
)

data class AttachmentImportResult(
    val importedCount: Int,
    val issues: List<AttachmentImportIssue> = emptyList(),
) {
    val message: String?
        get() = when {
            issues.isEmpty() -> null
            importedCount == 0 -> issues.first().message
            else -> "Some items were not added. ${issues.first().message}"
        }
}

data class OutgoingMessageContent(
    val body: String,
    val gif: ChatGif? = null,
    val stickerId: String? = null,
    val attachmentIds: List<String> = emptyList(),
    val replyToMessageId: String? = null,
) {
    init {
        require(body.isNotBlank() || gif != null || !stickerId.isNullOrBlank() || attachmentIds.isNotEmpty()) {
            "Outgoing message content cannot be empty."
        }
        require(gif == null || stickerId == null) {
            "A GIF and sticker cannot be sent together."
        }
        require(attachmentIds.size <= 5 && attachmentIds.distinct().size == attachmentIds.size) {
            "Outgoing attachments must contain at most five unique IDs."
        }
        require((gif == null && stickerId == null) || attachmentIds.isEmpty()) {
            "Attachments cannot be combined with a GIF or sticker."
        }
    }

    val normalizedBody: String get() = body.trim()
}

data class GifSearchItem(
    val chatGif: ChatGif,
    val animatedPreviewUrl: String,
)

data class GifPage(
    val items: List<GifSearchItem>,
    val nextCursor: String?,
)

interface GifRepository {
    val available: Boolean

    suspend fun trending(cursor: String? = null, limit: Int = 12): GifPage
    suspend fun search(query: String, cursor: String? = null, limit: Int = 12): GifPage
    suspend fun registerShare(gif: ChatGif, query: String? = null)
}

sealed interface ChatRealtimeEvent {
    data object Connecting : ChatRealtimeEvent
    data object Connected : ChatRealtimeEvent
    data object Disconnected : ChatRealtimeEvent
    data object ConversationUnavailable : ChatRealtimeEvent
    data class MessageChanged(val message: ChatMessage) : ChatRealtimeEvent
    data class ReadStateChanged(val readState: ChatReadState) : ChatRealtimeEvent
    data class TypingChanged(val typing: Boolean) : ChatRealtimeEvent
}

interface ChatRepository {
    val authState: StateFlow<ChatAuthState>

    fun observeMessages(conversationId: String): Flow<List<ChatMessage>>
    fun observeReadStates(conversationId: String): Flow<List<ChatReadState>>
    fun observeDraft(conversationId: String): Flow<String>
    fun observeAttachmentDrafts(conversationId: String): Flow<List<LocalAttachmentDraft>>
    fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent>

    suspend fun signIn(email: String, password: String): ChatResult<Unit>
    suspend fun signOut()
    suspend fun listAuthorizedConversations(): ChatResult<AuthorizedChatDirectory>
    suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot>
    suspend fun loadOlder(
        conversationId: String,
        cursor: ChatMessageCursor,
    ): ChatResult<MessagePage>
    suspend fun refreshAttachmentUrls(attachmentIds: List<String>): ChatResult<List<AttachmentDelivery>>
    suspend fun sendMessage(
        conversationId: String,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatResult<ChatMessage>
    suspend fun editMessage(messageId: String, body: String): ChatResult<ChatMessage>
    suspend fun deleteMessage(messageId: String): ChatResult<ChatMessage>
    suspend fun toggleReaction(messageId: String, emoji: String): ChatResult<ChatMessage>
    suspend fun sendTyping(conversationId: String, typing: Boolean)
    suspend fun reportGif(messageId: String): ChatResult<Unit>
    suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState>
    suspend fun saveDraft(conversationId: String, draft: String)
    suspend fun importAttachments(
        conversationId: String,
        sources: List<AttachmentImportSource>,
    ): AttachmentImportResult
    suspend fun commitAttachmentPreview(conversationId: String)
    suspend fun discardAttachmentPreview(conversationId: String)
    suspend fun removeAttachmentDraft(conversationId: String, attachmentId: String)
    suspend fun retryAttachmentDraft(conversationId: String, attachmentId: String)
    suspend fun clearCachedUserData()
}
