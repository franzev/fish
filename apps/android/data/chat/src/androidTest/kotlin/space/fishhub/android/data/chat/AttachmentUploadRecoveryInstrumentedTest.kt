package space.fishhub.android.data.chat

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.Data
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import java.io.File
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import space.fishhub.android.data.chat.local.AttachmentDraftEntity
import space.fishhub.android.data.chat.local.ChatDatabase
import space.fishhub.android.data.chat.remote.AttachmentCommandException
import space.fishhub.android.data.chat.remote.AttachmentUploadAuthorization
import space.fishhub.android.data.chat.remote.ChatRemoteDataSource
import space.fishhub.android.data.chat.remote.CompletedAttachmentUpload
import space.fishhub.android.data.chat.remote.InitializeAttachmentUpload

@RunWith(AndroidJUnit4::class)
class AttachmentUploadRecoveryInstrumentedTest {
    private lateinit var context: Context
    private lateinit var database: ChatDatabase
    private lateinit var remote: RecoveryRemote
    private lateinit var transport: RejectingTransport
    private lateinit var scheduler: CapturingScheduler

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        database = Room.inMemoryDatabaseBuilder(context, ChatDatabase::class.java).build()
        remote = RecoveryRemote()
        transport = RejectingTransport()
        scheduler = CapturingScheduler()
    }

    @After
    fun tearDown() = database.close()

    @Test
    fun completionTimeoutRetriesCompleteWithoutInitializeOrUpload() = runTest {
        database.chatDao().insertAttachmentDraft(uploadedDraft())
        remote.completions += { throw java.io.IOException("response lost") }
        remote.completions += { CompletedAttachmentUpload("server-1", "ready") }

        assertResultType(ListenableWorker.Result.retry(), worker().doWork())
        assertEquals("checking", database.chatDao().attachmentDraft("draft-1")?.transferState)
        assertResultType(ListenableWorker.Result.success(), worker().doWork())

        assertEquals(2, remote.completeCalls)
        assertEquals(0, remote.initializeCalls)
        assertEquals(0, transport.uploadCalls)
        assertEquals("ready", database.chatDao().attachmentDraft("draft-1")?.transferState)
    }

    @Test
    fun pendingScanRetryStaysOnCompletePath() = runTest {
        database.chatDao().insertAttachmentDraft(uploadedDraft())
        remote.completions += {
            throw AttachmentCommandException(
                "scan_unavailable",
                503,
                "The safety check is still running.",
                retryAfterSeconds = 75,
            )
        }
        remote.completions += { CompletedAttachmentUpload("server-1", "ready") }

        assertResultType(ListenableWorker.Result.success(), worker().doWork())
        assertEquals(listOf(75L), scheduler.delays)
        database.chatDao().markAttachmentFailure(
            "draft-1", "user-1", "conversation-1",
            "checking", "scan_unavailable", null, "2026-07-18T00:02:00Z",
        )
        assertResultType(ListenableWorker.Result.success(), worker().doWork())

        assertEquals(2, remote.completeCalls)
        assertEquals(0, remote.initializeCalls)
        assertEquals(0, transport.uploadCalls)
    }

    @Test
    fun staleProcessingResponseRetriesCompleteUntilReady() = runTest {
        database.chatDao().insertAttachmentDraft(uploadedDraft(attemptCount = 2))
        remote.completions += { CompletedAttachmentUpload("server-1", "processing") }
        remote.completions += { CompletedAttachmentUpload("server-1", "ready") }

        assertResultType(ListenableWorker.Result.retry(), worker().doWork())
        assertResultType(ListenableWorker.Result.success(), worker().doWork())

        assertEquals(2, remote.completeCalls)
        assertEquals(0, remote.initializeCalls)
        assertEquals(0, transport.uploadCalls)
    }

    @Test
    fun repeatedProcessingPollsBeyondFiveCallsEventuallyRecoverWithoutSpendingAttempts() = runTest {
        database.chatDao().insertAttachmentDraft(uploadedDraft())
        repeat(7) {
            remote.completions += { CompletedAttachmentUpload("server-1", "processing") }
        }
        remote.completions += { CompletedAttachmentUpload("server-1", "ready") }

        repeat(7) {
            assertResultType(ListenableWorker.Result.retry(), worker().doWork())
        }
        assertResultType(ListenableWorker.Result.success(), worker().doWork())

        val row = database.chatDao().attachmentDraft("draft-1")
        assertEquals("ready", row?.transferState)
        assertEquals(0, row?.attemptCount)
        assertEquals(8, remote.completeCalls)
        assertEquals(0, remote.initializeCalls)
        assertEquals(0, transport.uploadCalls)
    }

    @Test
    fun genuineCompletionFailuresExhaustTheFiveAttemptBudget() = runTest {
        database.chatDao().insertAttachmentDraft(uploadedDraft())
        repeat(5) { remote.completions += { throw java.io.IOException("offline") } }

        repeat(4) {
            assertResultType(ListenableWorker.Result.retry(), worker().doWork())
        }
        assertResultType(ListenableWorker.Result.failure(), worker().doWork())


        val row = database.chatDao().attachmentDraft("draft-1")
        assertEquals("failed_recoverable", row?.transferState)
        assertEquals("upload_unavailable", row?.failureCode)
        assertEquals(5, row?.attemptCount)
        assertEquals("server-1", row?.serverAttachmentId)
        assertEquals(5, remote.completeCalls)
        assertEquals(0, remote.initializeCalls)
        assertEquals(0, transport.uploadCalls)
    }

    private fun worker(): AttachmentUploadWorker = TestListenableWorkerBuilder
        .from(context, AttachmentUploadWorker::class.java)
        .setInputData(Data.Builder().putString("attachment-id", "draft-1").build())
        .setWorkerFactory(object : WorkerFactory() {
            override fun createWorker(
                appContext: Context,
                workerClassName: String,
                workerParameters: WorkerParameters,
            ): ListenableWorker? = AttachmentUploadWorker(
                appContext,
                workerParameters,
                database.chatDao(),
                remote,
                transport,
                retryScheduler = scheduler,
            )
        })
        .build()

    private fun uploadedDraft(attemptCount: Int = 0) = AttachmentDraftEntity(
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
        localPath = "/private/missing.webp",
        thumbnailPath = null,
        sha256 = "a".repeat(64),
        createdAt = "2026-07-18T00:00:00Z",
        updatedAt = "2026-07-18T00:00:00Z",
        expiresAt = "2026-07-25T00:00:00Z",
        clientUploadId = "upload-1",
        serverAttachmentId = "server-1",
        transferState = "checking",
        progressBytes = 100,
        attemptCount = attemptCount,
        tusUploadOffset = 100,
    )

    private fun assertResultType(expected: ListenableWorker.Result, actual: ListenableWorker.Result) {
        assertEquals(expected.javaClass, actual.javaClass)
    }
}

