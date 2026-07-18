package space.fishhub.android.data.chat

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.ListenableWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import java.io.File
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.concurrent.TimeUnit
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import space.fishhub.android.data.chat.local.ChatDao
import space.fishhub.android.data.chat.local.AttachmentDraftEntity
import space.fishhub.android.data.chat.remote.AttachmentCommandException
import space.fishhub.android.data.chat.remote.ChatRemoteDataSource
import space.fishhub.android.data.chat.remote.InitializeAttachmentUpload

internal interface AttachmentUploadScheduler {
    fun enqueue(
        attachmentId: String,
        userId: String,
        replace: Boolean = false,
        initialDelaySeconds: Long = 0,
    )
    fun cancel(attachmentId: String)
    fun cancelUser(userId: String)
}

internal class WorkManagerAttachmentUploadScheduler(
    private val context: Context,
) : AttachmentUploadScheduler {
    override fun enqueue(
        attachmentId: String,
        userId: String,
        replace: Boolean,
        initialDelaySeconds: Long,
    ) {
        val request = attachmentUploadRequest(attachmentId, userId, initialDelaySeconds)
        workManager().enqueueUniqueWork(
            workName(attachmentId),
            if (replace) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
            request,
        )
    }

    override fun cancel(attachmentId: String) {
        workManager().cancelUniqueWork(workName(attachmentId))
    }

    override fun cancelUser(userId: String) {
        workManager().cancelAllWorkByTag(userTag(userId))
    }

    private fun workManager() = WorkManager.getInstance(context.applicationContext)

    companion object {
        internal fun workName(attachmentId: String) = "chat-attachment-${stableId(attachmentId)}"
        internal fun attachmentTag(attachmentId: String) = "chat-attachment:${stableId(attachmentId)}"
        internal fun userTag(userId: String) = "chat-attachment-user:${stableId(userId)}"
    }
}

internal fun attachmentUploadRequest(
    attachmentId: String,
    userId: String,
    initialDelaySeconds: Long = 0,
) =
    OneTimeWorkRequestBuilder<AttachmentUploadWorker>()
        .setInputData(Data.Builder().putString(AttachmentIdKey, attachmentId).build())
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build(),
        )
        .setInitialDelay(initialDelaySeconds.coerceAtLeast(0), TimeUnit.SECONDS)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, MinimumBackoffSeconds, TimeUnit.SECONDS)
        .addTag(WorkManagerAttachmentUploadScheduler.attachmentTag(attachmentId))
        .addTag(WorkManagerAttachmentUploadScheduler.userTag(userId))
        .build()

internal fun shouldRecoverAttachmentTransfer(state: String, attemptCount: Int): Boolean =
    state == CheckingState ||
        (attemptCount < MaximumAutomaticAttempts && state in RecoverableActiveStates)

internal fun shouldAutomaticallyRetryAttachment(transient: Boolean, attempt: Int): Boolean =
    transient && attempt < MaximumAutomaticAttempts

internal fun isTerminalReadyAttachment(status: String): Boolean = status == ReadyState

internal fun shouldResumeAttachmentCompletion(row: AttachmentDraftEntity): Boolean =
    row.serverAttachmentId != null && row.byteSize > 0 &&
        (row.tusUploadOffset >= row.byteSize || row.progressBytes >= row.byteSize)

internal fun attachmentFailureState(
    row: AttachmentDraftEntity,
    failureCode: String,
    transient: Boolean,
    attempt: Int,
    resetsUploadedState: Boolean = false,
): String {
    val mayRetry = shouldAutomaticallyRetryAttachment(transient, attempt)
    val awaitsCompletion = !resetsUploadedState && shouldResumeAttachmentCompletion(row)
    return when {
        failureCode == "sign_in_required" -> SignInRequiredState
        mayRetry && (awaitsCompletion ||
            failureCode in setOf("scan_unavailable", "processing")) -> CheckingState
        mayRetry -> WaitingState
        transient -> FailedRecoverableState
        else -> FailedPermanentState
    }
}

internal fun attachmentRetryDelaySeconds(retryAfter: String?, now: Instant): Long {
    val target = retryAfter?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return 0
    val remaining = Duration.between(now, target)
    if (remaining.isNegative || remaining.isZero) return 0
    return remaining.seconds + if (remaining.nano > 0) 1 else 0
}

internal fun serverDirectedAttachmentRetryDelaySeconds(
    transient: Boolean,
    attempt: Int,
    retryAfterSeconds: Long?,
): Long? = retryAfterSeconds
    ?.coerceAtLeast(0)
    ?.takeIf { it > 0 && shouldAutomaticallyRetryAttachment(transient, attempt) }

