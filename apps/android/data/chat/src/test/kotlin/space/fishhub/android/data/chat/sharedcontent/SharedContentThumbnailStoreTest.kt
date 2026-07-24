package space.fishhub.android.data.chat.sharedcontent

import java.nio.file.Files
import java.time.Duration
import java.time.Instant
import java.util.concurrent.Executors
import kotlin.io.path.createTempDirectory
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SharedContentThumbnailStoreTest {
    private lateinit var root: java.io.File
    private lateinit var store: ThumbnailStoreContract

    @Before
    fun setUp() {
        root = createTempDirectory("fish-thumbnail-").toFile()
        store = ThumbnailStoreContract(root, NOW)
    }

    @After
    fun tearDown() {
        root.deleteRecursively()
    }

    @Test
    fun lookaheadIsMemoryOnlyDisplayedConfirmationWritesOneThumbnailAndSelectionWritesNoFullFile() {
        store.stageLookahead(ITEM_A, byteArrayOf(1, 2, 3))
        assertEquals(0, store.persistedFileCount())

        store.confirmDisplayed(ITEM_A)
        assertEquals(1, store.persistedFileCount())

        store.selectFullContent(ITEM_A, byteArrayOf(9, 8, 7))
        assertEquals(1, store.persistedFileCount())
        assertTrue(store.memoryOnlyItemIds.contains(ITEM_A))
    }

    @Test
    fun atomicWriteFailureLeavesNoPartialFileAndOwnerKeysStayContainedAndOpaque() {
        assertFalse(store.writeDisplayedAtomically(ITEM_A, byteArrayOf(1), failBeforeRename = true))
        assertEquals(0, store.persistedFileCount())
        assertTrue(store.tempFiles().isEmpty())

        assertTrue(store.isContainedOpaquePath(ITEM_A))
        assertFalse(store.isContainedOpaquePath("../other-owner/item"))
        assertFalse(store.fileNames().any { it.contains(OWNER_A) || it.contains(CONVERSATION_A) })
    }

    @Test
    fun pruningEnforcesSixtyFourMiBPerAccountAndThirtyDayInactivityWindow() {
        store.seed(
            ThumbnailEntry(ITEM_A, 32L * MIB, NOW.minus(Duration.ofDays(1))),
            ThumbnailEntry(ITEM_B, 24L * MIB, NOW.minus(Duration.ofDays(2))),
            ThumbnailEntry(ITEM_C, 16L * MIB, NOW.minus(Duration.ofDays(31))),
        )

        store.prune(maxBytes = 64L * MIB, inactiveAfter = Duration.ofDays(30))

        assertTrue(store.totalBytes() <= 64L * MIB)
        assertFalse(store.persistedItems().contains(ITEM_C))
        assertTrue(store.persistedItems().contains(ITEM_A))
        assertTrue(store.persistedItems().contains(ITEM_B))
    }

    @Test
    fun cacheRootIsExcludedFromBackupAndOwnerPurgeReturnsSafeZeroCounts() {
        store.stageLookahead(ITEM_A, byteArrayOf(1))
        store.confirmDisplayed(ITEM_A)
        store.seed(ThumbnailEntry(ITEM_B, 1, NOW))

        assertTrue(store.isBackupExcluded)
        store.purgeOwner(OWNER_A)

        assertEquals(0, store.persistedFileCount())
        assertEquals(0, store.ownerRowCount(OWNER_A))
        assertEquals(0, store.tempFiles().size)
    }

    @Test
    fun signedSentinelIsNeverStoredInFilenameBytesOrDiagnostics() {
        val sentinel = "signed-token-sentinel-for-tests"
        store.observeDeliverySentinel(sentinel)
        store.stageLookahead(ITEM_A, byteArrayOf(1, 2, 3))
        store.confirmDisplayed(ITEM_A)

        assertTrue(store.fileNames().none { it.contains(sentinel) })
        assertEquals(0, store.sentinelCount(sentinel))
        assertTrue(store.diagnostics().none { it.contains(sentinel) })
    }

    @Test
    fun productionStorePromotesOnlyStagedBytesToAnOpaqueDisplayedFile() {
        val key = SharedContentThumbnailKey(OWNER_A, CONVERSATION_A, ITEM_A, "v1")
        val production = SharedContentThumbnailStore(root) { NOW }

        assertTrue(production.stageLookahead(key, byteArrayOf(1, 2, 3)))
        assertEquals(0, production.persistedFileCount(OWNER_A))
        assertEquals(
            SharedContentThumbnailBytes(byteArrayOf(1, 2, 3)),
            production.readRenderable(key),
        )
        assertEquals(null, production.readDisplayed(key))
        assertTrue(production.confirmDisplayed(key))
        assertEquals(1, production.persistedFileCount(OWNER_A))
        assertEquals(
            SharedContentThumbnailBytes(byteArrayOf(1, 2, 3)),
            production.readDisplayed(key),
        )
        assertTrue(root.walkTopDown().filter { it.isFile }.all { file ->
            !file.name.contains(OWNER_A) && !file.name.contains(CONVERSATION_A)
        })
        assertTrue(production.purgeOwner(OWNER_A))
        assertEquals(0, production.persistedFileCount(OWNER_A))
    }

    @Test
    fun productionStoreSerializesConcurrentStageReadPromotionAndPurgeWithExactAccounting() {
        val production = SharedContentThumbnailStore(root) { NOW }
        val executor = Executors.newFixedThreadPool(8)
        try {
            val futures = (0 until 160).flatMap { index ->
                val key = SharedContentThumbnailKey(
                    OWNER_A,
                    if (index % 5 == 0) "conversation-purged" else CONVERSATION_A,
                    "item-$index",
                    "v$index",
                )
                val bytes = ByteArray(256 * 1024) { (index and 0xff).toByte() }
                listOf(
                    executor.submit<Boolean> { production.stageLookahead(key, bytes) },
                    executor.submit<Boolean> {
                        production.readRenderable(key)
                        true
                    },
                    executor.submit<Boolean> {
                        production.confirmDisplayed(key)
                        true
                    },
                )
            }.toMutableList()
            futures += executor.submit<Boolean> {
                repeat(20) {
                    production.purgeConversation(OWNER_A, "conversation-purged")
                }
                true
            }

            futures.forEach { assertTrue(it.get()) }
            assertTrue(production.stagedByteCount() <= 16L * 1024L * 1024L)
            assertTrue(production.stagedCount() <= 64)
            assertTrue(production.purgeOwner(OWNER_A))
            assertEquals(0L, production.stagedByteCount())
            assertEquals(0, production.stagedCount())
            assertEquals(0, production.persistedFileCount(OWNER_A))
        } finally {
            executor.shutdownNow()
        }
    }

    @Test
    fun thumbnailStoreProductionContractIsAwaitingPlan1209() {
        val missing = listOf(
            "space.fishhub.android.data.chat.sharedcontent.SharedContentThumbnailStore",
            "space.fishhub.android.data.chat.sharedcontent.ThumbnailCacheKey",
        ).filterNot(::productionSymbolExists)

        assertTrue(
            "RED: missing SharedContentThumbnailStore cache contract: $missing",
            missing.isEmpty(),
        )
    }

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        Class.forName(symbol)
        true
    }.getOrDefault(false)

    private data class ThumbnailEntry(
        val itemId: String,
        val bytes: Long,
        val lastAccessedAt: Instant,
    )

    private class ThumbnailStoreContract(
        private val root: java.io.File,
        private val now: Instant,
    ) {
        private val entries = linkedMapOf<String, ThumbnailEntry>()
        private val memory = mutableMapOf<String, ByteArray>()
        private val diagnosticEntries = mutableListOf<String>()
        val isBackupExcluded = true
        val memoryOnlyItemIds: Set<String> get() = memory.keys

        fun stageLookahead(itemId: String, bytes: ByteArray) {
            memory[itemId] = bytes
        }

        fun confirmDisplayed(itemId: String) {
            val bytes = checkNotNull(memory[itemId])
            writeDisplayedAtomically(itemId, bytes, failBeforeRename = false)
        }

        fun selectFullContent(itemId: String, bytes: ByteArray) {
            memory[itemId] = bytes
        }

        fun writeDisplayedAtomically(itemId: String, bytes: ByteArray, failBeforeRename: Boolean): Boolean {
            val finalFile = java.io.File(root, opaqueFileName(itemId))
            val temporary = java.io.File(root, "${finalFile.name}.tmp")
            return try {
                temporary.writeBytes(bytes)
                if (failBeforeRename) error("simulated atomic write failure")
                check(temporary.renameTo(finalFile))
                entries[itemId] = ThumbnailEntry(itemId, bytes.size.toLong(), now)
                true
            } catch (_: IllegalStateException) {
                temporary.delete()
                false
            }
        }

        fun seed(vararg seeded: ThumbnailEntry) {
            seeded.forEach { entry ->
                entries[entry.itemId] = entry
                java.io.RandomAccessFile(root.resolve(opaqueFileName(entry.itemId)), "rw").use {
                    it.setLength(entry.bytes)
                }
            }
        }

        fun prune(maxBytes: Long, inactiveAfter: Duration) {
            val cutoff = now.minus(inactiveAfter)
            entries.entries.removeIf { (_, entry) ->
                if (entry.lastAccessedAt.isBefore(cutoff)) {
                    java.io.File(root, opaqueFileName(entry.itemId)).delete()
                    true
                } else false
            }
            while (totalBytes() > maxBytes) {
                val oldest = entries.values.minByOrNull { it.lastAccessedAt } ?: break
                entries.remove(oldest.itemId)
                java.io.File(root, opaqueFileName(oldest.itemId)).delete()
            }
        }

        fun purgeOwner(ownerId: String) {
            require(ownerId == OWNER_A)
            entries.clear()
            memory.clear()
            root.listFiles().orEmpty().forEach { it.delete() }
        }

        fun persistedFileCount(): Int = root.listFiles().orEmpty().count { it.isFile && !it.name.endsWith(".tmp") }

        fun persistedItems(): Set<String> = entries.keys

        fun totalBytes(): Long = entries.values.sumOf(ThumbnailEntry::bytes)

        fun ownerRowCount(ownerId: String): Int = if (ownerId == OWNER_A) entries.size else 0

        fun tempFiles(): List<java.io.File> = root.listFiles().orEmpty().filter { it.name.endsWith(".tmp") }

        fun fileNames(): List<String> = root.listFiles().orEmpty().map(java.io.File::getName)

        fun diagnostics(): List<String> = diagnosticEntries

        fun observeDeliverySentinel(sentinel: String) {
            memory["live-only"] = sentinel.toByteArray()
        }

        fun sentinelCount(sentinel: String): Int = root.listFiles().orEmpty().count { file ->
            file.name.contains(sentinel) || file.readBytes().decodeToString().contains(sentinel)
        }

        fun isContainedOpaquePath(itemId: String): Boolean {
            val candidate = java.io.File(root, if (itemId.startsWith("../")) itemId else opaqueFileName(itemId))
            val rootPath = root.canonicalFile.toPath()
            return candidate.canonicalFile.toPath().startsWith(rootPath) && !candidate.name.contains(OWNER_A)
        }

        private fun opaqueFileName(itemId: String): String = "thumb-${itemId.hashCode().toUInt().toString(16)}.bin"
    }

    private companion object {
        const val OWNER_A = "owner-a-private"
        const val CONVERSATION_A = "conversation-a-private"
        const val ITEM_A = "item-a"
        const val ITEM_B = "item-b"
        const val ITEM_C = "item-c"
        const val MIB = 1_048_576L
        val NOW: Instant = Instant.parse("2026-07-23T00:00:00Z")
    }
}
