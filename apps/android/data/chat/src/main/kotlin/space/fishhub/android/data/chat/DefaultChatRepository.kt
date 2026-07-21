package space.fishhub.android.data.chat

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.ConversationSnapshot
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.remote.ChatRemoteDataSource
import space.fishhub.android.data.chat.remote.RemoteCommandException
import space.fishhub.android.data.chat.local.ChatDao
import space.fishhub.android.data.chat.local.DraftEntity
import space.fishhub.android.data.chat.local.toDomain
import space.fishhub.android.data.chat.local.toEntity
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import space.fishhub.android.data.chat.local.AttachmentDraftEntity
import space.fishhub.android.data.chat.local.toDomain
import space.fishhub.android.data.chat.model.LocalAttachmentDraft

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
internal class DefaultChatRepository(
    private val remote: ChatRemoteDataSource,
    private val dao: ChatDao,
    private val now: () -> String = { Instant.now().toString() },
    private val diagnostics: ChatDiagnostics = NoOpChatDiagnostics,
    private val realtimeRetryDelayMs: Long = DefaultRealtimeRetryDelayMs,
    private val networkMonitor: NetworkMonitor = AlwaysOnlineNetworkMonitor,
    private val attachmentImporter: LocalAttachmentImporter? = null,
    private val attachmentUploadScheduler: AttachmentUploadScheduler? = null,
) : ChatRepository {
    override val authState = remote.authState
    private val attachmentDeliveries = MutableStateFlow<Map<String, AttachmentDelivery>>(emptyMap())
    private val attachmentDraftMutex = Mutex()

    override fun observeMessages(conversationId: String): Flow<List<ChatMessage>> =
        combine(
            dao.observeMessages(conversationId),
            dao.observeMessageAttachments(conversationId),
            attachmentDeliveries,
        ) { rows, attachments, deliveries ->
            val byMessage = attachments.groupBy { it.messageId }
            rows.map { row -> row.toDomain(byMessage[row.id].orEmpty(), deliveries) }
        }

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

    override fun observeAttachmentDrafts(conversationId: String): Flow<List<LocalAttachmentDraft>> =
        authState.flatMapLatest { auth ->
            val userId = (auth as? ChatAuthState.SignedIn)?.userId
            if (userId == null) flowOf(emptyList()) else {
                dao.observeAttachmentDrafts(conversationId, userId).map { rows ->
                    rows.map(AttachmentDraftEntity::toDomain)
                }
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
                            reconcileMessage(event.message)
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
        val attachmentRows = dao.allAttachmentDrafts()
        val signedInUserId = (authState.value as? ChatAuthState.SignedIn)?.userId
        if (signedInUserId != null) attachmentUploadScheduler?.cancelUser(signedInUserId)
        attachmentRows.forEach { row ->
            attachmentUploadScheduler?.cancel(row.id)
            row.serverAttachmentId?.let { runCatching { remote.cancelAttachmentUpload(it) } }
        }
        try {
            remote.signOut()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            // Local data must still be cleared if the remote session is already unavailable.
        }
        attachmentImporter?.deleteAll(attachmentRows)
        dao.clearAllUserData()
        attachmentDeliveries.value = emptyMap()
    }

    override suspend fun listAuthorizedConversations(): ChatResult<AuthorizedChatDirectory> {
        val remoteResult = resultOf(
            ChatOperation.ListConversations,
            "Could not load your conversations. Try again.",
        ) {
            remote.listAuthorizedConversations().also { directory ->
                directory.conversations.forEach { dao.upsertConversation(it.toEntity()) }
            }
        }
        if (remoteResult is ChatResult.Success) return remoteResult

        val userId = (authState.value as? ChatAuthState.SignedIn)?.userId
        val cached = userId?.let { dao.conversations(it).map { row -> row.toDomain() } }.orEmpty()
        return if (cached.isNotEmpty()) {
            val first = cached.first()
            ChatResult.Success(
                AuthorizedChatDirectory(
                    currentUser = AuthorizedChatIdentity(
                        first.currentUserId,
                        first.currentUserRole,
                        first.currentUserDisplayName,
                    ),
                    conversations = cached,
                ),
            )
        } else remoteResult
    }

    override suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot> =
        resultOf(
            ChatOperation.RefreshAttachmentUrls,
            "Could not refresh this conversation. Your saved messages are still here.",
        ) {
            val conversation = remote.listAuthorizedConversations().conversations
                .firstOrNull { it.conversationId == conversationId }
                ?: throw ConversationUnavailableException()
            val page = remote.loadMessages(conversation)
            val readStates = remote.loadReadStates(conversationId)
            dao.upsertConversation(conversation.toEntity())
            reconcileMessages(page.messages)
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
            reconcileMessages(page.messages)
        }
    }

    override suspend fun refreshMessages(
        conversationId: String,
        messageIds: List<String>,
    ): ChatResult<List<ChatMessage>> {
        val uniqueIds = messageIds.distinct().take(MaxRefreshMessageCount)
        if (uniqueIds.isEmpty()) return ChatResult.Success(emptyList())
        val conversation = dao.conversation(conversationId)?.toDomain()
            ?: return unavailableFailure()
        return resultOf(
            ChatOperation.RefreshMessages,
            "That message did not load yet. Try again.",
        ) {
            remote.refreshMessages(conversation, uniqueIds).also { reconcileMessages(it) }
        }
    }

    override suspend fun searchMessages(
        conversationId: String,
        query: String,
        cursor: MessageSearchCursor?,
        limit: Int,
    ): ChatResult<MessageSearchPage> {
        val trimmedQuery = query.trim()
        if (trimmedQuery.isBlank()) {
            return ChatResult.Failure(
                message = "Search needs a word or phrase.",
                recoverable = false,
                category = FailureCategory.Local,
            )
        }
        val conversation = dao.conversation(conversationId)?.toDomain()
            ?: return unavailableFailure()
        return resultOf(
            ChatOperation.SearchMessages,
            "Search is taking a little longer. Check your connection and try again.",
        ) {
            remote.searchMessages(
                conversation = conversation,
                query = trimmedQuery,
                cursor = cursor,
                limit = limit.coerceIn(1, MaxSearchPageSize),
            )
        }
    }

    override suspend fun refreshAttachmentUrls(
        attachmentIds: List<String>,
    ): ChatResult<List<AttachmentDelivery>> {
        if (attachmentIds.isEmpty()) return ChatResult.Success(emptyList())
        return resultOf(
            ChatOperation.SyncNewest,
            "That attachment did not load yet. Try again.",
        ) {
            remote.refreshAttachmentUrls(attachmentIds).also(::cacheDeliveries)
        }
    }

    override suspend fun sendMessage(
        conversationId: String,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatResult<ChatMessage> {
        val conversation = dao.conversation(conversationId)?.toDomain()
            ?: return unavailableFailure()
        val attachmentDrafts = dao.composerAttachmentDrafts(
            conversationId,
            conversation.currentUserId,
        )
        val orderedReadyIds = attachmentDrafts
            .filter { it.transferState == AttachmentStateReady }
            .mapNotNull { it.serverAttachmentId }
        if ((attachmentDrafts.isNotEmpty() || content.attachmentIds.isNotEmpty()) &&
            (content.attachmentIds != orderedReadyIds ||
                attachmentDrafts.any { it.transferState != AttachmentStateReady })
        ) {
            return ChatResult.Failure(
                "Wait for each attachment to finish, or remove the one that needs attention.",
                recoverable = true,
                category = FailureCategory.Local,
            )
        }
        val optimisticAttachments = attachmentDrafts.mapNotNull { row ->
            val serverId = row.serverAttachmentId ?: return@mapNotNull null
            ChatAttachment(
                id = serverId,
                position = row.position,
                kind = if (row.kind == "image") ChatAttachmentKind.Image else ChatAttachmentKind.File,
                originalName = row.displayName,
                mimeType = row.storedMimeType,
                byteSize = row.byteSize,
                width = row.width,
                height = row.height,
                thumbnailUrl = row.thumbnailPath,
                displayUrl = row.localPath,
            )
        }
        val optimistic = ChatMessage(
            id = "local-$clientRequestId",
            conversationId = conversationId,
            senderId = conversation.currentUserId,
            senderRole = conversation.currentUserRole,
            senderDisplayName = conversation.currentUserDisplayName,
            body = content.normalizedBody,
            gif = content.gif,
            stickerId = content.stickerId,
            attachments = optimisticAttachments,
            clientRequestId = clientRequestId,
            createdAt = now(),
            replyToMessageId = content.replyToMessageId,
            localStatus = LocalMessageStatus.Sending,
        )
        reconcileMessage(optimistic)
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
                    attachments = if (result.value.attachmentsHydrated) {
                        result.value.attachments
                    } else {
                        optimisticAttachments
                    },
                )
                reconcileMessage(enriched)
                ChatResult.Success(enriched)
            }
            is ChatResult.Failure -> {
                dao.markMessageFailed(conversationId, clientRequestId, result.message)
                result
            }
        }
    }

    override suspend fun editMessage(messageId: String, body: String): ChatResult<ChatMessage> {
        val conversation = conversationForMessage(messageId) ?: return unavailableFailure()
        return resultOf(
            ChatOperation.EditMessage,
            "That edit did not save yet. Keep this open and try again.",
        ) {
            remote.editMessage(conversation, messageId, body.trim()).also { reconcileMessage(it) }
        }
    }

    override suspend fun deleteMessage(messageId: String): ChatResult<ChatMessage> {
        val conversation = conversationForMessage(messageId) ?: return unavailableFailure()
        return resultOf(
            ChatOperation.DeleteMessage,
            "That message was not deleted yet. Keep this open and try again.",
        ) {
            remote.deleteMessage(conversation, messageId).also { reconcileMessage(it) }
        }
    }

    override suspend fun setReaction(
        messageId: String,
        emoji: String,
        active: Boolean,
    ): ChatResult<ChatMessage> {
        val conversation = conversationForMessage(messageId) ?: return unavailableFailure()
        return resultOf(
            ChatOperation.ToggleReaction,
            "That reaction did not save yet. Try again.",
        ) {
            remote.setReaction(conversation, messageId, emoji.trim(), active).also { reconcileMessage(it) }
        }
    }

    override suspend fun sendTyping(conversationId: String, typing: Boolean) {
        val conversation = dao.conversation(conversationId)?.toDomain() ?: return
        runCatching { remote.sendTyping(conversationId, conversation.currentUserId, typing) }
    }

    override suspend fun removeFriend(userId: String): ChatResult<Unit> = resultOf(
        ChatOperation.RemoveFriend,
        "Friends is taking a break. Chat still works.",
    ) { remote.removeFriend(userId) }

    override suspend fun blockUser(userId: String): ChatResult<Unit> = resultOf(
        ChatOperation.BlockUser,
        "Friends is taking a break. Chat still works.",
    ) { remote.blockUser(userId) }

    override suspend fun listBlockedPeople(): ChatResult<List<BlockedPerson>> = resultOf(
        ChatOperation.ListBlockedPeople,
        "Blocked people aren’t available yet. Try again.",
    ) { remote.listBlockedPeople() }

    override suspend fun unblockUser(userId: String): ChatResult<Unit> = resultOf(
        ChatOperation.UnblockUser,
        "That person is still blocked. Try again.",
    ) { remote.unblockUser(userId) }

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

    override suspend fun importAttachments(
        conversationId: String,
        sources: List<AttachmentImportSource>,
    ): AttachmentImportResult = attachmentDraftMutex.withLock {
        if (sources.isEmpty()) return@withLock AttachmentImportResult(0)
        val importer = attachmentImporter ?: return@withLock AttachmentImportResult(
            0,
            listOf(AttachmentImportIssue(null, "Attachments are not available in this build.")),
        )
        val userId = (authState.value as? ChatAuthState.SignedIn)?.userId
            ?: return@withLock AttachmentImportResult(
                0,
                listOf(AttachmentImportIssue(null, "Sign in to add an attachment.")),
            )
        if (dao.conversation(conversationId)?.currentUserId != userId) {
            return@withLock AttachmentImportResult(
                0,
                listOf(AttachmentImportIssue(null, "This conversation isn't available.")),
            )
        }
        cleanupExpiredAttachmentDrafts(importer)
        val existing = dao.attachmentDrafts(conversationId, userId)
        val previousPreview = existing.filter { it.scope == AttachmentScopePreview }
        dao.deleteAttachmentDraftsByScope(conversationId, userId, AttachmentScopePreview)
        importer.deleteAll(previousPreview)
        val composer = existing.filter { it.scope == AttachmentScopeComposer }
        val remaining = (MaxMessageAttachments - composer.size).coerceAtLeast(0)
        val knownHashes = composer.mapTo(mutableSetOf()) { it.sha256 }
        val issues = mutableListOf<AttachmentImportIssue>()
        val importedIds = mutableListOf<String>()
        var imported = 0
        for (source in sources) {
            if (imported >= remaining) {
                issues += AttachmentImportIssue(
                    null,
                    "A message can include up to five attachments.",
                )
                break
            }
            try {
                val draft = importer.import(
                    source = source,
                    conversationId = conversationId,
                    userId = userId,
                    position = imported,
                )
                if (!knownHashes.add(draft.sha256)) {
                    importer.delete(draft)
                    issues += AttachmentImportIssue(draft.displayName, "That item is already attached.")
                    continue
                }
                dao.insertAttachmentDraft(draft)
                importedIds += draft.id
                imported += 1
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                issues += AttachmentImportIssue(
                    null,
                    error.message ?: "That item could not be added. Choose a different copy.",
                )
            }
        }
        AttachmentImportResult(imported, issues.distinctBy { it.message }, importedIds)
    }

    override suspend fun commitAttachmentPreview(conversationId: String) =
        attachmentDraftMutex.withLock {
            val userId = signedInUserForConversation(conversationId) ?: return@withLock
            val drafts = dao.attachmentDrafts(conversationId, userId)
            val composer = drafts.filter { it.scope == AttachmentScopeComposer }
            val preview = drafts.filter { it.scope == AttachmentScopePreview }
            if (preview.isEmpty()) return@withLock
            val available = (MaxMessageAttachments - composer.size).coerceAtLeast(0)
            val committed = preview.take(available).mapIndexed { index, row ->
                row.copy(
                    scope = AttachmentScopeComposer,
                    position = composer.size + index,
                    transferState = AttachmentStateWaiting,
                    updatedAt = now(),
                )
            }
            dao.upsertAttachmentDrafts(committed)
            committed.forEach { attachmentUploadScheduler?.enqueue(it.id, it.userId) }
        }

    override suspend fun discardAttachmentPreview(conversationId: String) =
        attachmentDraftMutex.withLock {
            val importer = attachmentImporter ?: return@withLock
            val userId = signedInUserForConversation(conversationId) ?: return@withLock
            val preview = dao.attachmentDrafts(conversationId, userId)
                .filter { it.scope == AttachmentScopePreview }
            dao.deleteAttachmentDraftsByScope(conversationId, userId, AttachmentScopePreview)
            importer.deleteAll(preview)
        }

    override suspend fun removeAttachmentDraft(conversationId: String, attachmentId: String) =
        attachmentDraftMutex.withLock {
            val importer = attachmentImporter ?: return@withLock
            val userId = signedInUserForConversation(conversationId) ?: return@withLock
            val rows = dao.attachmentDrafts(conversationId, userId)
            val removed = rows.firstOrNull { it.id == attachmentId } ?: return@withLock
            attachmentUploadScheduler?.cancel(removed.id)
            removed.serverAttachmentId?.let { runCatching { remote.cancelAttachmentUpload(it) } }
            dao.deleteAttachmentDraft(attachmentId)
            importer.delete(removed)
            val compacted = rows
                .filter { it.id != attachmentId && it.scope == removed.scope }
                .sortedBy { it.position }
                .mapIndexed { index, row -> row.copy(position = index, updatedAt = now()) }
            if (compacted.isNotEmpty()) dao.upsertAttachmentDrafts(compacted)
        }

    override suspend fun retryAttachmentDraft(conversationId: String, attachmentId: String) =
        attachmentDraftMutex.withLock {
            val userId = signedInUserForConversation(conversationId) ?: return@withLock
            val row = dao.attachmentDraft(attachmentId)
                ?.takeIf { it.userId == userId && it.conversationId == conversationId }
                ?: return@withLock
            if (row.scope != AttachmentScopeComposer ||
                row.transferState !in setOf(
                    "failed_recoverable", "sign_in_required", "waiting_for_network", "checking",
                )
            ) return@withLock
            if (dao.resetAttachmentForManualRetry(attachmentId, userId, conversationId, now()) == 1) {
                attachmentUploadScheduler?.enqueue(attachmentId, userId, replace = true)
            }
        }

    override suspend fun clearCachedUserData() {
        val rows = dao.allAttachmentDrafts()
        rows.forEach { attachmentUploadScheduler?.cancel(it.id) }
        attachmentImporter?.deleteAll(rows)
        dao.clearAllUserData()
        attachmentDeliveries.value = emptyMap()
    }

    private suspend fun signedInUserForConversation(conversationId: String): String? {
        val userId = (authState.value as? ChatAuthState.SignedIn)?.userId ?: return null
        return userId.takeIf { dao.conversation(conversationId)?.currentUserId == it }
    }

    private suspend fun conversationForMessage(messageId: String): AuthorizedConversation? {
        val message = dao.message(messageId) ?: return null
        return dao.conversation(message.conversationId)?.toDomain()
    }

    private suspend fun cleanupExpiredAttachmentDrafts(importer: LocalAttachmentImporter) {
        val cutoff = now()
        val expired = dao.expiredAttachmentDrafts(cutoff)
        dao.deleteExpiredAttachmentDrafts(cutoff)
        importer.deleteAll(expired)
    }

    private suspend fun reconnectBackfill(conversation: AuthorizedConversation) {
        val started = TimeSource.Monotonic.markNow()
        try {
            val refreshedConversation = remote.listAuthorizedConversations().conversations
                .firstOrNull { it.conversationId == conversation.conversationId }
            if (refreshedConversation == null) {
                val attachmentDrafts = dao.attachmentDraftsForConversation(conversation.conversationId)
                dao.deleteConversationData(conversation.conversationId)
                attachmentImporter?.deleteAll(attachmentDrafts)
                throw ConversationUnavailableException()
            }
            val page = remote.loadMessages(refreshedConversation)
            val reads = remote.loadReadStates(refreshedConversation.conversationId)
            dao.upsertConversation(refreshedConversation.toEntity())
            reconcileMessages(page.messages)
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

    private suspend fun reconcileMessage(message: ChatMessage) {
        cacheDeliveries(message.attachments.mapNotNull { attachment ->
            if (attachment.thumbnailUrl == null && attachment.displayUrl == null) return@mapNotNull null
            AttachmentDelivery(
                attachmentId = attachment.id,
                thumbnailUrl = attachment.thumbnailUrl,
                displayUrl = attachment.displayUrl,
                expiresAt = null,
            )
        })
        dao.reconcileMessage(
            message.toEntity(),
            message.attachments.map { it.toEntity(message.id, message.conversationId) },
            replaceAttachments = message.attachmentsHydrated,
        )
        cleanupHydratedAttachmentDrafts(message)
    }

    private suspend fun reconcileMessages(messages: List<ChatMessage>) {
        val attachments = messages.flatMap { message ->
            message.attachments.map { it.toEntity(message.id, message.conversationId) }
        }
        cacheDeliveries(messages.flatMap { message ->
            message.attachments.mapNotNull { attachment ->
                if (attachment.thumbnailUrl == null && attachment.displayUrl == null) return@mapNotNull null
                AttachmentDelivery(
                    attachmentId = attachment.id,
                    thumbnailUrl = attachment.thumbnailUrl,
                    displayUrl = attachment.displayUrl,
                    expiresAt = null,
                )
            }
        })
        dao.reconcileMessages(
            messages.map { it.toEntity() },
            attachments,
            preserveAttachmentMessageIds = messages
                .filterNot { it.attachmentsHydrated }
                .mapTo(mutableSetOf()) { it.id },
        )
        messages.forEach { cleanupHydratedAttachmentDrafts(it) }
    }

    private suspend fun cleanupHydratedAttachmentDrafts(message: ChatMessage) {
        if (message.localStatus != LocalMessageStatus.Sent ||
            !message.attachmentsHydrated || message.attachments.isEmpty()
        ) return
        val sentIds = message.attachments.mapTo(mutableSetOf(), ChatAttachment::id)
        val drafts = dao.composerAttachmentDrafts(message.conversationId, message.senderId)
            .filter { it.serverAttachmentId in sentIds }
        if (drafts.isEmpty()) return
        drafts.forEach { dao.deleteAttachmentDraft(it.id) }
        attachmentImporter?.deleteAll(drafts)
    }

    private fun cacheDeliveries(deliveries: List<AttachmentDelivery>) {
        if (deliveries.isEmpty()) return
        attachmentDeliveries.update { current ->
            current + deliveries.associateBy(AttachmentDelivery::attachmentId)
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
private const val MaxMessageAttachments = 5
private const val MaxRefreshMessageCount = 50
private const val MaxSearchPageSize = 99
private const val AttachmentScopePreview = "preview"
private const val AttachmentScopeComposer = "composer"
private const val AttachmentStateWaiting = "waiting_for_network"
private const val AttachmentStateReady = "ready"