internal fun isServerDirectedCompletionWait(
    code: String,
    retryAfterSeconds: Long?,
): Boolean = code == "attachment_not_ready" ||
    (retryAfterSeconds != null && code in setOf("pending_scan", "processing", "scan_unavailable"))

internal fun isTransientAttachmentCommand(code: String, statusCode: Int): Boolean =
    code in TransientCommandCodes || statusCode in setOf(408, 425, 429) || statusCode >= 500

internal class AttachmentUploadWorkerFactory(
    private val dao: ChatDao,
    private val remote: ChatRemoteDataSource,
    private val transport: AttachmentUploadTransport,
    private val importer: LocalAttachmentImporter,
) : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? = when (workerClassName) {
        AttachmentUploadWorker::class.java.name -> AttachmentUploadWorker(
            appContext = appContext,
            params = workerParameters,
            dao = dao,
            remote = remote,
            transport = transport,
            retryScheduler = WorkManagerAttachmentUploadScheduler(appContext),
        )
        AttachmentMaintenanceWorker::class.java.name -> AttachmentMaintenanceWorker(
            appContext,
            workerParameters,
            AttachmentMaintenance(appContext, dao, importer),
        )
        else -> null
    }
}

internal class AttachmentUploadWorker(
    appContext: Context,
    params: WorkerParameters,
    private val dao: ChatDao,
    private val remote: ChatRemoteDataSource,
    private val transport: AttachmentUploadTransport,
    private val now: () -> Instant = Instant::now,
    private val retryScheduler: AttachmentUploadScheduler =
        WorkManagerAttachmentUploadScheduler(appContext),
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = TransferSlots.withPermit {
        val localId = inputData.getString(AttachmentIdKey) ?: return@withPermit Result.failure()
        val initial = dao.attachmentDraft(localId) ?: return@withPermit Result.success()
        if (initial.scope != ComposerScope || initial.transferState in TerminalWithoutWork) {
            return@withPermit Result.success()
        }
        val deferredSeconds = attachmentRetryDelaySeconds(initial.retryAfter, now())
        if (deferredSeconds > 0) {
            retryScheduler.enqueue(
                localId,
                initial.userId,
                replace = true,
                initialDelaySeconds = deferredSeconds,
            )
            return@withPermit Result.success()
        }
        when (val auth = remote.authState.value) {
            ChatAuthState.Loading -> return@withPermit Result.retry()
            ChatAuthState.SignedOut -> {
                dao.markAttachmentFailure(
                    localId, initial.userId, initial.conversationId,
                    SignInRequiredState, "sign_in_required", null, now().toString(),
                )
                return@withPermit Result.failure()
            }
            is ChatAuthState.SignedIn -> if (auth.userId != initial.userId) {
                dao.markAttachmentFailure(
                    localId, initial.userId, initial.conversationId,
                    FailedPermanentState, "identity_changed", null, now().toString(),
                )
                return@withPermit Result.failure()
            }
        }
        val resumeCompletion = shouldResumeAttachmentCompletion(initial)
        if (!resumeCompletion && initial.attemptCount >= MaximumAutomaticAttempts) {
            dao.markAttachmentFailure(
                localId, initial.userId, initial.conversationId,
                FailedRecoverableState, "retry_limit", null, now().toString(),
            )
            return@withPermit Result.failure()
        }
        val claimed = dao.claimAttachmentTransfer(
            localId, initial.userId, initial.conversationId,
            if (resumeCompletion) CheckingState else InitializingState,
            MaximumAutomaticAttempts,
            consumeAttempt = !resumeCompletion,
            updatedAt = now().toString(),
        )
        if (claimed != 1) return@withPermit Result.success()
        try {
            val current = dao.attachmentDraft(localId) ?: return@withPermit Result.success()
            if (resumeCompletion) {
                return@withPermit completePersistedAttachment(
                    current,
                    checkNotNull(current.serverAttachmentId),
                )
            }
            val authorization = remote.initializeAttachmentUpload(
                InitializeAttachmentUpload(
                    conversationId = current.conversationId,
                    clientUploadId = current.clientUploadId.ifBlank { current.id },
                    originalName = current.displayName,
                    sourceMimeType = current.sourceMimeType,
                    sourceByteSize = current.sourceByteSize.takeIf { it > 0 } ?: current.byteSize,
                    uploadSha256 = current.sha256,
                ),
            )
            if (isTerminalReadyAttachment(authorization.status)) {
                dao.markAttachmentReady(
                    current.id,
                    current.userId,
                    current.conversationId,
                    authorization.attachmentId,
                    ReadyState,
                    now().toString(),
                )
                return@withPermit Result.success()
            }
            val file = verifiedPrivateFile(current.localPath)
                ?: throw AttachmentTransferException("local_copy_unavailable", transient = false)
            val resumedUrl = current.tusUploadUrl.takeIf {
                current.serverAttachmentId == authorization.attachmentId &&
                    current.tusExpiresAt?.let(::isFuture) == true
            }
            dao.recordAttachmentSession(
                current.id, current.userId, current.conversationId,
                authorization.attachmentId, resumedUrl, current.tusUploadOffset,
                authorization.expiresAt, UploadingState, now().toString(),
            )
            var lastProgressWriteAt = 0L
            var lastProgress = current.progressBytes
            transport.upload(
                file = file,
                authorization = authorization,
                resumeUrl = resumedUrl,
                onSession = { url, offset ->
                    dao.recordAttachmentSession(
                        current.id, current.userId, current.conversationId,
                        authorization.attachmentId, url, offset,
                        authorization.expiresAt, UploadingState, now().toString(),
                    )
                },
                onProgress = { sent ->
                    val clock = System.nanoTime() / 1_000_000L
                    val boundary = sent == current.byteSize || sent - lastProgress >= ProgressBoundaryBytes
                    if (boundary || clock - lastProgressWriteAt >= ProgressWriteIntervalMs) {
                        dao.recordAttachmentProgress(
                            current.id, current.userId, current.conversationId,
                            sent.coerceAtMost(current.byteSize), sent.coerceAtMost(current.byteSize),
                            UploadingState, now().toString(),
                        )
                        lastProgress = maxOf(lastProgress, sent)
                        lastProgressWriteAt = clock
                    }
                },
            )
            dao.recordAttachmentProgress(
                current.id, current.userId, current.conversationId,
                current.byteSize, current.byteSize, CheckingState, now().toString(),
            )
            completePersistedAttachment(current, authorization.attachmentId)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            val failedRow = dao.attachmentDraft(localId) ?: return@withPermit Result.success()
            handleFailure(
                row = failedRow,
                error = error,
                attemptAlreadyConsumed = !resumeCompletion,
            )
        }
    }

    private suspend fun completePersistedAttachment(
        row: AttachmentDraftEntity,
        attachmentId: String,
    ): Result {
        val completed = remote.completeAttachmentUpload(attachmentId)
        if (completed.status != ReadyState) {
            throw AttachmentTransferException("attachment_not_ready", transient = true)
        }
        dao.markAttachmentReady(
            row.id,
            row.userId,
            row.conversationId,
            completed.attachmentId,
            ReadyState,
            now().toString(),
        )
        return Result.success()
    }

    private suspend fun handleFailure(
        row: AttachmentDraftEntity,
        error: Throwable,
        attemptAlreadyConsumed: Boolean,
    ): Result {
        val classified = classify(error)
        val completionWait = shouldResumeAttachmentCompletion(row) &&
            isServerDirectedCompletionWait(classified.code, classified.retryAfterSeconds)
        val resetsUploadedState = when {
            error is AttachmentCommandException && error.code in ServerIdentityResetCodes -> {
                dao.rotateAttachmentUploadIdentity(
                    row.id, row.userId, row.conversationId,
                    UUID.randomUUID().toString(), now().toString(),
                )
                true
            }
            error is AttachmentTransferException && error.resetSession -> {
                dao.clearAttachmentUploadSession(
                    row.id, row.userId, row.conversationId, now().toString(),
                )
                true
            }
            else -> false
        }
        val retryAfter = classified.retryAfterSeconds?.let { now().plusSeconds(it).toString() }
        var effectiveAttempt = row.attemptCount
        var state = attachmentFailureState(
            row = row,
            failureCode = classified.code,
            transient = classified.transient,
            attempt = effectiveAttempt,
            resetsUploadedState = resetsUploadedState,
        )
        when {
            completionWait -> {
                state = CheckingState
                dao.markAttachmentFailure(
                    row.id, row.userId, row.conversationId,
                    state, classified.code, retryAfter, now().toString(),
                )
            }
            !attemptAlreadyConsumed -> {
                val nextAttempt = (effectiveAttempt + 1).coerceAtMost(MaximumAutomaticAttempts)
                state = attachmentFailureState(
                    row = row,
                    failureCode = classified.code,
                    transient = classified.transient,
                    attempt = nextAttempt,
                    resetsUploadedState = resetsUploadedState,
                )
                val consumed = dao.markAttachmentFailureConsumingAttempt(
                    row.id, row.userId, row.conversationId,
                    state, classified.code, retryAfter,
                    MaximumAutomaticAttempts, now().toString(),
                )
                if (consumed == 0) {
                    state = if (classified.transient) FailedRecoverableState else FailedPermanentState
                    dao.markAttachmentFailure(
                        row.id, row.userId, row.conversationId,
                        state, classified.code, retryAfter, now().toString(),
                    )
                }
                effectiveAttempt = dao.attachmentDraft(row.id)?.attemptCount ?: nextAttempt
            }
            else -> dao.markAttachmentFailure(
                row.id, row.userId, row.conversationId,
                state, classified.code, retryAfter, now().toString(),
            )
        }
        val mayRetry = completionWait ||
            shouldAutomaticallyRetryAttachment(classified.transient, effectiveAttempt)
        val delaySeconds = if (completionWait) {
            classified.retryAfterSeconds?.coerceAtLeast(0)?.takeIf { it > 0 }
        } else {
            serverDirectedAttachmentRetryDelaySeconds(
                classified.transient,
                effectiveAttempt,
                classified.retryAfterSeconds,
            )
        }
        if (delaySeconds != null) {
            retryScheduler.enqueue(
                row.id,
                row.userId,
                replace = true,
                initialDelaySeconds = delaySeconds,
            )
            return Result.success()
        }
        return if (mayRetry) Result.retry() else Result.failure()
    }

    private fun classify(error: Throwable): ClassifiedFailure = when (error) {
        is AttachmentTransferException -> ClassifiedFailure(
            error.code, error.transient, error.retryAfterSeconds,
        )
        is AttachmentCommandException -> ClassifiedFailure(
            code = error.code,
            transient = isTransientAttachmentCommand(error.code, error.statusCode),
            retryAfterSeconds = error.retryAfterSeconds,
        )
        else -> ClassifiedFailure("upload_unavailable", transient = true)
    }

    private fun verifiedPrivateFile(path: String): File? {
        val root = File(applicationContext.noBackupFilesDir, AttachmentDraftDirectory)
        val canonicalRoot = runCatching { root.canonicalFile.toPath() }.getOrNull() ?: return null
        val file = runCatching { File(path).canonicalFile }.getOrNull() ?: return null
        return file.takeIf { it.isFile && it.length() > 0 && it.toPath().startsWith(canonicalRoot) }
    }

    private fun isFuture(value: String): Boolean = runCatching {
        Instant.parse(value).isAfter(now().plusSeconds(SessionExpirySkewSeconds))
    }.getOrDefault(false)

    private data class ClassifiedFailure(
        val code: String,
        val transient: Boolean,
        val retryAfterSeconds: Long? = null,
    )

    companion object {
        private val TransferSlots = Semaphore(2)
    }
}

