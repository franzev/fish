package space.fishhub.android.data.chat

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import space.fishhub.android.data.chat.local.ChatDao

internal class AttachmentMaintenance(
    private val context: Context,
    private val dao: ChatDao,
    private val importer: LocalAttachmentImporter,
    private val now: () -> Instant = Instant::now,
) {
    suspend fun run() {
        val timestamp = now()
        val expired = dao.expiredAttachmentDrafts(timestamp.toString())
        importer.deleteAll(expired)
        dao.deleteExpiredAttachmentDrafts(timestamp.toString())

        val livePaths = dao.allAttachmentDrafts().flatMapTo(mutableSetOf()) { draft ->
            listOfNotNull(draft.localPath, draft.thumbnailPath)
        }
        val cutoff = timestamp.minus(AttachmentFileTtlDays, ChronoUnit.DAYS).toEpochMilli()
        importer.cleanupOrphans(livePaths, cutoff)
        cleanupOpenedAttachmentCache(context.cacheDir, cutoff)
    }
}

internal class AttachmentMaintenanceWorker(
    appContext: Context,
    params: WorkerParameters,
    private val maintenance: AttachmentMaintenance,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = try {
        maintenance.run()
        Result.success()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Throwable) {
        Result.retry()
    }
}

internal fun attachmentMaintenanceRequest() =
    PeriodicWorkRequestBuilder<AttachmentMaintenanceWorker>(
        AttachmentMaintenanceIntervalHours,
        TimeUnit.HOURS,
    ).build()

internal fun enqueueAttachmentMaintenance(context: Context) {
    WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
        AttachmentMaintenanceWorkName,
        ExistingPeriodicWorkPolicy.KEEP,
        attachmentMaintenanceRequest(),
    )
}

internal fun cleanupOpenedAttachmentCache(cacheDir: File, olderThanEpochMillis: Long) {
    val directory = File(cacheDir, OpenedAttachmentCacheDirectory)
    directory.listFiles()?.forEach { file ->
        if (file.lastModified() <= olderThanEpochMillis) file.deleteRecursively()
    }
    directory.delete()
}

const val OpenedAttachmentCacheDirectory = "chat-opened-attachments"
internal const val AttachmentMaintenanceWorkName = "chat-attachment-maintenance"
private const val AttachmentMaintenanceIntervalHours = 24L
private const val AttachmentFileTtlDays = 1L
