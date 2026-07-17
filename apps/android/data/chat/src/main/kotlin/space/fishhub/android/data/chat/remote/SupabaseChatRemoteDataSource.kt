package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.OutgoingMessageContent
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.HasRecord
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.decodeRecordOrNull
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.headers
import io.ktor.http.isSuccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI

internal class SupabaseChatRemoteDataSource(
    private val client: SupabaseClient,
    private val scope: CoroutineScope,
    private val onBeforeSignOut: suspend () -> Unit = {},
) : ChatRemoteDataSource {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
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
        onBeforeSignOut()
        client.auth.signOut()
    }

    override suspend fun listAuthorizedConversations(): AuthorizedChatDirectory {
        val user = checkNotNull(client.auth.currentUserOrNull())
        val profile = client.from("profiles").select {
            filter { eq("id", user.id) }
            limit(1)
        }.decodeSingle<ProfileDto>()
        val previews = client.postgrest.rpc("list_direct_conversation_previews")
            .decodeList<ConversationPreviewDto>()
        val currentRole = profile.role.toRoleOrNull()
            ?: throw IllegalStateException("Unknown current user role")
        val conversations = previews.mapNotNull { preview ->
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
        return AuthorizedChatDirectory(
            currentUser = AuthorizedChatIdentity(
                userId = profile.id,
                role = currentRole,
                displayName = profile.displayName,
            ),
            conversations = conversations,
        )
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
        val pageRows = rows.take(PageSize)
        val gifsByMessageId = loadGifs(pageRows.map { it.id })
        val messages = pageRows.mapNotNull {
            it.toDomainOrNull(conversation, gifsByMessageId[it.id])
        }.reversed()
        val oldest = messages.firstOrNull()?.let { ChatMessageCursor(it.createdAt, it.id) }
        return MessagePage(messages, hasMore, oldest)
    }

    override suspend fun loadReadStates(conversationId: String): List<ChatReadState> =
        client.from("message_reads").select {
            filter { eq("conversation_id", conversationId) }
        }.decodeList<ReadStateDto>().map { it.toDomain() }

    override suspend fun sendMessage(
        conversation: AuthorizedConversation,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatMessage {
        val response = client.functions.invoke(
            function = "send-message",
            body = SendMessageRequest(
                conversationId = conversation.conversationId,
                body = content.normalizedBody,
                clientRequestId = clientRequestId,
                gif = content.gif,
                stickerId = content.stickerId,
            ),
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
        return row.toDomainOrNull(conversation, GifJoin(content.gif, unavailable = false))
            ?: throw RemoteCommandException(DefaultSendError)
    }

    override suspend fun reportGif(messageId: String) {
        val response = client.functions.invoke(
            function = "chat-command",
            body = ReportGifRequest(messageId = messageId),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw RemoteCommandException(readError(payload, DefaultReportError))
        }
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
                val gif = row?.let { loadGifs(listOf(it.id))[it.id] }
                val message = row?.toDomainOrNull(conversation, gif)
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

    private suspend fun loadGifs(messageIds: List<String>): Map<String, GifJoin> {
        if (messageIds.isEmpty()) return emptyMap()
        return try {
            client.from("message_gifs").select {
                filter { isIn("message_id", messageIds) }
            }.decodeList<JsonObject>().mapNotNull { payload ->
                val messageId = (payload["message_id"] as? JsonPrimitive)?.contentOrNull
                    ?: return@mapNotNull null
                val row = runCatching {
                    json.decodeFromJsonElement(MessageGifDto.serializer(), payload)
                }.getOrNull()
                val gif = row?.toDomainOrNull()
                messageId to GifJoin(gif = gif, unavailable = gif == null)
            }.toMap()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            // A malformed or temporarily unavailable provider join must not
            // hide the underlying chat messages.
            emptyMap()
        }
    }

    private fun MessageDto.toDomainOrNull(
        conversation: AuthorizedConversation,
        gifJoin: GifJoin? = null,
    ): ChatMessage? {
        if (body.isBlank() && deletedAt == null && stickerId == null && gifJoin == null) return null
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
            gif = gifJoin?.gif,
            gifUnavailable = gifJoin?.unavailable == true,
            stickerId = stickerId,
            clientRequestId = clientRequestId,
            createdAt = createdAt,
            editedAt = editedAt,
            deletedAt = deletedAt,
            replyToMessageId = replyToMessageId,
            localStatus = LocalMessageStatus.Sent,
        )
    }

    private fun MessageGifDto.toDomainOrNull(): ChatGif? {
        if (provider !in setOf("klipy", "giphy")) return null
        if (providerId.isBlank() || providerId.length > 200) return null
        if (title.isBlank() || title.length > 300) return null
        if (description.isBlank() || description.length > 500) return null
        if (width !in 1..4096 || height !in 1..4096) return null
        if (!validSourceUrl(provider, sourceUrl)) return null
        if (!listOf(posterUrl, previewUrl, mediaUrl).all { validMediaUrl(provider, it) }) return null
        return ChatGif(
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
    }

    private fun validSourceUrl(provider: String, value: String): Boolean {
        val host = httpsHost(value) ?: return false
        return when (provider) {
            "klipy" -> host == "klipy.com" || host.endsWith(".klipy.com")
            "giphy" -> host == "giphy.com" || host.endsWith(".giphy.com")
            else -> false
        }
    }

    private fun validMediaUrl(provider: String, value: String): Boolean {
        val host = httpsHost(value) ?: return false
        return when (provider) {
            "klipy" -> Regex("^static\\d*\\.klipy\\.com$").matches(host)
            "giphy" -> Regex("^media\\d*\\.giphy\\.com$").matches(host)
            else -> false
        }
    }

    private fun httpsHost(value: String): String? = runCatching {
        URI(value).takeIf { it.scheme == "https" && !it.host.isNullOrBlank() }?.host?.lowercase()
    }.getOrNull()

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
        const val DefaultReportError = "That GIF report did not send yet. Try again."
    }
}

private data class GifJoin(
    val gif: ChatGif?,
    val unavailable: Boolean,
)