private class RecoveryRemote : ChatRemoteDataSource {
    override val authState = MutableStateFlow<ChatAuthState>(
        ChatAuthState.SignedIn("user-1", "user@example.com"),
    )
    val completions = ArrayDeque<() -> CompletedAttachmentUpload>()
    var initializeCalls = 0
    var completeCalls = 0

    override suspend fun initializeAttachmentUpload(
        command: InitializeAttachmentUpload,
    ): AttachmentUploadAuthorization {
        initializeCalls += 1
        error("Initialize must not run during completion recovery")
    }

    override suspend fun completeAttachmentUpload(attachmentId: String): CompletedAttachmentUpload {
        completeCalls += 1
        return completions.removeFirst().invoke()
    }

    override suspend fun signIn(email: String, password: String) = error("Unused")
    override suspend fun signOut() = error("Unused")
    override suspend fun listAuthorizedConversations() = error("Unused")
    override suspend fun loadMessages(
        conversation: AuthorizedConversation,
        cursor: space.fishhub.android.data.chat.model.ChatMessageCursor?,
    ) = error("Unused")
    override suspend fun loadReadStates(conversationId: String) = error("Unused")
    override suspend fun refreshAttachmentUrls(attachmentIds: List<String>) = error("Unused")
    override suspend fun cancelAttachmentUpload(attachmentId: String) = error("Unused")
    override suspend fun sendMessage(
        conversation: AuthorizedConversation,
        content: OutgoingMessageContent,
        clientRequestId: String,
    ) = error("Unused")
    override suspend fun reportGif(messageId: String) = error("Unused")
    override suspend fun markRead(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?,
    ) = error("Unused")
    override fun realtime(conversation: AuthorizedConversation): Flow<ChatRealtimeEvent> = emptyFlow()
}

private class RejectingTransport : AttachmentUploadTransport {
    var uploadCalls = 0

    override suspend fun upload(
        file: File,
        authorization: AttachmentUploadAuthorization,
        resumeUrl: String?,
        onSession: suspend (url: String, offset: Long) -> Unit,
        onProgress: suspend (sentBytes: Long) -> Unit,
    ) {
        uploadCalls += 1
        error("Upload must not run during completion recovery")
    }
}

private class CapturingScheduler : AttachmentUploadScheduler {
    val delays = mutableListOf<Long>()

    override fun enqueue(
        attachmentId: String,
        userId: String,
        replace: Boolean,
        initialDelaySeconds: Long,
    ) {
        delays += initialDelaySeconds
    }

    override fun cancel(attachmentId: String) = Unit
    override fun cancelUser(userId: String) = Unit
}
