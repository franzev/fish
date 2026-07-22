package space.fishhub.android.data.chat

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.room.Room
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.ConversationSnapshot
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.MessageSearchCursor
import space.fishhub.android.data.chat.MessageSearchPage
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.remote.SupabaseChatRemoteDataSource
import space.fishhub.android.data.chat.local.ChatDatabase
import space.fishhub.android.data.chat.local.MIGRATION_1_2
import space.fishhub.android.data.chat.local.MIGRATION_2_3
import space.fishhub.android.data.chat.local.MIGRATION_3_4
import space.fishhub.android.data.chat.local.MIGRATION_4_5
import space.fishhub.android.data.chat.local.MIGRATION_5_6
import space.fishhub.android.data.chat.local.MIGRATION_6_7
import space.fishhub.android.data.chat.local.MIGRATION_7_8
import androidx.work.WorkerFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.time.Instant
import io.github.jan.supabase.SupabaseClient

object ChatDataModule {
    data class Dependencies(
        val chatRepository: ChatRepository,
        val gifRepository: GifRepository,
        val workerFactory: WorkerFactory = NoOpWorkerFactory,
        val startAttachmentMaintenanceAndRecovery: () -> Unit = {},
    )

    fun create(
        context: Context,
        supabaseClient: SupabaseClient?,
        klipyApiKey: String,
        klipyClientKey: String,
        onBeforeSignOut: suspend () -> Unit = {},
    ): Dependencies {
        val gifRepository = KlipyGifRepository(
            apiKey = klipyApiKey,
            clientKey = klipyClientKey,
            customerIdStore = DataStoreGifCustomerIdStore(context),
        )
        if (supabaseClient == null) {
            return Dependencies(UnconfiguredChatRepository, gifRepository)
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val database = Room.databaseBuilder(
            context.applicationContext,
            ChatDatabase::class.java,
            "fish-personal-chat.db",
        ).addMigrations(
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
            MIGRATION_6_7,
            MIGRATION_7_8,
        ).build()
        val remote = SupabaseChatRemoteDataSource(supabaseClient, scope, onBeforeSignOut)
        val attachmentImporter = AttachmentImporter(context.applicationContext)
        val uploadTransport = KtorSignedTusUploadTransport()
        val uploadScheduler = WorkManagerAttachmentUploadScheduler(context.applicationContext)
        val workerFactory = AttachmentUploadWorkerFactory(
            database.chatDao(),
            remote,
            uploadTransport,
            attachmentImporter,
        )
        val maintenance = AttachmentMaintenance(
            context.applicationContext,
            database.chatDao(),
            attachmentImporter,
        )
        val networkMonitor = AndroidNetworkMonitor(context.applicationContext, scope)
        val diagnostics = if (
            context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        ) {
            RedactedLogcatChatDiagnostics
        } else {
            NoOpChatDiagnostics
        }
        return Dependencies(
            chatRepository = DefaultChatRepository(
                remote,
                database.chatDao(),
                diagnostics = diagnostics,
                networkMonitor = networkMonitor,
                attachmentImporter = attachmentImporter,
                attachmentUploadScheduler = uploadScheduler,
            ),
            gifRepository = gifRepository,
            workerFactory = workerFactory,
            startAttachmentMaintenanceAndRecovery = {
                scope.launch {
                    try {
                        maintenance.run()
                    } catch (cancelled: kotlinx.coroutines.CancellationException) {
                        throw cancelled
                    } catch (_: Throwable) {
                        // Recovery still needs to resume durable rows if cleanup is temporarily unavailable.
                    }
                    val recoveryNow = Instant.now()
                    database.chatDao().allAttachmentDrafts()
                        .filter { row ->
                            row.scope == "composer" && shouldRecoverAttachmentTransfer(
                                row.transferState,
                                row.attemptCount,
                            )
                        }
                        .forEach { row ->
                            uploadScheduler.enqueue(
                                row.id,
                                row.userId,
                                replace = false,
                                initialDelaySeconds = attachmentRetryDelaySeconds(
                                    row.retryAfter,
                                    recoveryNow,
                                ),
                            )
                        }
                }
                runCatching { enqueueAttachmentMaintenance(context.applicationContext) }
            },
        )
    }
}

private object NoOpWorkerFactory : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: androidx.work.WorkerParameters,
    ): androidx.work.ListenableWorker? = null
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
    override fun observeAttachmentDrafts(
        conversationId: String,
    ): Flow<List<space.fishhub.android.data.chat.model.LocalAttachmentDraft>> = flowOf(emptyList())
    override fun observeRealtime(conversationId: String): Flow<ChatRealtimeEvent> =
        flowOf(ChatRealtimeEvent.Disconnected)
    override suspend fun signIn(email: String, password: String): ChatResult<Unit> = failure
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations(): ChatResult<AuthorizedChatDirectory> = failure
    override suspend fun syncNewest(conversationId: String): ChatResult<ConversationSnapshot> = failure
    override suspend fun loadOlder(conversationId: String, cursor: ChatMessageCursor): ChatResult<MessagePage> = failure
    override suspend fun refreshAttachmentUrls(
        attachmentIds: List<String>,
    ): ChatResult<List<AttachmentDelivery>> = failure
    override suspend fun searchMessages(
        conversationId: String,
        query: String,
        cursor: MessageSearchCursor?,
        limit: Int,
    ): ChatResult<MessageSearchPage> = failure
    override suspend fun sendMessage(
        conversationId: String,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatResult<ChatMessage> = failure
    override suspend fun editMessage(messageId: String, body: String): ChatResult<ChatMessage> = failure
    override suspend fun deleteMessage(messageId: String): ChatResult<ChatMessage> = failure
    override suspend fun setReaction(
        messageId: String,
        emoji: String,
        active: Boolean,
    ): ChatResult<ChatMessage> = failure
    override suspend fun sendTyping(conversationId: String, typing: Boolean) = Unit
    override suspend fun removeFriend(userId: String): ChatResult<Unit> = failure
    override suspend fun blockUser(userId: String): ChatResult<Unit> = failure
    override suspend fun listBlockedPeople(): ChatResult<List<BlockedPerson>> = failure
    override suspend fun unblockUser(userId: String): ChatResult<Unit> = failure
    override suspend fun reportGif(messageId: String): ChatResult<Unit> = failure
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ): ChatResult<ChatReadState> = failure
    override suspend fun saveDraft(conversationId: String, draft: String) = Unit
    override suspend fun importAttachments(
        conversationId: String,
        sources: List<AttachmentImportSource>,
    ): AttachmentImportResult = AttachmentImportResult(
        importedCount = 0,
        issues = listOf(AttachmentImportIssue(null, failure.message)),
    )
    override suspend fun commitAttachmentPreview(conversationId: String) = Unit
    override suspend fun discardAttachmentPreview(conversationId: String) = Unit
    override suspend fun removeAttachmentDraft(conversationId: String, attachmentId: String) = Unit
    override suspend fun retryAttachmentDraft(conversationId: String, attachmentId: String) = Unit
    override suspend fun clearCachedUserData() = Unit
}
