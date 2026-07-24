package space.fishhub.android.data.chat.sharedcontent

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.LinkedHashMap

/** Opaque identity for one displayed thumbnail on the device. */
data class SharedContentThumbnailKey(
    val ownerIdentityId: String,
    val conversationId: String,
    val itemId: String,
    val contentVersion: String,
) {
    init {
        require(ownerIdentityId.isNotBlank())
        require(conversationId.isNotBlank())
        require(itemId.isNotBlank())
        require(contentVersion.isNotBlank())
    }

    val ownerFingerprint: String = sha256(ownerIdentityId)
    private val conversationFingerprint: String = sha256(conversationId)
    private val itemFingerprint: String = sha256(itemId)
    private val contentVersionFingerprint: String = sha256(contentVersion)

    /** Contains no raw owner, conversation, item, or provider value. */
    val opaqueRelativePath: String
        get() = "$ownerFingerprint/$conversationFingerprint/$itemFingerprint-$contentVersionFingerprint.thumb"

    override fun toString(): String =
        "SharedContentThumbnailKey(ownerFingerprint=$ownerFingerprint, opaqueRelativePath=$opaqueRelativePath)"

    private companion object {
        fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }
}

/** A bounded in-memory or displayed-thumbnail byte value. */
class SharedContentThumbnailBytes(bytes: ByteArray) {
    val bytes: ByteArray = bytes.copyOf()
    val size: Int get() = bytes.size

    override fun equals(other: Any?): Boolean =
        other is SharedContentThumbnailBytes && bytes.contentEquals(other.bytes)

    override fun hashCode(): Int = bytes.contentHashCode()

    override fun toString(): String = "SharedContentThumbnailBytes(size=$size)"
}

/** Binary-compatibility marker for the original Wave 0 cache-key name. */
@Deprecated("Use SharedContentThumbnailKey.")
class ThumbnailCacheKey private constructor()

/**
 * Bounded, owner-scoped thumbnail context.
 *
 * Lookahead bytes are held only in [stagedLookahead]. The only path that writes
 * a thumbnail file is [confirmDisplayed], after the caller has confirmed that
 * the item was actually rendered. Full-content bytes have no API in this type.
 */
