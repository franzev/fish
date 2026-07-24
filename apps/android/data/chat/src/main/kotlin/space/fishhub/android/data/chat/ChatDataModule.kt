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
import space.fishhub.android.data.chat.local.MIGRATION_8_9
import space.fishhub.android.data.chat.local.MIGRATION_9_10
import space.fishhub.android.data.chat.sharedcontent.RoomSharedContentCacheStore
import space.fishhub.android.data.chat.sharedcontent.IdentityGeneration
import space.fishhub.android.data.chat.sharedcontent.SharedContentIdentityCoordinator
import space.fishhub.android.data.chat.sharedcontent.SharedContentDeliveryRegistry
import space.fishhub.android.data.chat.sharedcontent.SharedContentPurgePort
import space.fishhub.android.data.chat.sharedcontent.SharedContentThumbnailKey
import space.fishhub.android.data.chat.sharedcontent.SharedContentThumbnailStore
import space.fishhub.android.data.chat.sharedcontent.SharedContentMediaUrlKind
import space.fishhub.android.data.chat.sharedcontent.SharedContentMediaHttpTransport
import space.fishhub.android.data.chat.sharedcontent.SharedContentMediaUrlPolicy
import androidx.work.WorkerFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.ByteArrayOutputStream
import java.time.Instant
import io.github.jan.supabase.SupabaseClient

object ChatDataModule {
    data class SharedContentThumbnailRequest(
        val ownerIdentityId: String,
        val conversationId: String,
        val identityGeneration: Long,
        val itemId: String,
        val contentVersion: String,
        val kind: String,
        val attachmentId: String? = null,
        val sourceMessageId: String? = null,
        val stickerAssetPath: String? = null,
    )

