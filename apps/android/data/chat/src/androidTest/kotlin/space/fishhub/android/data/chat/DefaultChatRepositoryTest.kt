package space.fishhub.android.data.chat

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.ChatMessageCursor
import space.fishhub.android.data.chat.model.ChatReadState
import space.fishhub.android.data.chat.model.LocalMessageStatus
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.model.ChatGif
import space.fishhub.android.data.chat.model.ChatAttachment
import space.fishhub.android.data.chat.model.ChatAttachmentKind
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.MessagePage
import space.fishhub.android.data.chat.MessageSearchCursor
import space.fishhub.android.data.chat.MessageSearchPage
import space.fishhub.android.data.chat.remote.ChatRemoteDataSource
import space.fishhub.android.data.chat.local.ChatDatabase
import space.fishhub.android.data.chat.local.toEntity
import space.fishhub.android.data.chat.local.AttachmentDraftEntity
import android.net.Uri
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DefaultChatRepositoryTest {
    private lateinit var database: ChatDatabase
    private lateinit var remote: FakeRemote
    private lateinit var repository: DefaultChatRepository

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        remote = FakeRemote()
        repository = DefaultChatRepository(remote, database.chatDao())
    }

    @After
    fun tearDown() = database.close()

    @Test
    fun cachedConversationRemainsAvailableWhenRefreshFails() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.failConversationList = true

        val result = repository.listAuthorizedConversations()

        assertTrue(result is ChatResult.Success)
        assertEquals(
            remote.conversation.conversationId,
            (result as ChatResult.Success).value.conversations.single().conversationId,
        )
        assertEquals("Franz", result.value.currentUser.displayName)
    }

    @Test
    fun searchTrimsQueryBoundsPageAndPropagatesCursorForAuthorizedConversation() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val cursor = MessageSearchCursor("2026-07-15T00:00:00Z", "message-2")
        remote.searchPage = MessageSearchPage(emptyList(), cursor)

        val result = repository.searchMessages(
            conversationId = "conversation-1",
            query = "  practice  ",
            cursor = cursor,
            limit = 500,
        )

        assertTrue(result is ChatResult.Success)
        assertEquals("practice", remote.lastSearchQuery)
        assertEquals(cursor, remote.lastSearchCursor)
        assertEquals(99, remote.lastSearchLimit)
    }

    @Test
    fun blankOrUnauthorizedSearchNeverCallsRemote() = runTest {
        assertTrue(
            repository.searchMessages("conversation-1", "   ") is ChatResult.Failure,
        )
        assertTrue(
            repository.searchMessages("not-authorized", "practice") is ChatResult.Failure,
        )
        assertEquals(0, remote.searchCalls)
    }

    @Test
    fun searchFailureUsesCalmNotice() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.failSearch = true

        val result = repository.searchMessages("conversation-1", "practice")

        assertTrue(result is ChatResult.Failure)
        assertEquals(
            "Search is taking a little longer. Check your connection and try again.",
            (result as ChatResult.Failure).message,
        )
        assertEquals(FailureCategory.Network, result.category)
    }

    @Test
    fun manualRetryReconcilesFailedRequestWithoutDuplicate() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.failSend = true
        val content = OutgoingMessageContent(
            body = "Practice sentence",
            stickerId = "practice-sticker",
        )

        val failed = repository.sendMessage(
            "conversation-1",
            content,
            "request-1",
        )
        assertTrue(failed is ChatResult.Failure)

        remote.failSend = false
        val sent = repository.sendMessage(
            "conversation-1",
            content,
            "request-1",
        )
        assertTrue(sent is ChatResult.Success)

        val messages = repository.observeMessages("conversation-1").first()
        assertEquals(1, messages.size)
        assertEquals("server-message", messages.single().id)
        assertEquals(LocalMessageStatus.Sent, messages.single().localStatus)
    }

    @Test
    fun bodylessGifSurvivesBareSendAcknowledgement() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val gif = ChatGif(
            provider = "klipy",
            providerId = "gif-1",
            title = "Fish",
            description = "A fish nodding",
            sourceUrl = "https://klipy.com/gifs/gif-1",
            posterUrl = "https://static.klipy.com/poster.gif",
            previewUrl = "https://static.klipy.com/preview.mp4",
            mediaUrl = "https://static.klipy.com/media.mp4",
            width = 480,
            height = 360,
        )

        val result = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent(body = "", gif = gif),
            "gif-request",
        )

        assertTrue(result is ChatResult.Success)
        val cached = repository.observeMessages("conversation-1").first().single()
        assertEquals("gif-1", cached.gif?.providerId)
        assertEquals("", cached.body)
    }

    @Test
    fun realtimeRetriesAfterTransportFailure() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        remote.realtimeFailuresRemaining = 1
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            realtimeRetryDelayMs = 0,
        )

        val connected = repository.observeRealtime("conversation-1")
            .first { it == ChatRealtimeEvent.Connected }

        assertEquals(ChatRealtimeEvent.Connected, connected)
        assertEquals(2, remote.realtimeAttempts)
    }

    @Test
    fun reconnectPurgesConversationWhenAuthorizationWasRevoked() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val importer = FakeAttachmentImporter()
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            attachmentImporter = importer,
        )
        repository.importAttachments("conversation-1", listOf(source("private-photo")))
        database.chatDao().upsertMessage(
            ChatMessage(
                id = "cached-message",
                conversationId = "conversation-1",
                senderId = "coach-1",
                senderRole = UserRole.Coach,
                body = "Previously authorized",
                clientRequestId = "cached-request",
                createdAt = "2026-07-16T00:00:00Z",
            ).toEntity(),
        )
        remote.authorized = false

        val event = repository.observeRealtime("conversation-1")
            .first { it == ChatRealtimeEvent.ConversationUnavailable }

        assertEquals(ChatRealtimeEvent.ConversationUnavailable, event)
        assertNull(database.chatDao().conversation("conversation-1"))
        assertTrue(database.chatDao().allAttachmentDrafts().isEmpty())
        assertEquals(listOf("draft-private-photo"), importer.deleted)
        assertTrue(repository.observeMessages("conversation-1").first().isEmpty())
        repository.saveDraft("conversation-1", "Must not survive revocation")
        assertEquals("", repository.observeDraft("conversation-1").first())
    }

    @Test
    fun attachmentOnlyMessageSurvivesRoomAndUrlRefreshIsEphemeral() = runTest {
        remote.pageMessages = listOf(
            ChatMessage(
                id = "attachment-message",
                conversationId = "conversation-1",
                senderId = "coach-1",
                senderRole = UserRole.Coach,
                body = "",
                attachments = listOf(
                    ChatAttachment(
                        id = "attachment-1",
                        position = 0,
                        kind = ChatAttachmentKind.Image,
                        originalName = "Photo",
                        mimeType = "image/webp",
                        byteSize = 1200,
                        width = 1200,
                        height = 800,
                        thumbnailPath = "thumb.webp",
                        displayPath = "display.webp",
                        thumbnailUrl = "https://example.test/initial-thumb",
                        displayUrl = "https://example.test/initial-display",
                    ),
                ),
                clientRequestId = "attachment-request",
                createdAt = "2026-07-16T00:00:00Z",
            ),
        )

        assertTrue(repository.syncNewest("conversation-1") is ChatResult.Success)
        val hydrated = repository.observeMessages("conversation-1").first().single()
        assertEquals("", hydrated.body)
        assertEquals("https://example.test/initial-display", hydrated.attachments.single().displayUrl)

        repository = DefaultChatRepository(remote, database.chatDao())
        val restored = repository.observeMessages("conversation-1").first().single()
        assertEquals("attachment-1", restored.attachments.single().id)
        assertNull(restored.attachments.single().displayUrl)

        assertTrue(repository.refreshAttachmentUrls(listOf("attachment-1")) is ChatResult.Success)
        val refreshed = repository.observeMessages("conversation-1").first().single()
        assertEquals("https://example.test/attachment-1/display", refreshed.attachments.single().displayUrl)
        assertEquals(1, remote.refreshCalls)
    }

    @Test
    fun leasePurgeRejectsASuspendedRefreshAndEveryProviderBatchIsBounded() = runTest {
        remote.pageMessages = listOf(
            ChatMessage(
                id = "attachment-message",
                conversationId = "conversation-1",
                senderId = "coach-1",
                senderRole = UserRole.Coach,
                body = "",
                attachments = listOf(
                    ChatAttachment(
                        id = "attachment-1",
                        position = 0,
                        kind = ChatAttachmentKind.Image,
                        originalName = "Photo",
                        mimeType = "image/webp",
                        byteSize = 1200,
                        thumbnailPath = "thumb.webp",
                        displayPath = "display.webp",
                    ),
                ),
                clientRequestId = "attachment-request",
                createdAt = "2026-07-16T00:00:00Z",
            ),
        )
        assertTrue(repository.syncNewest("conversation-1") is ChatResult.Success)

        remote.refreshStarted = CompletableDeferred()
        remote.refreshRelease = CompletableDeferred()
        val refresh = async {
            repository.refreshAttachmentUrls((0..100).map { "attachment-$it" })
        }
        remote.refreshStarted?.await()
        repository.clearSharedContentLeases()
        remote.refreshRelease?.complete(Unit)

        assertTrue(refresh.await() is ChatResult.Failure)
        assertEquals(listOf(50, 50, 1), remote.refreshBatchSizes)
        assertNull(
            repository.observeMessages("conversation-1").first()
                .single().attachments.single().displayUrl,
        )
    }

    @Test
    fun temporaryAttachmentHydrationFailureKeepsPreviouslyCachedMetadata() = runTest {
        val attachment = ChatAttachment(
            id = "attachment-1",
            position = 0,
            kind = ChatAttachmentKind.File,
            originalName = "notes.pdf",
            mimeType = "application/pdf",
            byteSize = 1024,
            displayPath = "notes.pdf",
        )
        remote.pageMessages = listOf(
            ChatMessage(
                id = "message-1",
                conversationId = "conversation-1",
                senderId = "coach-1",
                senderRole = UserRole.Coach,
                body = "Notes",
                attachments = listOf(attachment),
                clientRequestId = "request-1",
                createdAt = "2026-07-16T00:00:00Z",
            ),
        )
        repository.syncNewest("conversation-1")

        remote.pageMessages = listOf(
            remote.pageMessages.single().copy(
                body = "Updated notes",
                attachments = emptyList(),
                attachmentsHydrated = false,
            ),
        )
        repository.syncNewest("conversation-1")

        val cached = repository.observeMessages("conversation-1").first().single()
        assertEquals("Updated notes", cached.body)
        assertEquals("attachment-1", cached.attachments.single().id)
    }

    @Test
    fun mixedInvalidAttachmentBatchKeepsValidItemsInSelectionOrder() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val importer = FakeAttachmentImporter()
        repository = DefaultChatRepository(remote, database.chatDao(), attachmentImporter = importer)

        val result = repository.importAttachments(
            "conversation-1",
            listOf(source("first"), source("bad"), source("second")),
        )

        assertEquals(2, result.importedCount)
        assertEquals(1, result.issues.size)
        val rows = repository.observeAttachmentDrafts("conversation-1").first()
        assertEquals(listOf("first", "second"), rows.map { it.displayName })
        assertEquals(listOf(0, 1), rows.map { it.position })
    }

    @Test
    fun duplicateAndMaximumAreRejectedWithoutChangingCommittedOrder() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            attachmentImporter = FakeAttachmentImporter(),
        )
        repository.importAttachments("conversation-1", listOf(source("one"), source("two")))
        repository.commitAttachmentPreview("conversation-1")

        val result = repository.importAttachments(
            "conversation-1",
            listOf(source("one"), source("three"), source("four"), source("five"), source("six")),
        )

        assertEquals(3, result.importedCount)
        assertTrue(result.issues.any { it.message.contains("already attached") })
        assertTrue(result.issues.any { it.message.contains("up to five") })
        repository.commitAttachmentPreview("conversation-1")
        assertEquals(
            listOf("one", "two", "three", "four", "five"),
            repository.observeAttachmentDrafts("conversation-1").first().map { it.displayName },
        )
    }

    @Test
    fun removingDraftCompactsOnlyItsScope() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            attachmentImporter = FakeAttachmentImporter(),
        )
        repository.importAttachments(
            "conversation-1",
            listOf(source("one"), source("two"), source("three")),
        )
        repository.commitAttachmentPreview("conversation-1")
        val before = repository.observeAttachmentDrafts("conversation-1").first()

        repository.removeAttachmentDraft("conversation-1", before[1].id)

        val after = repository.observeAttachmentDrafts("conversation-1").first()
        assertEquals(listOf("one", "three"), after.map { it.displayName })
        assertEquals(listOf(0, 1), after.map { it.position })
    }

    @Test
    fun partialAttachmentFailureKeepsReadySiblingAndBlocksSubsetSend() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        database.chatDao().upsertAttachmentDrafts(
            listOf(
                readyDraft("one", 0),
                readyDraft("two", 1).copy(
                    serverAttachmentId = null,
                    transferState = "failed_recoverable",
                    failureCode = "upload_unavailable",
                ),
            ),
        )

        val result = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent(body = "", attachmentIds = listOf("server-one")),
            "partial-request",
        )

        assertTrue(result is ChatResult.Failure)
        assertEquals(0, remote.sendCalls)
        assertEquals(2, database.chatDao().composerAttachmentDrafts("conversation-1", "client-1").size)
    }

    @Test
    fun attachmentOnlySendPreservesOrderAndCleansPrivateDraftsAfterSuccess() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val importer = FakeAttachmentImporter()
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            attachmentImporter = importer,
        )
        database.chatDao().upsertAttachmentDrafts(
            listOf(readyDraft("one", 0), readyDraft("two", 1)),
        )

        val result = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent(
                body = "",
                attachmentIds = listOf("server-one", "server-two"),
            ),
            "attachment-only-request",
        )

        assertTrue(result is ChatResult.Success)
        assertEquals(listOf("server-one", "server-two"), remote.lastSentContent?.attachmentIds)
        assertEquals("", (result as ChatResult.Success).value.body)
        assertTrue(database.chatDao().composerAttachmentDrafts("conversation-1", "client-1").isEmpty())
        assertEquals(listOf("draft-one", "draft-two"), importer.deleted)
    }

    @Test
    fun successfulSendWithIncompleteHydrationRetainsAndRekeysDurableAttachments() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        val importer = FakeAttachmentImporter()
        repository = DefaultChatRepository(
            remote,
            database.chatDao(),
            attachmentImporter = importer,
        )
        database.chatDao().upsertAttachmentDrafts(listOf(readyDraft("one", 0)))
        remote.sendAttachmentsHydrated = false

        val result = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent(body = "", attachmentIds = listOf("server-one")),
            "incomplete-request",
        )

        assertTrue(result is ChatResult.Success)
        assertEquals(1, database.chatDao().composerAttachmentDrafts("conversation-1", "client-1").size)
        assertTrue(importer.deleted.isEmpty())
        val retained = repository.observeMessages("conversation-1").first().single()
        assertEquals("server-message", retained.id)
        assertEquals("server-one", retained.attachments.single().id)
        assertEquals("/private/one.webp", retained.attachments.single().displayUrl)

        remote.pageMessages = listOf(
            (result as ChatResult.Success).value.copy(
                attachments = listOf(
                    ChatAttachment(
                        id = "server-one",
                        position = 0,
                        kind = ChatAttachmentKind.Image,
                        originalName = "Photo",
                        mimeType = "image/webp",
                        byteSize = 100,
                        width = 100,
                        height = 80,
                        displayPath = "display.webp",
                    ),
                ),
                attachmentsHydrated = true,
                localStatus = LocalMessageStatus.Sent,
            ),
        )
        repository.syncNewest("conversation-1")

        assertTrue(database.chatDao().composerAttachmentDrafts("conversation-1", "client-1").isEmpty())
        assertEquals(listOf("draft-one"), importer.deleted)
    }

    @Test
    fun startupMaintenanceRemovesExpiredRowsAndPrivateCopies() = runTest {
        val importer = FakeAttachmentImporter()
        database.chatDao().upsertAttachmentDrafts(
            listOf(readyDraft("expired", 0).copy(expiresAt = "2026-07-17T23:59:59Z")),
        )
        val context = ApplicationProvider.getApplicationContext<Context>()

        AttachmentMaintenance(
            context,
            database.chatDao(),
            importer,
            now = { Instant.parse("2026-07-18T00:00:00Z") },
        ).run()

        assertTrue(database.chatDao().allAttachmentDrafts().isEmpty())
        assertEquals(listOf("draft-expired"), importer.deleted)
    }

    @Test
    fun sendFailureRetainsReadyAttachmentDraftsForSameRequestRetry() = runTest {
        database.chatDao().upsertConversation(remote.conversation.toEntity())
        database.chatDao().upsertAttachmentDrafts(listOf(readyDraft("one", 0)))
        remote.failSend = true

        val failed = repository.sendMessage(
            "conversation-1",
            OutgoingMessageContent("Practice", attachmentIds = listOf("server-one")),
            "stable-request",
        )

        assertTrue(failed is ChatResult.Failure)
        assertEquals("server-one", database.chatDao()
            .composerAttachmentDrafts("conversation-1", "client-1").single().serverAttachmentId)
        remote.failSend = false
        assertTrue(
            repository.sendMessage(
                "conversation-1",
                OutgoingMessageContent("Practice", attachmentIds = listOf("server-one")),
                "stable-request",
            ) is ChatResult.Success,
        )
        assertEquals(2, remote.sendCalls)
    }

    private fun readyDraft(name: String, position: Int) = AttachmentDraftEntity(
        id = "draft-$name",
        conversationId = "conversation-1",
        userId = "client-1",
        position = position,
        kind = "image",
        scope = "composer",
        displayName = "Photo",
        sourceMimeType = "image/jpeg",
        storedMimeType = "image/webp",
        byteSize = 100,
        sourceByteSize = 200,
        width = 100,
        height = 80,
        localPath = "/private/$name.webp",
        thumbnailPath = "/private/$name-thumb.webp",
        sha256 = name.padEnd(64, '0').take(64),
        createdAt = "2026-07-17T00:00:00Z",
        updatedAt = "2026-07-17T00:00:00Z",
        expiresAt = "2099-07-24T00:00:00Z",
        clientUploadId = "upload-$name",
        serverAttachmentId = "server-$name",
        transferState = "ready",
        progressBytes = 100,
    )

    private fun source(name: String) = AttachmentImportSource(
        Uri.parse("content://test/$name"),
        AttachmentImportKind.Image,
    )
}

