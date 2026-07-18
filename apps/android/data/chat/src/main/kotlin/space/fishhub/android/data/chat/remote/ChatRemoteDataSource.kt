package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.AttachmentDelivery
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

internal interface ChatRemoteDataSource {
    val authState: StateFlow<ChatAuthState>

    suspend fun signIn(email: String, password: String)
    suspend fun signOut()
    suspend fun listAuthorizedConversations(): AuthorizedChatDirectory
    suspend fun loadMessages(
        conversation: AuthorizedConversation,
        cursor: ChatMessageCursor? = null,
    ): MessagePage
    suspend fun refreshMessages(
        conversation: AuthorizedConversation,
        messageIds: List<String>,
    ): List<ChatMessage> = emptyList()
    suspend fun loadReadStates(conversationId: String): List<ChatReadState>
    suspend fun refreshAttachmentUrls(attachmentIds: List<String>): List<AttachmentDelivery>
    suspend fun initializeAttachmentUpload(command: InitializeAttachmentUpload): AttachmentUploadAuthorization
    suspend fun completeAttachmentUpload(attachmentId: String): CompletedAttachmentUpload
    suspend fun cancelAttachmentUpload(attachmentId: String)
    suspend fun sendMessage(
        conversation: AuthorizedConversation,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatMessage
    suspend fun editMessage(
        conversation: AuthorizedConversation,
        messageId: String,
        body: String,
    ): ChatMessage = error("Message editing is not configured.")
    suspend fun deleteMessage(
        conversation: AuthorizedConversation,
        messageId: String,
    ): ChatMessage = error("Message deletion is not configured.")
    suspend fun toggleReaction(
        conversation: AuthorizedConversation,
        messageId: String,
        emoji: String,
    ): ChatMessage = error("Message reactions are not configured.")
    suspend fun sendTyping(conversationId: String, userId: String, typing: Boolean) = Unit
    suspend fun removeFriend(userId: String): Unit = error("Friend commands are not configured.")
    suspend fun blockUser(userId: String): Unit = error("Friend commands are not configured.")
    suspend fun reportGif(messageId: String)
    suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatReadState
    fun realtime(conversation: AuthorizedConversation): Flow<ChatRealtimeEvent>
}

internal class RemoteCommandException(message: String) : IllegalStateException(message)

internal data class InitializeAttachmentUpload(
    val conversationId: String,
    val clientUploadId: String,
    val originalName: String,
    val sourceMimeType: String,
    val sourceByteSize: Long,
    val uploadSha256: String,
)

internal data class AttachmentUploadAuthorization(
    val attachmentId: String,
    val bucket: String,
    val objectPath: String,
    val uploadToken: String,
    val uploadMimeType: String,
    val tusEndpoint: String,
    val signedUploadUrl: String,
    val expiresAt: String,
    val status: String = "pending",
)

internal data class CompletedAttachmentUpload(
    val attachmentId: String,
    val status: String,
)

internal class AttachmentCommandException(
    val code: String,
    val statusCode: Int,
    override val message: String,
    val retryAfterSeconds: Long? = null,
) : IllegalStateException(message)