    /**
     * Narrow production seam for the gallery. Delivery locators and thumbnail
     * paths never cross this boundary.
     */
    class SharedContentGalleryRuntime internal constructor(
        val repository: ChatRepository,
        private val thumbnailStore: SharedContentThumbnailStore?,
        context: Context? = null,
        private val refreshAttachmentUrls:
            suspend (List<String>) -> ChatResult<List<AttachmentDelivery>> =
                repository::refreshAttachmentUrls,
        private val mediaUrlPolicy: SharedContentMediaUrlPolicy =
            SharedContentMediaUrlPolicy(null),
    ) {
        private val applicationContext = context?.applicationContext
        private val mediaTransport = SharedContentMediaHttpTransport(
            policy = mediaUrlPolicy,
            maximumRedirects = MAX_MEDIA_REDIRECTS,
            maximumBytes = MAX_GALLERY_THUMBNAIL_BYTES,
        )
        private val deliveryRegistries =
            mutableMapOf<Triple<String, String, Long>, SharedContentDeliveryRegistry>()
        private var revokedBeforeGeneration = 1L

        suspend fun refreshDelivery(attachmentIds: List<String>): ChatResult<Unit> =
            when (val result = repository.refreshAttachmentUrls(attachmentIds)) {
                is ChatResult.Success -> ChatResult.Success(Unit)
                is ChatResult.Failure -> result
            }

        suspend fun prefetchThumbnails(requests: List<SharedContentThumbnailRequest>) {
            requests.distinctBy { it.itemId to it.contentVersion }.forEach { loadThumbnail(it) }
        }

        suspend fun loadThumbnail(request: SharedContentThumbnailRequest): ByteArray? {
            if (request.identityGeneration <= 0 ||
                request.ownerIdentityId.isBlank() ||
                request.conversationId.isBlank() ||
                request.itemId.isBlank() ||
                request.contentVersion.isBlank()
            ) return null
            if (isRevoked(request.identityGeneration)) return null
            val key = SharedContentThumbnailKey(
                request.ownerIdentityId,
                request.conversationId,
                request.itemId,
                request.contentVersion,
            )
            thumbnailStore?.readRenderable(key)?.let { cached ->
                return cached.bytes.takeUnless { isRevoked(request.identityGeneration) }
            }
            val bytes = withContext(Dispatchers.IO) {
                when (request.kind) {
                    "photo", "video" -> loadAttachmentThumbnail(request)
                    "gif" -> loadGifPoster(request)
                    "sticker" -> loadStickerAsset(request)
                    else -> null
                }
            } ?: return null
            if (isRevoked(request.identityGeneration)) return null
            if (bytes.isEmpty() || bytes.size > MAX_GALLERY_THUMBNAIL_BYTES) return null
            val staged = synchronized(deliveryRegistries) {
                if (request.identityGeneration < revokedBeforeGeneration) {
                    false
                } else {
                    thumbnailStore?.stageLookahead(key, bytes)
                    true
                }
            }
            if (!staged || isRevoked(request.identityGeneration)) return null
            return thumbnailStore?.readRenderable(key)?.bytes ?: bytes
        }

        private suspend fun loadAttachmentThumbnail(
            request: SharedContentThumbnailRequest,
        ): ByteArray? {
            val attachmentId = request.attachmentId?.takeIf(String::isNotBlank) ?: return null
            val registryKey = Triple(
                request.ownerIdentityId,
                request.conversationId,
                request.identityGeneration,
            )
            val registry = synchronized(deliveryRegistries) {
                if (request.identityGeneration < revokedBeforeGeneration) return null
                deliveryRegistries.getOrPut(registryKey) {
                    SharedContentDeliveryRegistry(
                        ownerIdentityId = request.ownerIdentityId,
                        conversationId = request.conversationId,
                        identityGeneration = request.identityGeneration,
                        refreshAttachmentUrls = refreshAttachmentUrls,
                    )
                }.also {
                    if (deliveryRegistries.size > MAX_DELIVERY_REGISTRIES) {
                        deliveryRegistries.keys.firstOrNull { key -> key != registryKey }
                            ?.let(deliveryRegistries::remove)
                    }
                }
            }
            val lease = registry.lease(attachmentId) ?: return null
            if (isRevoked(request.identityGeneration) ||
                synchronized(deliveryRegistries) {
                    deliveryRegistries[registryKey] !== registry
                }
            ) {
                registry.clear()
                return null
            }
            return readEphemeral(
                lease.thumbnailUrl ?: lease.displayUrl,
                SharedContentMediaUrlKind.Storage,
            )
        }

        /**
         * Revokes every runtime delivery namespace older than the generation
         * being bound. Generations are process-global, so this also sweeps
         * stale namespaces from owners seen before [ownerIdentityId].
         */
        suspend fun purgeDeliveryRegistries(
            ownerIdentityId: String?,
            generation: IdentityGeneration,
        ): Int {
            require(ownerIdentityId == null || ownerIdentityId.isNotBlank())
            val registries = synchronized(deliveryRegistries) {
                revokedBeforeGeneration = maxOf(revokedBeforeGeneration, generation.value)
                deliveryRegistries.entries
                    .filter { (key, _) ->
                        key.third < revokedBeforeGeneration ||
                            (ownerIdentityId != null && key.first == ownerIdentityId)
                    }
                    .map { it.value }
                    .also {
                        deliveryRegistries.entries.removeIf { (key, _) ->
                            key.third < revokedBeforeGeneration ||
                                (ownerIdentityId != null && key.first == ownerIdentityId)
                        }
                    }
            }
            return registries.sumOf { it.clear() }
        }

        fun deliveryRegistryCount(
            ownerIdentityId: String? = null,
            beforeGeneration: IdentityGeneration? = null,
        ): Int = synchronized(deliveryRegistries) {
            deliveryRegistries.keys.count { key ->
                (ownerIdentityId == null || key.first == ownerIdentityId) &&
                    (beforeGeneration == null || key.third < beforeGeneration.value)
            }
        }

        suspend fun deliveryLeaseCount(
            ownerIdentityId: String? = null,
            beforeGeneration: IdentityGeneration? = null,
        ): Int {
            val registries = synchronized(deliveryRegistries) {
                deliveryRegistries
                    .filterKeys { key ->
                        (ownerIdentityId == null || key.first == ownerIdentityId) &&
                            (beforeGeneration == null || key.third < beforeGeneration.value)
                    }
                    .values
                    .toList()
            }
            return registries.sumOf { it.leaseCount() }
        }

        private fun isRevoked(generation: Long): Boolean =
            synchronized(deliveryRegistries) { generation < revokedBeforeGeneration }

        private suspend fun loadGifPoster(
            request: SharedContentThumbnailRequest,
        ): ByteArray? {
            val messageId = request.sourceMessageId?.takeIf(String::isNotBlank) ?: return null
            val messages = when (
                val result = repository.refreshMessages(request.conversationId, listOf(messageId))
            ) {
                is ChatResult.Success -> result.value
                is ChatResult.Failure -> return null
            }
            val posterUrl = messages.firstOrNull { it.id == messageId }?.gif?.posterUrl
            return readEphemeral(posterUrl, SharedContentMediaUrlKind.Gif)
        }

        private fun loadStickerAsset(request: SharedContentThumbnailRequest): ByteArray? {
            val path = request.stickerAssetPath
                ?.takeIf { it.isNotBlank() && !it.startsWith("/") && ".." !in it }
                ?: return null
            return runCatching {
                applicationContext?.assets?.open(path)?.use(::readBounded)
            }.getOrNull()
        }

        private suspend fun readEphemeral(
            rawUrl: String?,
            kind: SharedContentMediaUrlKind,
        ): ByteArray? = mediaTransport.read(rawUrl, kind)

        private fun readBounded(input: java.io.InputStream): ByteArray {
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                require(total <= MAX_GALLERY_THUMBNAIL_BYTES)
                output.write(buffer, 0, count)
            }
            return output.toByteArray()
        }

        fun confirmDisplayed(
            ownerIdentityId: String,
            conversationId: String,
            itemId: String,
            contentVersion: String,
        ): Boolean = thumbnailStore?.confirmDisplayed(
            ownerIdentityId = ownerIdentityId,
            conversationId = conversationId,
            itemId = itemId,
            contentVersion = contentVersion,
        ) == true