private class FakeAttachmentImporter : LocalAttachmentImporter {
    val deleted = mutableListOf<String>()

    override suspend fun import(
        source: AttachmentImportSource,
        conversationId: String,
        userId: String,
        position: Int,
    ): AttachmentDraftEntity {
        val name = source.uri.lastPathSegment.orEmpty()
        if (name == "bad") throw AttachmentImportException("That photo could not be prepared.")
        return AttachmentDraftEntity(
            id = "draft-$name",
            conversationId = conversationId,
            userId = userId,
            position = position,
            kind = "image",
            scope = "preview",
            displayName = name,
            sourceMimeType = "image/jpeg",
            storedMimeType = "image/webp",
            byteSize = 100,
            width = 100,
            height = 80,
            localPath = "/private/$name.webp",
            thumbnailPath = "/private/$name-thumb.webp",
            sha256 = name.padEnd(64, '0').take(64),
            createdAt = "2026-07-17T00:00:00Z",
            updatedAt = "2026-07-17T00:00:00Z",
            expiresAt = "2099-07-24T00:00:00Z",
        )
    }

    override fun delete(entity: AttachmentDraftEntity) {
        deleted += entity.id
    }

    override fun deleteAll(entities: Collection<AttachmentDraftEntity>) {
        entities.forEach(::delete)
    }

