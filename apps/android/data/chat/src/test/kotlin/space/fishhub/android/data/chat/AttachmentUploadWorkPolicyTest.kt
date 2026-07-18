package space.fishhub.android.data.chat

import androidx.work.BackoffPolicy
import androidx.work.NetworkType
import java.io.File
import java.time.Instant
import kotlin.io.path.createTempDirectory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.local.AttachmentDraftEntity

class AttachmentUploadWorkPolicyTest {
    @Test
    fun workRequiresConnectivityAndUsesExponentialBackoffWithScopedTags() {
        val request = attachmentUploadRequest("local-attachment", "user-one")

        assertEquals("local-attachment", request.workSpec.input.getString("attachment-id"))
        assertEquals(NetworkType.CONNECTED, request.workSpec.constraints.requiredNetworkType)
        assertEquals(BackoffPolicy.EXPONENTIAL, request.workSpec.backoffPolicy)
        assertTrue(request.workSpec.backoffDelayDuration >= 10_000)
        assertTrue(request.tags.any { it.startsWith("chat-attachment:") })
        assertTrue(request.tags.any { it.startsWith("chat-attachment-user:") })
    }

    @Test
    fun serverRetryAfterCreatesDelayedReplacementWithoutChangingBackoffPolicy() {
        val request = attachmentUploadRequest("local-attachment", "user-one", initialDelaySeconds = 75)

        assertEquals(75_000, request.workSpec.initialDelay)
        assertEquals(
            75L,
            attachmentRetryDelaySeconds(
                "2026-07-18T00:01:15Z",
                Instant.parse("2026-07-18T00:00:00Z"),
            ),
        )
        assertEquals(0L, attachmentRetryDelaySeconds("malformed", Instant.EPOCH))
    }

    @Test
    fun distinctRateLimitsUseServerDelayInsteadOfRapidWorkManagerRetries() {
        listOf("rate_limited_short", "rate_limited_daily").forEach { code ->
            assertTrue(isTransientAttachmentCommand(code, statusCode = 400))
        }
        assertEquals(
            45L,
            serverDirectedAttachmentRetryDelaySeconds(
                transient = true,
                attempt = 1,
                retryAfterSeconds = 45,
            ),
        )
        assertEquals(
            86_400L,
            serverDirectedAttachmentRetryDelaySeconds(
                transient = true,
                attempt = 4,
                retryAfterSeconds = 86_400,
            ),
        )
        assertEquals(
            null,
            serverDirectedAttachmentRetryDelaySeconds(
                transient = true,
                attempt = 5,
                retryAfterSeconds = 45,
            ),
        )
    }

    @Test
    fun retryCapRequiresManualActionAfterFifthTransientAttempt() {
        assertTrue(shouldAutomaticallyRetryAttachment(transient = true, attempt = 1))
        assertTrue(shouldAutomaticallyRetryAttachment(transient = true, attempt = 4))
        assertFalse(shouldAutomaticallyRetryAttachment(transient = true, attempt = 5))
        assertFalse(shouldAutomaticallyRetryAttachment(transient = false, attempt = 1))
    }

    @Test
    fun terminalReadyInitializationSkipsTheUploadPath() {
        assertTrue(isTerminalReadyAttachment("ready"))
        assertFalse(isTerminalReadyAttachment("pending"))
    }

    @Test
    fun completionTimeoutRetriesCompleteWithoutReturningToUpload() {
        val row = uploadedDraft(transferState = "checking")

        assertTrue(shouldResumeAttachmentCompletion(row))
        assertEquals(
            "checking",
            attachmentFailureState(row, "upload_unavailable", transient = true, attempt = 1),
        )
    }

    @Test
    fun pendingScanRetryRemainsInDurableCompletionPhase() {
        val row = uploadedDraft(transferState = "checking")

        assertTrue(shouldResumeAttachmentCompletion(row))
        assertEquals(
            "checking",
            attachmentFailureState(row, "scan_unavailable", transient = true, attempt = 2),
        )
    }