        private companion object {
            const val MAX_GALLERY_THUMBNAIL_BYTES = 8 * 1024 * 1024
            const val MAX_DELIVERY_REGISTRIES = 4
            const val MAX_MEDIA_REDIRECTS = 3
        }
    }

    data class Dependencies(
        val chatRepository: ChatRepository,
        val gifRepository: GifRepository,
        val sharedContentGalleryRuntime: SharedContentGalleryRuntime,
        val workerFactory: WorkerFactory = NoOpWorkerFactory,
        val startAttachmentMaintenanceAndRecovery: () -> Unit = {},
    )

    fun create(
        context: Context,
        supabaseClient: SupabaseClient?,
        supabaseUrl: String? = null,
        allowLocalDevelopmentMedia: Boolean = false,
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
            return Dependencies(
                chatRepository = UnconfiguredChatRepository,
                gifRepository = gifRepository,
                sharedContentGalleryRuntime = SharedContentGalleryRuntime(
                    repository = UnconfiguredChatRepository,
                    thumbnailStore = null,
                    context = context,
                    mediaUrlPolicy = SharedContentMediaUrlPolicy(
                        supabaseUrl,
                        allowLocalDevelopmentMedia,
                    ),
                ),
            )
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
            MIGRATION_8_9,
            MIGRATION_9_10,
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
        val sharedContentCache = RoomSharedContentCacheStore(database.chatDao())
        val thumbnailStore = SharedContentThumbnailStore(context.applicationContext)
        val thumbnailRoot = File(
            context.applicationContext.noBackupFilesDir,
            "shared-content-thumbnails",
        )
        lateinit var repository: DefaultChatRepository
        lateinit var sharedContentGalleryRuntime: SharedContentGalleryRuntime
        val identityCoordinator = SharedContentIdentityCoordinator(
            object : SharedContentPurgePort {
                override suspend fun revokeSharedContentStore() {
                    repository.revokeSharedContentStoreWork()
                }

                override suspend fun clearLeases(
                    ownerIdentityId: String?,
                    revokedBeforeGeneration: IdentityGeneration,
                ) {
                    repository.clearSharedContentLeases()
                    sharedContentGalleryRuntime.purgeDeliveryRegistries(
                        ownerIdentityId,
                        revokedBeforeGeneration,
                    )
                }

                override suspend fun purgeMetadata(ownerIdentityId: String?) {
                    // Restored metadata is disposable and never an authority
                    // source, so sweep every namespace before a new bind.
                    database.chatDao().clearSharedContentCache()
                }

                override suspend fun purgeThumbnailRoot(ownerIdentityId: String?): Boolean {
                    if (!ownerIdentityId.isNullOrBlank()) thumbnailStore.purgeOwner(ownerIdentityId)
                    if (ownerIdentityId.isNullOrBlank()) {
                        thumbnailRoot.deleteRecursively()
                        thumbnailRoot.mkdirs()
                    }
                    return !thumbnailRoot.walkTopDown().any { it.isFile }
                }

                override suspend fun verifyZero(ownerIdentityId: String?): Boolean =
                    (ownerIdentityId.isNullOrBlank() ||
                        sharedContentCache.verifyOwnerPurged(ownerIdentityId)) &&
                        sharedContentGalleryRuntime.deliveryRegistryCount() == 0 &&
                        sharedContentGalleryRuntime.deliveryLeaseCount() == 0 &&
                        !thumbnailRoot.walkTopDown().any { it.isFile }
            },
        )
        val diagnostics = if (
            context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        ) {
            RedactedLogcatChatDiagnostics
        } else {
            NoOpChatDiagnostics
        }
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            sharedContentCache = sharedContentCache,
            diagnostics = diagnostics,
            networkMonitor = networkMonitor,
            attachmentImporter = attachmentImporter,
            attachmentUploadScheduler = uploadScheduler,
            identityCoordinator = identityCoordinator,
        )
        sharedContentGalleryRuntime = SharedContentGalleryRuntime(
            repository = repository,
            thumbnailStore = thumbnailStore,
            context = context,
            mediaUrlPolicy = SharedContentMediaUrlPolicy(
                supabaseUrl,
                allowLocalDevelopmentMedia,
            ),
        )
        scope.launch {
            remote.authState.collectLatest { auth ->
                when (auth) {
                    is ChatAuthState.SignedIn -> identityCoordinator.sweepOnVerifiedStart(auth.userId)
                    ChatAuthState.SignedOut -> identityCoordinator.sweepOnVerifiedStart(null)
                    ChatAuthState.Loading -> Unit
                }
            }
        }
        return Dependencies(
            chatRepository = repository,
            gifRepository = gifRepository,
            sharedContentGalleryRuntime = sharedContentGalleryRuntime,
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

internal object UnconfiguredChatRepository : ChatRepository {
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
    override fun observeSharedContentSnapshot(
        conversationId: String,
    ): Flow<space.fishhub.android.data.chat.sharedcontent.StoredSharedContentSnapshot?> =
        flowOf(null)
    override suspend fun refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?,
    ): ChatResult<SharedContentDataPage> = failure
    override suspend fun refreshSharedContentCategories(
        token: SharedContentRequestToken,
    ): ChatResult<List<String>> = failure
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