    override fun cleanupOrphans(livePaths: Set<String>, olderThanEpochMillis: Long) = Unit
}

private class FakeRemote : ChatRemoteDataSource {
    val conversation = AuthorizedConversation(
        conversationId = "conversation-1",
        currentUserId = "client-1",
        currentUserRole = UserRole.Client,
        currentUserDisplayName = "Franz",
        participantId = "coach-1",
        participantRole = UserRole.Coach,
        participantDisplayName = "Coach Jordan",
        latestMessageText = null,
        latestMessageCreatedAt = null,
        unreadCount = 0,
    )
    override val authState = MutableStateFlow<ChatAuthState>(
        ChatAuthState.SignedIn("client-1", "client@example.com"),
    )
    var failConversationList = false
    var failSend = false
    var realtimeFailuresRemaining = 0
    var realtimeAttempts = 0
    var authorized = true
    var pageMessages: List<ChatMessage> = emptyList()
    var refreshCalls = 0
    var refreshBatchSizes = mutableListOf<Int>()
    var refreshStarted: CompletableDeferred<Unit>? = null
    var refreshRelease: CompletableDeferred<Unit>? = null
    var sendCalls = 0
    var sendAttachmentsHydrated = true
    var lastSentContent: OutgoingMessageContent? = null
    var searchCalls = 0
    var failSearch = false
    var lastSearchQuery: String? = null
    var lastSearchCursor: MessageSearchCursor? = null
    var lastSearchLimit: Int? = null
    var searchPage = MessageSearchPage(emptyList(), null)

