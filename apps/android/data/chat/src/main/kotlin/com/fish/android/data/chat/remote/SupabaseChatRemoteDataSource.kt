package com.fish.android.data.chat.remote

import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatMessageCursor
import com.fish.android.data.chat.model.ChatReadState
import com.fish.android.data.chat.model.LocalMessageStatus
import com.fish.android.data.chat.model.UserRole
import com.fish.android.data.chat.AuthorizedConversation
import com.fish.android.data.chat.ChatAuthState
import com.fish.android.data.chat.ChatRealtimeEvent
import com.fish.android.data.chat.MessagePage
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.logging.LogLevel
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.HasRecord
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.decodeRecordOrNull
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.serializer.KotlinXSerializer
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.headers
import io.ktor.http.isSuccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Duration.Companion.seconds

internal class SupabaseChatRemoteDataSource(
    supabaseUrl: String,
    publishableKey: String,
    private val scope: CoroutineScope,
) : ChatRemoteDataSource {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }
    private val client: SupabaseClient = createSupabaseClient(supabaseUrl, publishableKey) {
        defaultLogLevel = LogLevel.NONE
        defaultSerializer = KotlinXSerializer(json)
        install(Auth)
        install(Postgrest) {
            requireValidSession = true
        }
        install(Functions) {
            requireValidSession = true
        }
        install(Realtime) {
            requireValidSession = true
            reconnectDelay = 5.seconds
        }
    }

    override val authState = client.auth.sessionStatus
        .map { status ->
            when (status) {
                SessionStatus.Initializing -> ChatAuthState.Loading
                is SessionStatus.Authenticated -> {
                    val user = status.session.user
                    ChatAuthState.SignedIn(userId = checkNotNull(user?.id), email = user.email)
                }
                is SessionStatus.NotAuthenticated,
                is SessionStatus.RefreshFailure,
                -> ChatAuthState.SignedOut
            }
        }
        .stateIn(scope, SharingStarted.Eagerly, ChatAuthState.Loading)

    override suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
    }

    override suspend fun signOut() {
        client.auth.signOut()
    }

    override suspend fun listAuthorizedConversations(): List<AuthorizedConversation> {
        val user = checkNotNull(client.auth.currentUserOrNull())
        val profile = client.from("profiles").select {
            filter { eq("id", user.id) }
            limit(1)
        }.decodeSingle<ProfileDto>()
        val previews = client.postgrest.rpc("list_direct_conversation_previews")
            .decodeList<ConversationPreviewDto>()
        return previews.mapNotNull { preview ->
            val currentRole = profile.role.toRoleOrNull() ?: return@mapNotNull null
            val participantRole = preview.participantRole.toRoleOrNull() ?: return@mapNotNull null
            AuthorizedConversation(
                conversationId = preview.conversationId,
                currentUserId = profile.id,
                currentUserRole = currentRole,
                currentUserDisplayName = profile.displayName,
                participantId = preview.participantId,
                participantRole = participantRole,
                participantDisplayName = preview.participantDisplayName,
                latestMessageText = preview.latestMessageText,
                latestMessageCreatedAt = preview.latestMessageCreatedAt,
                unreadCount = preview.unreadCount,
            )
        }
    }

    override suspend fun loadMessages(
        conversation: AuthorizedConversation,
        cursor: ChatMessageCursor?,
    ): MessagePage {
        val rows = client.from("messages").select {
            filter {
                eq("conversation_id", conversation.conversationId)
                if (cursor != null) {
                    or {
                        lt("created_at", cursor.createdAt)
                        and {
                            eq("created_at", cursor.createdAt)
                            lt("id", cursor.id)
                        }
                    }
                }
            }
            order("created_at", Order.DESCENDING)
            order("id", Order.DESCENDING)
            range(0, PageSize.toLong())
        }.decodeList<MessageDto>()
        val hasMore = rows.size > PageSize
        val messages = rows.take(PageSize).mapNotNull { it.toDomainOrNull(conversation) }.reversed()
        val oldest = messages.firstOrNull()?.let { ChatMessageCursor(it.createdAt, it.id) }
        return MessagePage(messages, hasMore, oldest)
    }

    override suspend fun loadReadStates(conversationId: String): List<ChatReadState> =
        client.from("message_reads").select {
            filter { eq("conversation_id", conversationId) }
        }.decodeList<ReadStateDto>().map { it.toDomain() }

    override suspend fun sendMessage(
        conversation: AuthorizedConversation,
        body: String,
        clientRequestId: String,
    ): ChatMessage {
        val response = client.functions.invoke(
            function = "send-message",
            body = SendMessageRequest(conversation.conversationId, body, clientRequestId),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) throw RemoteCommandException(readError(payload, DefaultSendError))
        val root = json.parseToJsonElement(payload).jsonObject
        val messageElement = root["message"] ?: throw RemoteCommandException(DefaultSendError)
        val normalized = if (messageElement is JsonArray) messageElement.firstOrNull() else messageElement
        val row = normalized?.let { json.decodeFromJsonElement(MessageDto.serializer(), it) }
            ?: throw RemoteCommandException(DefaultSendError)
        return row.toDomainOrNull(conversation) ?: throw RemoteCommandException(DefaultSendError)
    }

    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatReadState {
        val response = client.functions.invoke(
            function = "chat-command",
            body = MarkReadRequest(
                conversationId = conversationId,
                lastDeliveredMessageId = lastDeliveredMessageId,
                lastReadMessageId = lastReadMessageId,
            ),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) throw RemoteCommandException(readError(payload, DefaultReadError))
        val element = json.parseToJsonElement(payload).jsonObject["readState"]
            ?: throw RemoteCommandException(DefaultReadError)
        return json.decodeFromJsonElement(ReadStateDto.serializer(), element).toDomain()
    }

    override fun realtime(conversation: AuthorizedConversation): Flow<ChatRealtimeEvent> = callbackFlow {
        trySend(ChatRealtimeEvent.Connecting)
        val channel = client.channel("conversation:${conversation.conversationId}:android")
        var hasSubscribed = false
        val messageChanges = channel.postgresChangeFlow<PostgresAction>("public") {
            table = "messages"
            filter("conversation_id", FilterOperator.EQ, conversation.conversationId)
        }
        val readChanges = channel.postgresChangeFlow<PostgresAction>("public") {
            table = "message_reads"
            filter("conversation_id", FilterOperator.EQ, conversation.conversationId)
        }
        launch {
            messageChanges.collectLatest { action ->
                val row = (action as? HasRecord)?.decodeRecordOrNull<MessageDto>()
                val message = row?.toDomainOrNull(conversation)
                if (message != null) trySend(ChatRealtimeEvent.MessageChanged(message))
            }
        }
        launch {
            readChanges.collectLatest { action ->
                val row = (action as? HasRecord)?.decodeRecordOrNull<ReadStateDto>()
                if (row != null) trySend(ChatRealtimeEvent.ReadStateChanged(row.toDomain()))
            }
        }
        launch {
            channel.status.collectLatest { status ->
                when (status) {
                    io.github.jan.supabase.realtime.RealtimeChannel.Status.SUBSCRIBED -> {
                        hasSubscribed = true
                        trySend(ChatRealtimeEvent.Connected)
                    }
                    io.github.jan.supabase.realtime.RealtimeChannel.Status.SUBSCRIBING ->
                        trySend(ChatRealtimeEvent.Connecting)
                    io.github.jan.supabase.realtime.RealtimeChannel.Status.UNSUBSCRIBED -> {
                        if (hasSubscribed) {
                            trySend(ChatRealtimeEvent.Disconnected)
                            close()
                        }
                    }
                    else -> Unit
                }
            }
        }
        channel.subscribe(blockUntilSubscribed = true)
        awaitClose {
            scope.launch { client.realtime.removeChannel(channel) }
        }
    }

    private fun MessageDto.toDomainOrNull(conversation: AuthorizedConversation): ChatMessage? {
        if (body.isBlank() && deletedAt == null) return null
        return ChatMessage(
            id = id,
            conversationId = conversationId,
            senderId = senderId,
            senderRole = senderRole.toRoleOrNull() ?: conversation.participantRole,
            senderDisplayName = if (senderId == conversation.currentUserId) {
                conversation.currentUserDisplayName
            } else {
                conversation.participantDisplayName
            },
            body = body,
            clientRequestId = clientRequestId,
            createdAt = createdAt,
            editedAt = editedAt,
            deletedAt = deletedAt,
            replyToMessageId = replyToMessageId,
            localStatus = LocalMessageStatus.Sent,
        )
    }

    private fun ReadStateDto.toDomain(): ChatReadState = ChatReadState(
        userId = userId,
        lastDeliveredMessageId = lastDeliveredMessageId,
        deliveredAt = deliveredAt,
        lastReadMessageId = lastReadMessageId,
        readAt = readAt,
    )

    private fun readError(payload: String, fallback: String): String = runCatching {
        json.parseToJsonElement(payload).jsonObject["error"]?.jsonPrimitive?.content
    }.getOrNull() ?: fallback

    private fun String.toRoleOrNull(): UserRole? = when (this) {
        "client" -> UserRole.Client
        "coach" -> UserRole.Coach
        else -> null
    }

    private companion object {
        const val PageSize = 40
        const val DefaultSendError = "That did not send yet. Keep this open and try again."
        const val DefaultReadError = "Your read position did not update yet. Your messages are still here."
    }
}
