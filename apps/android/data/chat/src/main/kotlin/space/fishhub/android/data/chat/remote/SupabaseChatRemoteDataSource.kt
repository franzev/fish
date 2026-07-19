package space.fishhub.android.data.chat.remote

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.ChatReaction
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.OutgoingMessageContent
import space.fishhub.android.data.chat.AttachmentDelivery
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
import io.github.jan.supabase.realtime.broadcast
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.headers
import io.ktor.http.isSuccess
import io.ktor.http.HttpStatusCode
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
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.ConcurrentHashMap

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
    private val typingChannels = ConcurrentHashMap<String, io.github.jan.supabase.realtime.RealtimeChannel>()


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
        val conversationIds = previews.map(ConversationPreviewDto::conversationId).distinct()
        val participantIds = previews.map(ConversationPreviewDto::participantId).distinct()
        val participantProfiles = if (conversationIds.isEmpty()) {
            emptyMap()
        } else {
            client.postgrest.rpc(
                function = "list_conversation_member_profiles",
                parameters = buildJsonObject {
                    put(
                        "p_conversation_ids",
                        JsonArray(conversationIds.map(::JsonPrimitive)),
                    )
                },
            ).decodeList<ConversationMemberProfileDto>()
                .associateBy(ConversationMemberProfileDto::id)
        }
        val avatarUrls = resolveAvatarUrls(participantIds)
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
                participantUsername = participantProfiles[preview.participantId]?.username,
                participantAvatarUrl = avatarUrls[preview.participantId],
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
        val attachmentJoin = loadAttachments(pageRows.map { it.id })
        val reactionsByMessageId = loadReactions(pageRows.map(MessageDto::id))
        val messages = pageRows.mapNotNull {
            val attachments = attachmentJoin.byMessageId[it.id].orEmpty().toMutableList()
            val attachmentOnlyMayBeUnhydrated = attachments.isEmpty() && it.body.isBlank() &&
                it.deletedAt == null && it.stickerId == null && gifsByMessageId[it.id] == null
            if (attachmentOnlyMayBeUnhydrated) {
                attachments += unavailableAttachment("unavailable-${it.id}", 0)
            }
            it.copy(reactions = reactionsByMessageId[it.id].orEmpty()).toDomainOrNull(
                conversation,
                gifsByMessageId[it.id],
                attachments,
                attachmentsHydrated = attachmentJoin.complete && !attachmentOnlyMayBeUnhydrated,
            )
        }.reversed()
        val oldest = messages.firstOrNull()?.let { ChatMessageCursor(it.createdAt, it.id) }
        return MessagePage(messages, hasMore, oldest)
    }

    override suspend fun loadReadStates(conversationId: String): List<ChatReadState> =
        client.from("message_reads").select {
            filter { eq("conversation_id", conversationId) }
        }.decodeList<ReadStateDto>().map { it.toDomain() }

    override suspend fun refreshAttachmentUrls(
        attachmentIds: List<String>,
    ): List<AttachmentDelivery> {
        val ids = attachmentIds.distinct()
        require(ids.isNotEmpty() && ids.size == attachmentIds.size && ids.size <= 50) {
            "Attachment URL requests must contain between one and 50 unique IDs."
        }
        val response = client.functions.invoke(
            function = "chat-image-command",
            body = RefreshAttachmentUrlsRequest(attachmentIds = ids),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw RemoteCommandException(readError(payload, DefaultAttachmentError))
        }
        val decoded = json.decodeFromString(RefreshAttachmentUrlsResponse.serializer(), payload)
        return decoded.attachments.map { row ->
            AttachmentDelivery(
                attachmentId = row.attachmentId,
                thumbnailUrl = row.thumbnailUrl,
                displayUrl = row.displayUrl,
                expiresAt = decoded.expiresAt,
            )
        }
    }

    override suspend fun initializeAttachmentUpload(
        command: InitializeAttachmentUpload,
    ): AttachmentUploadAuthorization {
        val response = client.functions.invoke(
            function = "chat-image-command",
            body = InitializeAttachmentUploadRequest(
                conversationId = command.conversationId,
                clientUploadId = command.clientUploadId,
                originalName = command.originalName,
                sourceMimeType = command.sourceMimeType,
                sourceByteSize = command.sourceByteSize,
                uploadSha256 = command.uploadSha256,
            ),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        response.requireAttachmentSuccess(payload)
        val authorization = json.decodeFromString(
            AttachmentUploadAuthorizationDto.serializer(),
            payload,
        )
        if (authorization.status == "ready") {
            return AttachmentUploadAuthorization(
                attachmentId = authorization.attachmentId,
                status = authorization.status,
                bucket = "",
                objectPath = "",
                uploadToken = "",
                uploadMimeType = "",
                tusEndpoint = "",
                signedUploadUrl = "",
                expiresAt = "",
            )
        }
        return AttachmentUploadAuthorization(
            attachmentId = authorization.attachmentId,
            status = authorization.status,
            bucket = authorization.bucket ?: throw RemoteCommandException(DefaultAttachmentError),
            objectPath = authorization.objectPath ?: throw RemoteCommandException(DefaultAttachmentError),
            uploadToken = authorization.uploadToken ?: throw RemoteCommandException(DefaultAttachmentError),
            uploadMimeType = authorization.uploadMimeType ?: throw RemoteCommandException(DefaultAttachmentError),
            tusEndpoint = authorization.tusEndpoint ?: throw RemoteCommandException(DefaultAttachmentError),
            signedUploadUrl = authorization.signedUploadUrl ?: throw RemoteCommandException(DefaultAttachmentError),
            expiresAt = authorization.expiresAt ?: throw RemoteCommandException(DefaultAttachmentError),
        )
    }

    override suspend fun completeAttachmentUpload(
        attachmentId: String,
    ): CompletedAttachmentUpload {
        val response = client.functions.invoke(
            function = "chat-image-command",
            body = CompleteAttachmentUploadRequest(attachmentId = attachmentId),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        response.requireAttachmentSuccess(payload)
        val completed = json.decodeFromString(
            CompletedAttachmentUploadResponse.serializer(),
            payload,
        ).attachment
        return CompletedAttachmentUpload(completed.id, completed.status)
    }

    override suspend fun cancelAttachmentUpload(attachmentId: String) {
        val response = client.functions.invoke(
            function = "chat-image-command",
            body = CancelAttachmentUploadRequest(attachmentId = attachmentId),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        response.requireAttachmentSuccess(payload)
    }

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
                attachmentIds = content.attachmentIds,
                replyToMessageId = content.replyToMessageId,
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
        val attachmentJoin = if (content.attachmentIds.isEmpty()) {
            AttachmentJoin(emptyMap(), complete = true)
        } else {
            loadAttachments(listOf(row.id))
        }
        val attachments = attachmentJoin.byMessageId[row.id].orEmpty().toMutableList()
        val attachmentsComplete = attachmentJoin.complete &&
            attachments.map(ChatAttachment::id) == content.attachmentIds
        if (!attachmentsComplete && attachments.isEmpty() && content.attachmentIds.isNotEmpty()) {
            content.attachmentIds.forEachIndexed { position, attachmentId ->
                attachments += unavailableAttachment(attachmentId, position)
            }
        }
        return row.toDomainOrNull(
            conversation,
            content.gif?.let { GifJoin(it, unavailable = false) },
            hydratedAttachments = attachments,
            attachmentsHydrated = attachmentsComplete,
        )
            ?: throw RemoteCommandException(DefaultSendError)
    }

    override suspend fun editMessage(
        conversation: AuthorizedConversation,
        messageId: String,
        body: String,
    ): ChatMessage = commandMessage(
        conversation = conversation,
        request = EditMessageRequest(messageId = messageId, body = body.trim()),
    )

    override suspend fun deleteMessage(
        conversation: AuthorizedConversation,
        messageId: String,
    ): ChatMessage = commandMessage(
        conversation = conversation,
        request = DeleteMessageRequest(messageId = messageId),
    )

    override suspend fun setReaction(
        conversation: AuthorizedConversation,
        messageId: String,
        emoji: String,
        active: Boolean,
    ): ChatMessage = commandMessage(
        conversation = conversation,
        request = SetReactionRequest(messageId = messageId, emoji = emoji, active = active),
    )

    override suspend fun sendTyping(conversationId: String, userId: String, typing: Boolean) {
        typingChannels[conversationId]?.broadcast(
            event = "typing",
            message = TypingBroadcastDto(userId = userId, typing = typing),
        )
    }

    override suspend fun removeFriend(userId: String) = friendCommand("remove-friend", userId)

    override suspend fun blockUser(userId: String) = friendCommand("block-user", userId)

    private suspend fun friendCommand(action: String, userId: String) {
        val response = client.functions.invoke(
            function = "friend-command",
            body = FriendCommandRequest(action = action, targetId = userId),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw RemoteCommandException(readError(payload, DefaultFriendError))
        }
    }

    private suspend fun resolveAvatarUrls(profileIds: List<String>): Map<String, String> {
        if (profileIds.isEmpty()) return emptyMap()
        return try {
            val response = client.functions.invoke(
                function = "avatar-command",
                body = ResolveAvatarUrlsRequest(profileIds = profileIds.distinct().take(100)),
                headers = headers {
                    append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                },
            )
            if (!response.status.isSuccess()) return emptyMap()
            json.decodeFromString<ResolveAvatarUrlsResponse>(response.bodyAsText())
                .items
                .associate { item -> item.profileId to normalizeSupabaseUrl(item.url) }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            emptyMap()
        }
    }

    private fun normalizeSupabaseUrl(value: String): String = runCatching {
        val uri = URI(value)
        buildString {
            append(client.supabaseHttpUrl)
            append(uri.rawPath)
            uri.rawQuery?.let { append('?').append(it) }
        }
    }.getOrDefault(value)

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
        val typingChannel = client.channel("conversation:${conversation.conversationId}:typing") {
            broadcast { receiveOwnBroadcasts = false }
        }
        var hasSubscribed = false
        val messageChanges = channel.postgresChangeFlow<PostgresAction>("public") {
            table = "messages"
            filter("conversation_id", FilterOperator.EQ, conversation.conversationId)
        }
        val readChanges = channel.postgresChangeFlow<PostgresAction>("public") {
            table = "message_reads"
            filter("conversation_id", FilterOperator.EQ, conversation.conversationId)
        }
        val reactionChanges = channel.postgresChangeFlow<PostgresAction>("public") {
            table = "message_reactions"
            filter("conversation_id", FilterOperator.EQ, conversation.conversationId)
        }
        val typingChanges = typingChannel.broadcastFlow<TypingBroadcastDto>("typing")
        launch {
            messageChanges.collectLatest { action ->
                val row = (action as? HasRecord)?.decodeRecordOrNull<MessageDto>()
                val refreshed = row?.let { refreshMessage(conversation, it.id) }
                if (refreshed != null) {
                    trySend(ChatRealtimeEvent.MessageChanged(refreshed))
                    return@collectLatest
                }
                val gif = row?.let { loadGifs(listOf(it.id))[it.id] }
                val attachmentJoin = row?.let { loadAttachments(listOf(it.id)) }
                val attachments = row?.let { message ->
                    attachmentJoin?.byMessageId?.get(message.id).orEmpty().toMutableList().apply {
                        if (isEmpty() && message.body.isBlank() &&
                            message.deletedAt == null && message.stickerId == null && gif == null
                        ) add(unavailableAttachment("unavailable-${message.id}", 0))
                    }
                }.orEmpty()
                val attachmentOnlyMayBeUnhydrated = row != null && attachments.size == 1 &&
                    attachments.single().id == "unavailable-${row.id}"
                val message = row?.toDomainOrNull(
                    conversation,
                    gif,
                    attachments,
                    attachmentsHydrated = attachmentJoin?.complete != false &&
                        !attachmentOnlyMayBeUnhydrated,
                )
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
            reactionChanges.collectLatest { action ->
                val messageId = (action as? HasRecord)
                    ?.decodeRecordOrNull<ReactionChangeDto>()
                    ?.messageId
                    ?: return@collectLatest
                refreshMessage(conversation, messageId)?.let { refreshed ->
                    trySend(ChatRealtimeEvent.MessageChanged(refreshed))
                }
            }
        }
        launch {
            typingChanges.collectLatest { payload ->
                if (payload.userId != conversation.currentUserId) {
                    trySend(ChatRealtimeEvent.TypingChanged(payload.typing))
                }
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
        typingChannel.subscribe(blockUntilSubscribed = true)
        typingChannels[conversation.conversationId] = typingChannel
        awaitClose {
            typingChannels.remove(conversation.conversationId, typingChannel)
            scope.launch {
                client.realtime.removeChannel(channel)
                client.realtime.removeChannel(typingChannel)
            }
        }
    }

    private suspend inline fun <reified T : Any> commandMessage(
        conversation: AuthorizedConversation,
        request: T,
    ): ChatMessage {
        val response = client.functions.invoke(
            function = "chat-command",
            body = request,
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw RemoteCommandException(readError(payload, DefaultCommandError))
        }
        val element = json.parseToJsonElement(payload).jsonObject["message"]
            ?: throw RemoteCommandException(DefaultCommandError)
        val row = json.decodeFromJsonElement(MessageDto.serializer(), element)
        return hydrateMessage(conversation, row)
            ?: throw RemoteCommandException(DefaultCommandError)
    }

    override suspend fun refreshMessages(
        conversation: AuthorizedConversation,
        messageIds: List<String>,
    ): List<ChatMessage> {
        if (messageIds.isEmpty()) return emptyList()
        val response = client.functions.invoke(
            function = "chat-command",
            body = RefreshMessagesRequest(messageIds = messageIds.distinct().take(50)),
            headers = headers {
                append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            },
        )
        val payload = response.bodyAsText()
        if (!response.status.isSuccess()) {
            throw RemoteCommandException(readError(payload, DefaultCommandError))
        }
        val rows = json.parseToJsonElement(payload).jsonObject["messages"] as? JsonArray
            ?: return emptyList()
        return rows.mapNotNull { element ->
            val row = json.decodeFromJsonElement(MessageDto.serializer(), element)
            hydrateMessage(conversation, row)
        }
    }

    private suspend fun refreshMessage(
        conversation: AuthorizedConversation,
        messageId: String,
    ): ChatMessage? = runCatching {
        refreshMessages(conversation, listOf(messageId)).firstOrNull()
    }.getOrNull()

    private suspend fun hydrateMessage(
        conversation: AuthorizedConversation,
        row: MessageDto,
    ): ChatMessage? {
        val gif = loadGifs(listOf(row.id))[row.id]
        val attachmentJoin = loadAttachments(listOf(row.id))
        return row.toDomainOrNull(
            conversation = conversation,
            gifJoin = gif,
            hydratedAttachments = attachmentJoin.byMessageId[row.id].orEmpty(),
            attachmentsHydrated = attachmentJoin.complete,
        )
    }

    private suspend fun loadReactions(messageIds: List<String>): Map<String, List<ReactionDto>> {
        if (messageIds.isEmpty()) return emptyMap()
        return try {
            messageIds.chunked(50).flatMap { batch ->
                client.postgrest.rpc(
                    function = "list_message_reaction_summaries",
                    parameters = buildJsonObject {
                        put("p_message_ids", JsonArray(batch.map(::JsonPrimitive)))
                    },
                ).decodeList<ReactionSummaryDto>()
            }.groupBy(ReactionSummaryDto::messageId)
                .mapValues { (_, rows) ->
                    rows.map { row -> ReactionDto(row.emoji, row.count, row.byMe) }
                }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            emptyMap()
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

    private suspend fun loadAttachments(messageIds: List<String>): AttachmentJoin {
        if (messageIds.isEmpty()) return AttachmentJoin(emptyMap(), complete = true)
        return try {
            val rows = client.from("message_attachments").select {
                filter {
                    isIn("message_id", messageIds)
                    eq("status", "ready")
                }
                order("position", Order.ASCENDING)
            }.decodeList<JsonObject>()
            var complete = true
            val parsed = rows.mapIndexedNotNull { index, payload ->
                runCatching {
                    json.decodeFromJsonElement(MessageAttachmentDto.serializer(), payload)
                }.getOrNull() ?: run {
                    complete = false
                    val messageId = payload["message_id"]?.jsonPrimitive?.contentOrNull
                        ?: return@mapIndexedNotNull null
                    MessageAttachmentDto(
                        id = payload["id"]?.jsonPrimitive?.contentOrNull,
                        messageId = messageId,
                        position = index,
                    )
                }
            }
            val ids = parsed.mapNotNull(MessageAttachmentDto::id).distinct()
            val deliveryById = if (ids.isEmpty()) {
                emptyMap()
            } else {
                try {
                    refreshAttachmentUrls(ids).associateBy(AttachmentDelivery::attachmentId)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Throwable) {
                    emptyMap()
                }
            }
            val byMessage = parsed.mapIndexedNotNull { index, row ->
                val messageId = row.messageId ?: run {
                    complete = false
                    return@mapIndexedNotNull null
                }
                val attachment = row.toDomain(
                    fallbackId = "unavailable-$messageId-$index",
                    fallbackPosition = index,
                    delivery = row.id?.let(deliveryById::get),
                )
                messageId to attachment
            }.groupBy({ it.first }, { it.second }).mapValues { (_, value) ->
                value.sortedWith(compareBy(ChatAttachment::position, ChatAttachment::id))
            }
            AttachmentJoin(byMessage, complete = complete)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            // The message row remains visible. Bodyless rows receive an explicit
            // unavailable placeholder rather than disappearing from the transcript.
            AttachmentJoin(emptyMap(), complete = false)
        }
    }

    private fun MessageDto.toDomainOrNull(
        conversation: AuthorizedConversation,
        gifJoin: GifJoin? = null,
        hydratedAttachments: List<ChatAttachment>? = null,
        attachmentsHydrated: Boolean = true,
    ): ChatMessage? {
        val attachmentModels = hydratedAttachments ?: attachments.mapIndexed { index, row ->
                row.toDomain(
                    fallbackId = "unavailable-$id-$index",
                    fallbackPosition = index,
                    delivery = AttachmentDelivery(
                        attachmentId = row.id.orEmpty(),
                        thumbnailUrl = row.thumbnailUrl,
                        displayUrl = row.displayUrl,
                        expiresAt = null,
                    ),
                )
            }.sortedWith(compareBy(ChatAttachment::position, ChatAttachment::id))
        if (
            body.isBlank() && deletedAt == null && stickerId == null && gifJoin == null &&
            attachmentModels.isEmpty()
        ) return null
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
            attachments = attachmentModels,
            attachmentsHydrated = attachmentsHydrated,
            clientRequestId = clientRequestId,
            createdAt = createdAt,
            editedAt = editedAt,
            deletedAt = deletedAt,
            replyToMessageId = replyToMessageId,
            reactions = reactions.map { ChatReaction(it.emoji, it.count, it.byMe) },
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

    private fun io.ktor.client.statement.HttpResponse.requireAttachmentSuccess(payload: String) {
        if (status.isSuccess()) return
        val root = runCatching { json.parseToJsonElement(payload).jsonObject }.getOrNull()
        val code = root?.get("code")?.jsonPrimitive?.contentOrNull ?: "upload_unavailable"
        val message = root?.get("error")?.jsonPrimitive?.contentOrNull
            ?: "That attachment did not finish yet. Try again."
        val retryAfter = parseRetryAfterSeconds(headers[HttpHeaders.RetryAfter])
        throw AttachmentCommandException(code, status.value, message, retryAfter)
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
        const val DefaultReportError = "That GIF report did not send yet. Try again."
        const val DefaultCommandError = "That did not save yet. Keep this open and try again."
        const val DefaultFriendError = "Friends is taking a break. Chat still works."
        const val DefaultAttachmentError = "That attachment did not load yet. Try again."
    }
}

internal fun parseRetryAfterSeconds(value: String?, now: Instant = Instant.now()): Long? {
    value?.trim()?.toLongOrNull()?.takeIf { it >= 0 }?.let { return it }
    val target = value?.let {
        runCatching { ZonedDateTime.parse(it, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant() }
            .getOrNull()
    } ?: return null
    val remaining = Duration.between(now, target)
    if (remaining.isNegative || remaining.isZero) return 0
    return remaining.seconds + if (remaining.nano > 0) 1 else 0
}

private data class GifJoin(
    val gif: ChatGif?,
    val unavailable: Boolean,
)

private data class AttachmentJoin(
    val byMessageId: Map<String, List<ChatAttachment>>,
    val complete: Boolean,
)

internal fun MessageAttachmentDto.toDomain(
    fallbackId: String,
    fallbackPosition: Int,
    delivery: AttachmentDelivery?,
): ChatAttachment {
    val safeId = id?.takeIf(String::isNotBlank) ?: fallbackId
    val safePosition = position?.takeIf { it in 0..4 } ?: fallbackPosition
    val safeName = originalName?.trim()?.takeIf { it.isNotBlank() && it.length <= 255 }
        ?: "Attachment"
    val safeKind = when (kind) {
        "image" -> ChatAttachmentKind.Image
        "file" -> ChatAttachmentKind.File
        else -> ChatAttachmentKind.Unavailable
    }
    val allowedMime = when (safeKind) {
        ChatAttachmentKind.Image -> storedMimeType == "image/webp"
        ChatAttachmentKind.File -> storedMimeType in SupportedDocumentMimes
        ChatAttachmentKind.Unavailable -> false
    }
    val sizeValid = storedByteSize != null && storedByteSize in 1..MaxStoredAttachmentBytes
    val dimensionsValid = when (safeKind) {
        ChatAttachmentKind.Image -> width != null && height != null &&
            width in 1..MaxImageEdge && height in 1..MaxImageEdge
        ChatAttachmentKind.File -> width == null && height == null && thumbnailPath == null
        ChatAttachmentKind.Unavailable -> false
    }
    val pathsValid = !displayPath.isNullOrBlank() && when (safeKind) {
        ChatAttachmentKind.Image -> !thumbnailPath.isNullOrBlank()
        ChatAttachmentKind.File -> true
        ChatAttachmentKind.Unavailable -> false
    }
    val isAvailable = status == "ready" && safeKind != ChatAttachmentKind.Unavailable &&
        allowedMime && sizeValid && dimensionsValid && pathsValid
    return ChatAttachment(
        id = safeId,
        position = safePosition,
        kind = if (isAvailable) safeKind else ChatAttachmentKind.Unavailable,
        available = isAvailable,
        originalName = safeName,
        mimeType = storedMimeType,
        byteSize = storedByteSize,
        width = width,
        height = height,
        thumbnailPath = thumbnailPath,
        displayPath = displayPath,
        thumbnailUrl = delivery?.thumbnailUrl,
        displayUrl = delivery?.displayUrl,
    )
}

private fun unavailableAttachment(id: String, position: Int): ChatAttachment = ChatAttachment(
    id = id,
    position = position,
    kind = ChatAttachmentKind.Unavailable,
    available = false,
    originalName = "Attachment",
)

private val SupportedDocumentMimes = setOf(
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
)
private const val MaxStoredAttachmentBytes = 10L * 1024L * 1024L
private const val MaxImageEdge = 4096