    override suspend fun signIn(email: String, password: String) = Unit
    override suspend fun signOut() = Unit
    override suspend fun listAuthorizedConversations(): AuthorizedChatDirectory {
        if (failConversationList) throw IOException("offline")
        return AuthorizedChatDirectory(
            currentUser = AuthorizedChatIdentity(
                conversation.currentUserId,
                conversation.currentUserRole,
                conversation.currentUserDisplayName,
            ),
            conversations = if (authorized) listOf(conversation) else emptyList(),
        )
    }
    override suspend fun loadMessages(
        conversation: AuthorizedConversation,
        cursor: ChatMessageCursor?,
    ) = MessagePage(pageMessages, false, pageMessages.firstOrNull()?.let {
        ChatMessageCursor(it.createdAt, it.id)
    })
    override suspend fun searchMessages(
        conversation: AuthorizedConversation,
        query: String,
        cursor: MessageSearchCursor?,
        limit: Int,
    ): MessageSearchPage {
        searchCalls += 1
        lastSearchQuery = query
        lastSearchCursor = cursor
        lastSearchLimit = limit
        if (failSearch) throw IOException("offline")
        return searchPage
    }
    override suspend fun loadReadStates(conversationId: String) = emptyList<ChatReadState>()
    override suspend fun refreshAttachmentUrls(attachmentIds: List<String>): List<AttachmentDelivery> {
        refreshBatchSizes += attachmentIds.size
        refreshStarted?.complete(Unit)
        refreshRelease?.await()
        return attachmentIds.map {
            refreshCalls += 1
            AttachmentDelivery(it, "https://example.test/$it/thumb", "https://example.test/$it/display", null)
        }
    }
    override suspend fun initializeAttachmentUpload(
        command: space.fishhub.android.data.chat.remote.InitializeAttachmentUpload,
    ) = space.fishhub.android.data.chat.remote.AttachmentUploadAuthorization(
        "attachment", "chat-images", "path", "token", command.sourceMimeType,
        "https://example.test/tus", "https://example.test/put", "2099-01-01T00:00:00Z",
    )
    override suspend fun completeAttachmentUpload(attachmentId: String) =
        space.fishhub.android.data.chat.remote.CompletedAttachmentUpload(attachmentId, "ready")
    override suspend fun cancelAttachmentUpload(attachmentId: String) = Unit
    override suspend fun sendMessage(
        conversation: AuthorizedConversation,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ): ChatMessage {
        sendCalls += 1
        lastSentContent = content
        if (failSend) throw IOException("offline")
        return ChatMessage(
            id = "server-message",
            conversationId = conversation.conversationId,
            senderId = conversation.currentUserId,
            senderRole = conversation.currentUserRole,
            senderDisplayName = conversation.currentUserDisplayName,
            body = content.normalizedBody,
            attachments = if (sendAttachmentsHydrated) content.attachmentIds.mapIndexed { position, id ->
                ChatAttachment(
                    id = id,
                    position = position,
                    kind = ChatAttachmentKind.Image,
                    originalName = "Photo",
                    mimeType = "image/webp",
                    byteSize = 100,
                )
            } else emptyList(),
            attachmentsHydrated = sendAttachmentsHydrated,
            clientRequestId = clientRequestId,
            createdAt = "2026-07-16T00:00:00Z",
            localStatus = LocalMessageStatus.Sent,
        )
    }
    override suspend fun reportGif(messageId: String) = Unit
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ) = ChatReadState("client-1", lastDeliveredMessageId, null, lastReadMessageId, null)
    override fun realtime(conversation: AuthorizedConversation): Flow<ChatRealtimeEvent> = flow {
        realtimeAttempts += 1
        if (realtimeFailuresRemaining > 0) {
            realtimeFailuresRemaining -= 1
            throw IOException("socket closed")
        }
        emit(ChatRealtimeEvent.Connected)
        awaitCancellation()
    }
}