class SharedContentThumbnailStore internal constructor(
    private val root: File,
    private val now: () -> Instant,
) {
    constructor(
        context: Context,
        now: () -> Instant = Instant::now,
    ) : this(
        root = File(context.applicationContext.noBackupFilesDir, ROOT_DIRECTORY),
        now = now,
    )

    private val canonicalRoot = root.canonicalFile
    private val stateLock = Any()
    private val fileSystemLock = Any()
    private val stagedLookahead = LinkedHashMap<SharedContentThumbnailKey, SharedContentThumbnailBytes>()
    private var stagedBytes = 0L
    private var revisionSequence = 0L
    private val keyRevisions = mutableMapOf<SharedContentThumbnailKey, Long>()
    private val ownerPurgeEpochs = mutableMapOf<String, Long>()
    private val conversationPurgeEpochs = mutableMapOf<Pair<String, String>, Long>()

    /** noBackupFilesDir is excluded from Android backup and device transfer. */
    val isBackupExcluded: Boolean = true

    init {
        canonicalRoot.mkdirs()
    }

    fun readDisplayed(key: SharedContentThumbnailKey): SharedContentThumbnailBytes? {
        return synchronized(fileSystemLock) {
            val file = containedFile(key) ?: return@synchronized null
            if (!file.isFile || file.length() !in 1..MAX_THUMBNAIL_BYTES) {
                return@synchronized null
            }
            val value = runCatching {
                SharedContentThumbnailBytes(file.readBytes())
            }.getOrNull() ?: return@synchronized null
            file.setLastModified(now().toEpochMilli())
            value
        }
    }

    /**
     * Returns bytes that are safe to render without promoting lookahead work
     * to durable storage. Promotion remains exclusive to [confirmDisplayed].
     */
    fun readRenderable(key: SharedContentThumbnailKey): SharedContentThumbnailBytes? =
        synchronized(stateLock) {
            stagedLookahead[key]?.let { SharedContentThumbnailBytes(it.bytes) }
        } ?: readDisplayed(key)

    fun stageLookahead(
        key: SharedContentThumbnailKey,
        bytes: ByteArray,
    ): Boolean {
        if (bytes.isEmpty() || bytes.size.toLong() > MAX_THUMBNAIL_BYTES) return false
        synchronized(stateLock) {
            stagedLookahead.remove(key)?.let { stagedBytes -= it.size }
            revisionSequence += 1
            keyRevisions[key] = revisionSequence
            stagedLookahead[key] = SharedContentThumbnailBytes(bytes)
            stagedBytes += bytes.size
            while (stagedBytes > MAX_STAGED_BYTES) {
                val oldest = stagedLookahead.entries.firstOrNull() ?: break
                stagedLookahead.remove(oldest.key)
                keyRevisions.remove(oldest.key)
                stagedBytes -= oldest.value.size
            }
            checkStagedAccountingLocked()
        }
        return true
    }

    fun stageLookahead(
        ownerIdentityId: String,
        conversationId: String,
        itemId: String,
        contentVersion: String,
        bytes: ByteArray,
    ): Boolean = stageLookahead(
        SharedContentThumbnailKey(ownerIdentityId, conversationId, itemId, contentVersion),
        bytes,
    )

    /** Promotes staged bytes only after display confirmation. */
    fun confirmDisplayed(key: SharedContentThumbnailKey): Boolean {
        val pending = synchronized(stateLock) {
            val staged = stagedLookahead[key] ?: return false
            PendingPromotion(
                bytes = SharedContentThumbnailBytes(staged.bytes),
                keyRevision = keyRevisions[key] ?: return false,
                ownerPurgeEpoch = ownerPurgeEpochs[key.ownerIdentityId] ?: 0,
                conversationPurgeEpoch =
                    conversationPurgeEpochs[key.ownerIdentityId to key.conversationId] ?: 0,
            )
        }
        val written = synchronized(fileSystemLock) {
            writeDisplayedAtomically(key, pending.bytes)
        }
        if (!written) return false

        val accepted = synchronized(stateLock) {
            val current = stagedLookahead[key]
            val currentRevision = keyRevisions[key]
            val generationStillCurrent =
                (ownerPurgeEpochs[key.ownerIdentityId] ?: 0) == pending.ownerPurgeEpoch &&
                    (conversationPurgeEpochs[key.ownerIdentityId to key.conversationId] ?: 0) ==
                    pending.conversationPurgeEpoch
            if (generationStillCurrent &&
                currentRevision == pending.keyRevision &&
                current != null
            ) {
                stagedLookahead.remove(key)
                keyRevisions.remove(key)
                stagedBytes -= current.size
                checkStagedAccountingLocked()
                true
            } else {
                false
            }
        }
        if (!accepted) {
            synchronized(fileSystemLock) {
                containedFile(key)?.delete()
            }
        }
        return accepted
    }

    fun confirmDisplayed(
        ownerIdentityId: String,
        conversationId: String,
        itemId: String,
        contentVersion: String,
    ): Boolean = confirmDisplayed(
        SharedContentThumbnailKey(ownerIdentityId, conversationId, itemId, contentVersion),
    )

    /** Removes old thumbnails, then least-recently displayed files to meet the cap. */
    fun prune(
        ownerIdentityId: String,
        maxBytes: Long = DEFAULT_MAX_BYTES,
        inactiveAfter: Duration = DEFAULT_INACTIVITY,
    ) {
        require(ownerIdentityId.isNotBlank())
        require(maxBytes >= 0)
        require(!inactiveAfter.isNegative)
        synchronized(fileSystemLock) {
            val ownerRoot = ownerRoot(ownerIdentityId) ?: return
            if (!ownerRoot.isDirectory) return
            val cutoff = now().minus(inactiveAfter).toEpochMilli()
            val files = thumbnailFiles(ownerRoot)
            files.filter { it.lastModified() <= cutoff }.forEach(File::delete)

            var remaining = thumbnailFiles(ownerRoot)
            var total = remaining.sumOf(File::length)
            if (total > maxBytes) {
                remaining = remaining.sortedBy(File::lastModified)
                for (file in remaining) {
                    if (total <= maxBytes) break
                    total -= file.length()
                    file.delete()
                }
            }
            removeEmptyDirectories(ownerRoot)
        }
    }

    /** Removes all runtime and displayed bytes for a verified owner and proves absence. */
    fun purgeOwner(ownerIdentityId: String): Boolean {
        require(ownerIdentityId.isNotBlank())
        synchronized(stateLock) {
            ownerPurgeEpochs[ownerIdentityId] = (ownerPurgeEpochs[ownerIdentityId] ?: 0) + 1
            removeStagedLocked { key -> key.ownerIdentityId == ownerIdentityId }
        }
        return synchronized(fileSystemLock) {
            val ownerRoot = ownerRoot(ownerIdentityId) ?: return@synchronized false
            deleteContainedTree(ownerRoot)
            !ownerRoot.exists()
        }
    }

    fun purgeConversation(ownerIdentityId: String, conversationId: String): Boolean {
        require(ownerIdentityId.isNotBlank())
        require(conversationId.isNotBlank())
        synchronized(stateLock) {
            val namespace = ownerIdentityId to conversationId
            conversationPurgeEpochs[namespace] = (conversationPurgeEpochs[namespace] ?: 0) + 1
            removeStagedLocked { key ->
                key.ownerIdentityId == ownerIdentityId && key.conversationId == conversationId
            }
        }
        return synchronized(fileSystemLock) {
            val path = File(ownerRoot(ownerIdentityId), sha256(conversationId))
            if (!isContained(path)) return@synchronized false
            deleteContainedTree(path)
            !path.exists()
        }
    }

    fun stagedCount(): Int = synchronized(stateLock) { stagedLookahead.size }

    internal fun stagedByteCount(): Long = synchronized(stateLock) {
        checkStagedAccountingLocked()
        stagedBytes
    }

    fun persistedFileCount(ownerIdentityId: String): Int = synchronized(fileSystemLock) {
        ownerRoot(ownerIdentityId)?.let(::thumbnailFiles)?.size ?: 0
    }

    fun persistedByteCount(ownerIdentityId: String): Long = synchronized(fileSystemLock) {
        ownerRoot(ownerIdentityId)?.let(::thumbnailFiles)?.sumOf(File::length) ?: 0L
    }

    private fun removeStagedLocked(predicate: (SharedContentThumbnailKey) -> Boolean) {
        val iterator = stagedLookahead.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (predicate(entry.key)) {
                stagedBytes -= entry.value.size
                keyRevisions.remove(entry.key)
                iterator.remove()
            }
        }
        checkStagedAccountingLocked()
    }

    private fun checkStagedAccountingLocked() {
        check(stagedBytes >= 0)
        check(stagedBytes == stagedLookahead.values.sumOf { it.size.toLong() })
        check(stagedBytes <= MAX_STAGED_BYTES)
    }

    private fun writeDisplayedAtomically(
        key: SharedContentThumbnailKey,
        bytes: SharedContentThumbnailBytes,
    ): Boolean {
        val destination = containedFile(key) ?: return false
        if (bytes.size == 0 || bytes.size.toLong() > MAX_THUMBNAIL_BYTES) return false
        destination.parentFile?.mkdirs()
        val temporary = File(destination.parentFile, ".${destination.name}.tmp")
        return try {
            FileOutputStream(temporary, false).use { output ->
                output.write(bytes.bytes)
                output.fd.sync()
            }
            try {
                Files.move(
                    temporary.toPath(),
                    destination.toPath(),
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING,
                )
            } catch (_: AtomicMoveNotSupportedException) {
                Files.move(
                    temporary.toPath(),
                    destination.toPath(),
                    StandardCopyOption.REPLACE_EXISTING,
                )
            }
            destination.setLastModified(now().toEpochMilli())
            true
        } catch (_: Throwable) {
            false
        } finally {
            temporary.delete()
        }
    }

    private fun containedFile(key: SharedContentThumbnailKey): File? {
        val candidate = File(canonicalRoot, key.opaqueRelativePath)
        return candidate.takeIf(::isContained)
    }

    private fun ownerRoot(ownerIdentityId: String): File? =
        File(canonicalRoot, sha256(ownerIdentityId)).takeIf(::isContained)

    private fun isContained(file: File): Boolean = runCatching {
        file.canonicalFile.toPath().startsWith(canonicalRoot.toPath())
    }.getOrDefault(false)

    private fun thumbnailFiles(directory: File): List<File> =
        if (!directory.exists()) emptyList() else Files.walk(directory.toPath()).use { stream ->
            stream.iterator().asSequence().filter { path ->
                Files.isRegularFile(path) && path.fileName.toString().endsWith(".thumb")
            }.map { it.toFile() }.toList()
        }

    private fun deleteContainedTree(directory: File) {
        if (!directory.exists() || !isContained(directory)) return
        Files.walk(directory.toPath()).use { stream ->
            stream.sorted(Comparator.reverseOrder()).forEach { path ->
                val file = path.toFile()
                if (isContained(file)) file.delete()
            }
        }
    }

    private fun removeEmptyDirectories(directory: File) {
        if (!directory.exists() || !isContained(directory)) return
        Files.walk(directory.toPath()).use { stream ->
            stream.sorted(Comparator.reverseOrder()).forEach { path ->
                val file = path.toFile()
                if (file != canonicalRoot && isContained(file) && file.isDirectory && file.listFiles().isNullOrEmpty()) {
                    file.delete()
                }
            }
        }
    }

    private companion object {
        const val ROOT_DIRECTORY = "shared-content-thumbnails"
        const val MAX_THUMBNAIL_BYTES = 8L * 1024L * 1024L
        const val MAX_STAGED_BYTES = 16L * 1024L * 1024L
        const val DEFAULT_MAX_BYTES = 64L * 1024L * 1024L
        val DEFAULT_INACTIVITY: Duration = Duration.ofDays(30)

        fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private data class PendingPromotion(
        val bytes: SharedContentThumbnailBytes,
        val keyRevision: Long,
        val ownerPurgeEpoch: Long,
        val conversationPurgeEpoch: Long,
    )
}
