package space.fishhub.android.data.chat.local

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.data.chat.model.UserRole
import space.fishhub.android.data.chat.AuthorizedConversation
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatDaoTest {
    private lateinit var database: ChatDatabase
    private lateinit var dao: ChatDao

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        dao = database.chatDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun authoritativeMessageReplacesOptimisticRequestWithoutDuplicate() = runTest {
        dao.reconcileMessage(message(id = "local-request", body = "optimistic", status = "sending"))
        dao.reconcileMessage(message(id = "server-message", body = "confirmed", status = "sent"))

        val messages = dao.observeMessages("conversation-1").first()
        assertEquals(1, messages.size)
        assertEquals("server-message", messages.single().id)
        assertEquals("confirmed", messages.single().body)
    }

    @Test
    fun incompleteAuthoritativeHydrationRekeysOptimisticAttachments() = runTest {
        val local = message(id = "local-request", body = "", status = "sending")
        dao.reconcileMessage(local, listOf(attachment(messageId = local.id)))

        dao.reconcileMessage(
            message(id = "server-message", body = "", status = "sent"),
            replaceAttachments = false,
        )

        val messages = dao.observeMessages("conversation-1").first()
        val attachments = dao.observeMessageAttachments("conversation-1").first()
        assertEquals(listOf("server-message"), messages.map { it.id })
        assertEquals("server-message", attachments.single().messageId)
        assertEquals("server-attachment", attachments.single().id)
    }

    @Test
    fun transferClaimAtomicallyUsesPersistedAttemptCount() = runTest {
        dao.insertAttachmentDraft(attachmentDraft())

        assertEquals(1, dao.claimAttachmentTransfer(
            "draft-1", "user-1", "conversation-1", "initializing", 2, true,
            "2026-07-18T00:00:01Z",
        ))
        assertEquals(1, dao.claimAttachmentTransfer(
            "draft-1", "user-1", "conversation-1", "initializing", 2, true,
            "2026-07-18T00:00:02Z",
        ))
        assertEquals(0, dao.claimAttachmentTransfer(
            "draft-1", "user-1", "conversation-1", "initializing", 2, true,
            "2026-07-18T00:00:03Z",
        ))
        assertEquals(1, dao.claimAttachmentTransfer(
            "draft-1", "user-1", "conversation-1", "checking", 2, false,
            "2026-07-18T00:00:04Z",
        ))
        assertEquals(2, dao.attachmentDraft("draft-1")?.attemptCount)
    }

    @Test
    fun genuineCompletionFailuresAtomicallyStopAtRetryCap() = runTest {
        dao.insertAttachmentDraft(attachmentDraft())

        repeat(5) { attempt ->
            assertEquals(1, dao.markAttachmentFailureConsumingAttempt(
                "draft-1", "user-1", "conversation-1",
                if (attempt < 4) "checking" else "failed_recoverable",
                "upload_unavailable", null, 5, "2026-07-18T00:00:0${attempt + 1}Z",
            ))
        }
        assertEquals(0, dao.markAttachmentFailureConsumingAttempt(
            "draft-1", "user-1", "conversation-1", "checking",
            "upload_unavailable", null, 5, "2026-07-18T00:00:06Z",
        ))
        assertEquals(5, dao.attachmentDraft("draft-1")?.attemptCount)
        assertEquals("failed_recoverable", dao.attachmentDraft("draft-1")?.transferState)
    }

    @Test
    fun draftIsScopedToConversationAndUser() = runTest {
        dao.upsertDraft(DraftEntity("conversation-1", "user-1", "Keep this draft", "2026-07-16T00:00:00Z"))

        assertEquals("Keep this draft", dao.observeDraft("conversation-1", "user-1").first())
        assertEquals(null, dao.observeDraft("conversation-1", "user-2").first())
    }

    @Test
    fun cachedConversationsAreScopedToTheSignedInUser() = runTest {
        dao.upsertConversation(
            AuthorizedConversation(
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
            ).toEntity(),
        )

        assertEquals(1, dao.conversations("client-1").size)
        assertEquals(0, dao.conversations("another-user").size)
    }

    @Test
    fun sharedContentDaoContractNamesOwnerIsolationAndAtomicPurge() {
        val requiredMethods = setOf(
            "observeSharedContentCacheRows",
            "readSharedContentCacheRows",
            "readSharedContentCacheOwner",
            "replaceSharedContentNewestWindowAndPrune",
            "appendSharedContentBrowsedPageAndPrune",
            "applySharedContentTombstonesAndPrune",
            "purgeSharedContentConversation",
            "purgeSharedContentOwner",
            "verifyOwnerPurged",
        )
        val availableMethods = ChatDao::class.java.methods.map { it.name }.toSet()
        assertTrue(
            "RED: missing owner-scoped SharedContent DAO transaction methods, including wrongOwner, authoritativeEmpty, and verifyOwnerPurged behavior",
            availableMethods.containsAll(requiredMethods),
        )
    }

    @Test
    fun sharedContentDaoReconcilesOneOwnerAndConversationWithoutCrossNamespaceRows() = runTest {
        val now = "2026-07-23T00:00:00Z"
        val owner = SharedContentCacheOwnerEntity(
            ownerIdentityId = "owner-a",
            conversationId = "conversation-1",
            savedAt = now,
            lastAccessedAt = now,
        )
        val page = SharedContentCachePageEntity(
            ownerIdentityId = "owner-a",
            conversationId = "conversation-1",
            pageId = "newest",
            pageOrdinal = 0,
            retainedCursor = null,
            lastAccessedAt = now,
            isNewestWindow = true,
        )
        val item = SharedContentCacheItemEntity(
            ownerIdentityId = "owner-a",
            conversationId = "conversation-1",
            itemId = "item-1",
            sourceMessageId = "message-1",
            senderId = "owner-a",
            sourceCreatedAt = now,
            sourceRank = 0,
            category = "files",
            kind = "file",
            attachmentId = "attachment-1",
            attachmentOriginalName = "notes.pdf",
            attachmentMimeType = "application/pdf",
            attachmentByteSize = 10,
            pageId = "newest",
        )

        dao.replaceSharedContentNewestWindowAndPrune(
            owner = owner,
            page = page,
            items = listOf(item),
            now = now,
            inactivityCutoff = "2026-06-23T00:00:00Z",
        )

        assertEquals(1, dao.readSharedContentCacheRows("owner-a", "conversation-1").size)
        assertEquals(0, dao.readSharedContentCacheRows("wrong-owner", "conversation-1").size)
        dao.purgeSharedContentConversation("owner-a", "conversation-1")
        assertTrue(dao.verifyOwnerPurged("owner-a", "conversation-1"))
    }

    private fun message(id: String, body: String, status: String) = MessageEntity(
        id = id,
        conversationId = "conversation-1",
        senderId = "user-1",
        senderRole = "client",
        senderDisplayName = "Franz",
        body = body,
        clientRequestId = "request-1",
        createdAt = "2026-07-16T00:00:00Z",
        editedAt = null,
        deletedAt = null,
        replyToMessageId = null,
        localStatus = status,
        failureReason = null,
    )

    private fun attachment(messageId: String) = MessageAttachmentEntity(
        id = "server-attachment",
        messageId = messageId,
        conversationId = "conversation-1",
        position = 0,
        kind = "image",
        available = true,
        originalName = "Photo",
        storedMimeType = "image/webp",
        storedByteSize = 100,
        width = 100,
        height = 80,
        thumbnailPath = null,
        displayPath = null,
    )

    private fun attachmentDraft() = AttachmentDraftEntity(
        id = "draft-1",
        conversationId = "conversation-1",
        userId = "user-1",
        position = 0,
        kind = "image",
        scope = "composer",
        displayName = "Photo",
        sourceMimeType = "image/jpeg",
        storedMimeType = "image/webp",
        byteSize = 100,
        width = 100,
        height = 80,
        localPath = "/private/photo.webp",
        thumbnailPath = null,
        sha256 = "a".repeat(64),
        createdAt = "2026-07-18T00:00:00Z",
        updatedAt = "2026-07-18T00:00:00Z",
        expiresAt = "2026-07-25T00:00:00Z",
    )
}