    @Test
    fun staleProcessingRetryUsesPersistedServerAttachmentInsteadOfReuploading() {
        val row = uploadedDraft(transferState = "checking", attemptCount = 3)

        assertTrue(shouldResumeAttachmentCompletion(row))
        assertEquals(
            "checking",
            attachmentFailureState(row, "processing", transient = true, attempt = 4),
        )
        assertFalse(shouldResumeAttachmentCompletion(row.copy(tusUploadOffset = 99, progressBytes = 99)))
    }

    @Test
    fun exhaustedCompletionRetryRequiresManualActionWithoutLosingServerState() {
        val row = uploadedDraft(transferState = "checking", attemptCount = 5)

        assertEquals(
            "failed_recoverable",
            attachmentFailureState(row, "processing", transient = true, attempt = 5),
        )
        assertTrue(shouldRecoverAttachmentTransfer(row.transferState, row.attemptCount))
        assertTrue(shouldResumeAttachmentCompletion(row))
    }

    @Test
    fun serverDirectedCompletionWaitsIgnoreUploadAttemptBudget() {
        assertTrue(isServerDirectedCompletionWait("attachment_not_ready", null))
        assertTrue(isServerDirectedCompletionWait("pending_scan", 30))
        assertTrue(isServerDirectedCompletionWait("processing", 45))
        assertTrue(isServerDirectedCompletionWait("scan_unavailable", 60))
        assertFalse(isServerDirectedCompletionWait("scan_unavailable", null))
        assertFalse(isServerDirectedCompletionWait("upload_unavailable", 30))
    }

    @Test
    fun rebootRecoveryIncludesOnlyActiveWorkBelowRetryCap() {
        assertTrue(shouldRecoverAttachmentTransfer("uploading", 2))
        assertTrue(shouldRecoverAttachmentTransfer("checking", 4))
        assertFalse(shouldRecoverAttachmentTransfer("failed_recoverable", 4))
        assertFalse(shouldRecoverAttachmentTransfer("uploading", 5))
        assertFalse(shouldRecoverAttachmentTransfer("ready", 0))
    }

    @Test
    fun userAndAttachmentWorkIdentitiesDoNotCrossAccounts() {
        assertNotEquals(
            WorkManagerAttachmentUploadScheduler.userTag("user-one"),
            WorkManagerAttachmentUploadScheduler.userTag("user-two"),
        )
        assertNotEquals(
            WorkManagerAttachmentUploadScheduler.workName("attachment-one"),
            WorkManagerAttachmentUploadScheduler.workName("attachment-two"),
        )
    }

    @Test
    fun scanUnavailableIsRetryableButMaliciousVerdictIsPermanent() {
        assertTrue(isTransientAttachmentCommand("scan_unavailable", 503))
        assertTrue(isTransientAttachmentCommand("processing", 409))
        assertFalse(isTransientAttachmentCommand("malware_detected", 422))
        assertFalse(isTransientAttachmentCommand("integrity_mismatch", 400))
    }

    @Test
    fun periodicMaintenanceUsesAStableDailyWorkRequest() {
        val request = attachmentMaintenanceRequest()

        assertEquals(24 * 60 * 60 * 1_000L, request.workSpec.intervalDuration)
        assertEquals("chat-attachment-maintenance", AttachmentMaintenanceWorkName)
    }

    @Test
    fun openedAttachmentCleanupDeletesOnlyExpiredCacheEntries() {
        val cache = createTempDirectory("fish-cache-").toFile()
        val directory = File(cache, OpenedAttachmentCacheDirectory).apply { mkdirs() }
        val expired = File(directory, "expired.pdf").apply {
            writeText("old")
            setLastModified(1_000)
        }
        val current = File(directory, "current.pdf").apply {
            writeText("new")
            setLastModified(3_000)
        }

        cleanupOpenedAttachmentCache(cache, olderThanEpochMillis = 2_000)

        assertFalse(expired.exists())
        assertTrue(current.exists())
        cache.deleteRecursively()
    }

    private fun uploadedDraft(
        transferState: String,
        attemptCount: Int = 1,
    ) = AttachmentDraftEntity(
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
        clientUploadId = "upload-1",
        serverAttachmentId = "server-1",
        transferState = transferState,
        progressBytes = 100,
        attemptCount = attemptCount,
        tusUploadOffset = 100,
    )
}
