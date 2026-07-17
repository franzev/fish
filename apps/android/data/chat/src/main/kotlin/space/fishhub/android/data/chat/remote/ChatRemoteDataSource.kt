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
    suspend fun loadReadStates(conversationId: String): List<ChatReadState>
    suspend fun sendMessage(
        conversation: AuthorizedConversation,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatMessage
    suspend fun reportGif(messageId: String)
    suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatReadState
    fun realtime(conversation: AuthorizedConversation): Flow<ChatRealtimeEvent>
}

internal class RemoteCommandException(message: String) : IllegalStateException(message)