private fun stableId(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { "%02x".format(it) }
    .take(24)

private const val AttachmentIdKey = "attachment-id"
private const val AttachmentDraftDirectory = "chat-attachment-drafts"
private const val ComposerScope = "composer"
private const val WaitingState = "waiting_for_network"
private const val InitializingState = "initializing"
private const val UploadingState = "uploading"
private const val CheckingState = "checking"
private const val ReadyState = "ready"
private const val FailedRecoverableState = "failed_recoverable"
private const val FailedPermanentState = "failed_permanent"
private const val SignInRequiredState = "sign_in_required"
private const val MinimumBackoffSeconds = 10L
private const val MaximumAutomaticAttempts = 5
private const val ProgressWriteIntervalMs = 250L
private const val ProgressBoundaryBytes = 512L * 1024L
private const val SessionExpirySkewSeconds = 60L

private val TerminalWithoutWork = setOf(ReadyState, "failed_permanent", "cancelled", "cancelling")
private val TransientCommandCodes = setOf(
    "rate_limited",
    "rate_limited_short",
    "rate_limited_daily",
    "attachment_not_ready",
    "pending_scan",
    "upload_expired",
    "missing_upload",
    "processing",
    "processing_failed",
    "scan_unavailable",
    "delivery_unavailable",
    "upload_unavailable",
    "upload_conflict",
)
private val ServerIdentityResetCodes = setOf("upload_expired", "missing_upload", "upload_conflict")
private val RecoverableActiveStates = setOf(
    "selected", "waiting_for_network", "initializing", "uploading", "checking",
)
