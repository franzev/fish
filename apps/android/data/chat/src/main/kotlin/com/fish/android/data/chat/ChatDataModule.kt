package com.fish.android.data.chat

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.room.Room
import com.fish.android.data.chat.ChatAuthState
import com.fish.android.data.chat.ChatRealtimeEvent
import com.fish.android.data.chat.ChatRepository
import com.fish.android.data.chat.ChatResult
import com.fish.android.data.chat.ConversationSnapshot
import com.fish.android.data.chat.FailureCategory
import com.fish.android.data.chat.MessagePage
import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatMessageCursor
import com.fish.android.data.chat.model.ChatReadState
import com.fish.android.data.chat.AuthorizedConversation
import com.fish.android.data.chat.remote.SupabaseChatRemoteDataSource
import com.fish.android.data.chat.local.ChatDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf

object ChatDataModule {
    fun create(
        context: Context,
        supabaseUrl: String,
        publishableKey: String,
    ): ChatRepository {
        if (supabaseUrl.isBlank() || publishableKey.isBlank()) {
            return UnconfiguredChatRepository
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val database = Room.databaseBuilder(
            context.applicationContext,
            ChatDatabase::class.java,
            "fish-personal-chat.db",
        ).build()
        val remote = SupabaseChatRemoteDataSource(supabaseUrl, publishableKey, scope)
        val networkMonitor = AndroidNetworkMonitor(context.applicationContext, scope)
        val diagnostics = if (
            context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        ) {
            RedactedLogcatChatDiagnostics
        } else {
            NoOpChatDiagnostics
        }
        return DefaultChatRepository(
            remote,
            database.chatDao(),
            diagnostics = diagnostics,
            networkMonitor = networkMonitor,
        )
    }
}

private object UnconfiguredChatRepository : ChatRepository {
    override val authState: StateFlow<ChatAuthState> = MutableStateFlow(ChatAuthState.SignedOut)
    private val failure = ChatResult.Failure(
        message = "This build is not connected yet. Add the Supabase URL and publishable key.",
        recoverable = false,
        category = FailureCategory.Configuration,
    )

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = flowOf(emptyList())
    override fun observeReadStates(conversationId: String): Flow<List<ChatReadState>> = flowOf(emptyList())
    override fun observeDraft(conversationId: String): Flow<String> = flowOf("")
    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> =
        flowOf(ChatRealtimeEvent.Disconnected)
    override suspend fun signIn(email: String, password: String): ChatResult<Unit> = failure
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations(): ChatResult<List<AuthorizedConversation>> = failure
    override suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot> = failure
    override suspend fun loadOlder(conversationId: String, cursor: ChatMessageCursor): ChatResult<MessagePage> = failure
    override suspend fun sendMessage(conversationId: String, body: String, clientRequestId: String): ChatResult<ChatMessage> = failure
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState> = failure
    override suspend fun saveDraft(conversationId: String, draft: String) = Unit
    override suspend fun clearCachedUserData() = Unit
}
