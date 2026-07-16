package com.fish.android.data.chat

import com.fish.android.data.chat.model.ChatMessage
import com.fish.android.data.chat.model.ChatMessageCursor
import com.fish.android.data.chat.model.ChatReadState
import com.fish.android.data.chat.model.LocalMessageStatus
import com.fish.android.data.chat.AuthorizedConversation
import com.fish.android.data.chat.ChatAuthState
import com.fish.android.data.chat.ChatRealtimeEvent
import com.fish.android.data.chat.ChatRepository
import com.fish.android.data.chat.ChatResult
import com.fish.android.data.chat.ConversationSnapshot
import com.fish.android.data.chat.FailureCategory
import com.fish.android.data.chat.MessagePage
import com.fish.android.data.chat.remote.ChatRemoteDataSource
import com.fish.android.data.chat.remote.RemoteCommandException
import com.fish.android.data.chat.local.ChatDao
import com.fish.android.data.chat.local.DraftEntity
import com.fish.android.data.chat.local.toDomain
import com.fish.android.data.chat.local.toEntity
import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.RestException
import io.ktor.client.plugins.HttpRequestTimeoutException
import java.time.Instant
import kotlin.time.TimeSource
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
internal class DefaultChatRepository(
    private val remote: ChatRemoteDataSource,
    private val dao: ChatDao,
    private val now: () -> String = { Instant.now().toString() },
    private val diagnostics: ChatDiagnostics = NoOpChatDiagnostics,
    private val realtimeRetryDelayMs: Long = DefaultRealtimeRetryDelayMs,
    private val networkMonitor: NetworkMonitor = AlwaysOnlineNetworkMonitor,
) : ChatRepository {
    override val authState = remote.authState

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> =
        dao.observeMessages(conversationId).map { rows -> rows.map { it.toDomain() } }

    override fun observeReadStates(conversationId: String): Flow<List<ChatReadState>> =
        dao.observeReadStates(conversationId).map { rows -> rows.map { it.toDomain() } }

    override fun observeDraft(conversationId: String): Flow<String> =
        authState.flatMapLatest { auth ->
            if (auth is ChatAuthState.SignedIn) {
                dao.observeDraft(conversationId, auth.userId).map { it.orEmpty() }
            } else {
                flowOf("")
            }
        }

    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> = flow {
        val conversation = dao.conversation(conversationId)?.toDomain()
        if (conversation == null) {
            emit(ChatRealtimeEvent.Disconnected)
            return@flow
        }
        emitAll(
            networkMonitor.isOnline()
                .flatMapLatest { online ->
                    if (online) observeConnectedRealtime(conversation) else flowOf(ChatRealtimeEvent.Disconnected)
                },
        )
    }

    private fun observeConnectedRealtime(
        conversation: AuthorizedConversation,
    ): Flow<ChatRealtimeEvent> = flow {
        while (true) {
            currentCoroutineContext().ensureActive()
            try {
                remote.realtime(conversation).collect { event ->
                    when (event) {
                        is ChatRealtimeEvent.MessageChanged ->
                            dao.reconcileMessage(event.message.toEntity())
                        is ChatRealtimeEvent.ReadStateChanged ->
                            dao.upsertReadStates(
                                listOf(event.readState.toEntity(conversation.conversationId)),
                            )
                        ChatRealtimeEvent.Connected -> reconnectBackfill(conversation)
                        else -> Unit
                    }
                    emit(event)
                }
            } catch (_: ConversationUnavailableException) {
                emit(ChatRealtimeEvent.ConversationUnavailable)
                return@flow
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                diagnostics.record(
                    ChatDiagnosticEvent(
                        operation = ChatOperation.Realtime,
                        succeeded = false,
                        durationMs = 0,
                        failureCategory = FailureCategory.Network,
                    ),
                )
            }
            emit(ChatRealtimeEvent.Disconnected)
            delay(realtimeRetryDelayMs)
        }
    }

    override suspend fun signIn(email: String, password: String): ChatResult<Unit> =
        resultOf(ChatOperation.SignIn, "Sign-in did not finish. Check your connection and try again.") {
            remote.signIn(email, password)
        }

    override suspend fun signOut() {
        try {
            remote.signOut()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            // Local data must still be cleared if the remote session is already unavailable.
        }
        dao.clearAllUserData()
    }

    override suspend fun listAuthorizedConversations(): ChatResult<List<AuthorizedConversation>> {
        val remoteResult = resultOf(
            ChatOperation.ListConversations,
            "Could not load your conversations. Try again.",
        ) {
            remote.listAuthorizedConversations().also { conversations ->
                conversations.forEach { dao.upsertConversation(it.toEntity()) }
            }
        }
        if (remoteResult is ChatResult.Success) return remoteResult

        val userId = (authState.value as? ChatAuthState.SignedIn)?.userId
        val cached = userId?.let { dao.conversations(it).map { row -> row.toDomain() } }.orEmpty()
        return if (cached.isNotEmpty()) ChatResult.Success(cached) else remoteResult
    }

    override suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot> =
        resultOf(
            ChatOperation.SyncNewest,
            "Could not refresh this conversation. Your saved messages are still here.",
        ) {
            val conversation = remote.listAuthorizedConversations()
                .firstOrNull { it.conversationId == conversationId }
                ?: throw ConversationUnavailableException()
            val page = remote.loadMessages(conversation)
            val readStates = remote.loadReadStates(conversationId)
            dao.upsertConversation(conversation.toEntity())
            dao.reconcileMessages(page.messages.map { it.toEntity() })
            dao.upsertReadStates(readStates.map { it.toEntity(conversationId) })
            ConversationSnapshot(
                conversation = conversation,
                messages = page.messages,
                readStates = readStates,
                hasMoreOlder = page.hasMoreOlder,
                oldestCursor = page.oldestCursor,
            )
        }

    override suspend fun loadOlder(
        conversationId: String,
        cursor: ChatMessageCursor,
    ): ChatResult<MessagePage> = resultOf(
        ChatOperation.LoadOlder,
        "Earlier messages did not load. Try again.",
    ) {
        val conversation = dao.conversation(conversationId)?.toDomain()
            ?: throw ConversationUnavailableException()
        remote.loadMessages(conversation, cursor).also { page ->
            dao.reconcileMessages(page.messages.map { it.toEntity() })
        }
    }

    override suspend fun sendMessage(
        conversationId: String,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatResult<ChatMessage> {
        val conversation = dao.conversation(conversationId)?.toDomain()
            ?: return unavailableFailure()
        val optimistic = ChatMessage(
            id = "local-$clientRequestId",
            conversationId = conversationId,
            senderId = conversation.currentUserId,
            senderRole = conversation.currentUserRole,
            senderDisplayName = conversation.currentUserDisplayName,
            body = content.normalizedBody,
            gif = content.gif,
            stickerId = content.stickerId,
            clientRequestId = clientRequestId,
            createdAt = now(),
            localStatus = LocalMessageStatus.Sending,
        )
        dao.reconcileMessage(optimistic.toEntity())
        return when (val result = resultOf(
            ChatOperation.SendMessage,
            "That did not send yet. Keep this open and try again.",
        ) {
            remote.sendMessage(conversation, content, clientRequestId)
        }) {
            is ChatResult.Success -> {
                val enriched = result.value.copy(
                    gif = result.value.gif ?: content.gif,
                    stickerId = result.value.stickerId ?: content.stickerId,
                )
                dao.reconcileMessage(enriched.toEntity())
                ChatResult.Success(enriched)
            }
            is ChatResult.Failure -> {
                dao.markMessageFailed(conversationId, clientRequestId, result.message)
                result
            }
        }
    }

    override suspend fun reportGif(messageId: String): ChatResult<Unit> = resultOf(
        ChatOperation.ReportGif,
        "That GIF report did not send yet. Try again.",
    ) {
        remote.reportGif(messageId)
    }

    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState> = resultOf(
        ChatOperation.MarkRead,
        "Your read position did not update yet. Your messages are still here.",
    ) {
        remote.markRead(conversationId, lastDeliveredMessageId, lastReadMessageId).also {
            dao.upsertReadStates(listOf(it.toEntity(conversationId)))
        }
    }

    override suspend fun saveDraft(conversationId: String, draft: String) {
        val userId = (authState.value as? ChatAuthState.SignedIn)?.userId ?: return
        if (dao.conversation(conversationId)?.currentUserId != userId) return
        dao.upsertDraft(DraftEntity(conversationId, userId, draft, now()))
    }

    override suspend fun clearCachedUserData() {
        dao.clearAllUserData()
    }

    private suspend fun reconnectBackfill(conversation: AuthorizedConversation) {
        val started = TimeSource.Monotonic.markNow()
        try {
            val refreshedConversation = remote.listAuthorizedConversations()
                .firstOrNull { it.conversationId == conversation.conversationId }
            if (refreshedConversation == null) {
                dao.deleteConversationData(conversation.conversationId)
                throw ConversationUnavailableException()
            }
            val page = remote.loadMessages(refreshedConversation)
            val reads = remote.loadReadStates(refreshedConversation.conversationId)
            dao.upsertConversation(refreshedConversation.toEntity())
            dao.reconcileMessages(page.messages.map { it.toEntity() })
            dao.upsertReadStates(reads.map { it.toEntity(refreshedConversation.conversationId) })
            diagnostics.record(
                ChatDiagnosticEvent(
                    ChatOperation.ReconnectBackfill,
                    true,
                    started.elapsedNow().inWholeMilliseconds,
                ),
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (unavailable: ConversationUnavailableException) {
            diagnostics.record(
                ChatDiagnosticEvent(
                    ChatOperation.ReconnectBackfill,
                    false,
                    started.elapsedNow().inWholeMilliseconds,
                    FailureCategory.Authorization,
                ),
            )
            throw unavailable
        } catch (_: Throwable) {
            diagnostics.record(
                ChatDiagnosticEvent(
                    ChatOperation.ReconnectBackfill,
                    false,
                    started.elapsedNow().inWholeMilliseconds,
                    FailureCategory.Network,
                ),
            )
        }
    }

    private suspend fun <T> resultOf(
        operation: ChatOperation,
        fallback: String,
        block: suspend () -> T,
    ): ChatResult<T> {
        val started = TimeSource.Monotonic.markNow()
        return try {
            ChatResult.Success(block()).also {
                diagnostics.record(
                    ChatDiagnosticEvent(operation, true, started.elapsedNow().inWholeMilliseconds),
                )
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            val category = when (error) {
                is ConversationUnavailableException -> FailureCategory.Authorization
                is HttpRequestException,
                is HttpRequestTimeoutException,
                is java.io.IOException,
                -> FailureCategory.Network
                is RestException -> FailureCategory.Remote
                else -> FailureCategory.Local
            }
            ChatResult.Failure(
                message = (error as? RemoteCommandException)?.message ?: when (error) {
                    is ConversationUnavailableException -> "This conversation isn't available."
                    else -> fallback
                },
                recoverable = category != FailureCategory.Authorization,
                category = category,
            ).also {
                diagnostics.record(
                    ChatDiagnosticEvent(
                        operation,
                        false,
                        started.elapsedNow().inWholeMilliseconds,
                        category,
                    ),
                )
            }
        }
    }

    private fun unavailableFailure(): ChatResult.Failure = ChatResult.Failure(
        message = "This conversation isn't available.",
        recoverable = false,
        category = FailureCategory.Authorization,
    )
}

private class ConversationUnavailableException : IllegalStateException()

private const val DefaultRealtimeRetryDelayMs = 5_000L
