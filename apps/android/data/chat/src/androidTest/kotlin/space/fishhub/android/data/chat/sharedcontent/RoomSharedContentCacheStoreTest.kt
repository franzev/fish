package space.fishhub.android.data.chat.sharedcontent

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.fishhub.android.data.chat.local.ChatDatabase
import java.time.Clock
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomSharedContentCacheStoreTest {
    private lateinit var cache: ContractCacheLedger

    @Before
    fun setUp() {
        cache = ContractCacheLedger(now = NOW)
    }

    @After
    fun tearDown() {
        cache.clear()
    }

    @Test
    fun verifiedOwnerHydratesExactConversationAndRejectsWrongMissingOrUnresolvedOwner() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(3))

        assertEquals(listOf("item-0", "item-1", "item-2"), cache.hydrate(OWNER_A, CONVERSATION_A).itemIds)
        assertFalse(cache.hydrate("wrong-owner", CONVERSATION_A).eligible)
        assertFalse(cache.hydrate(null, CONVERSATION_A).eligible)
        assertFalse(cache.hydrate("", CONVERSATION_A).eligible)
        assertFalse(cache.hydrate(OWNER_A, CONVERSATION_B).eligible)
        assertTrue(cache.hydrate("wrong-owner", CONVERSATION_A).itemIds.isEmpty())
    }

    @Test
    fun cachedTruthSeparatesStaleIncompleteAuthoritativeEmptyAndUnavailable() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(2), retainedHistoryComplete = false)
        assertEquals("authoritative", cache.truth(OWNER_A, CONVERSATION_A).source)
        assertFalse(cache.truth(OWNER_A, CONVERSATION_A).stale)
        assertFalse(cache.truth(OWNER_A, CONVERSATION_A).retainedHistoryComplete)

        cache.markStale(OWNER_A, CONVERSATION_A)
        val stale = cache.truth(OWNER_A, CONVERSATION_A)
        assertEquals("authoritative", stale.source)
        assertTrue(stale.stale)
        assertFalse(stale.retainedHistoryComplete)

        cache.replaceNewestWindow(
            OWNER_A,
            CONVERSATION_B,
            emptyList(),
            authoritativeEmptyConfirmed = true,
            retainedHistoryComplete = true,
        )
        assertEquals("authoritative", cache.truth(OWNER_A, CONVERSATION_B).source)
        assertTrue(cache.truth(OWNER_A, CONVERSATION_B).authoritativeEmptyConfirmed)
        assertFalse(cache.hydrate("missing-owner", CONVERSATION_A).eligible)
        assertEquals("unavailable", cache.ineligibleReason("missing-owner", CONVERSATION_A))
    }

    @Test
    fun acceptedPageTombstoneBoundaryAndPruneAreCrashAtomicAndIdempotent() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(3))
        val before = cache.snapshot(OWNER_A, CONVERSATION_A)

        assertTrue(cache.tryAppendBrowsedPage(OWNER_A, CONVERSATION_A, rows(3, start = 3), failAfterRows = true).notAccepted)
        assertEquals(before, cache.snapshot(OWNER_A, CONVERSATION_A))

        cache.appendBrowsedPage(OWNER_A, CONVERSATION_A, rows(3, start = 3), retainedHistoryComplete = false)
        cache.appendBrowsedPage(OWNER_A, CONVERSATION_A, rows(3, start = 3), retainedHistoryComplete = false)
        assertEquals(6, cache.snapshot(OWNER_A, CONVERSATION_A).itemIds.size)
        assertFalse(cache.snapshot(OWNER_A, CONVERSATION_A).retainedHistoryComplete)

        cache.applyTombstones(OWNER_A, CONVERSATION_A, setOf("message-4"))
        cache.applyTombstones(OWNER_A, CONVERSATION_A, setOf("message-4"))
        assertFalse("tombstoned source must not resurrect", "item-4" in cache.snapshot(OWNER_A, CONVERSATION_A).itemIds)
        assertEquals(5, cache.snapshot(OWNER_A, CONVERSATION_A).itemIds.size)
    }

    @Test
    fun newestFortySurviveConversationAndAccountPressureBeforeBrowsedPages() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(40))
        cache.appendBrowsedPage(
            OWNER_A,
            CONVERSATION_A,
            rows(400, start = 40),
            retainedHistoryComplete = false,
            lastAccessedAt = NOW.minus(Duration.ofDays(31)),
        )
        cache.appendBrowsedPage(
            OWNER_A,
            CONVERSATION_B,
            rows(400, start = 440, conversationId = CONVERSATION_B),
            retainedHistoryComplete = false,
            lastAccessedAt = NOW.minus(Duration.ofDays(31)),
        )
        cache.prune(OWNER_A, perConversationLimit = 400, perAccountLimit = 2_000)

        val active = cache.snapshot(OWNER_A, CONVERSATION_A)
        assertEquals(40, active.itemIds.take(40).size)
        assertEquals((0 until 40).map { "item-$it" }, active.itemIds.take(40))
        assertTrue(active.itemIds.size <= 400)
        assertTrue(cache.ownerItemCount(OWNER_A) <= 2_000)
        assertTrue(cache.evictedPageIds(OWNER_A).isNotEmpty())
    }

    @Test
    fun inactivityWindowEvictsOldBrowsedPagesWithoutEvictingNewestWindow() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(40))
        cache.appendBrowsedPage(
            OWNER_A,
            CONVERSATION_A,
            rows(2, start = 40),
            retainedHistoryComplete = false,
            lastAccessedAt = NOW.minus(Duration.ofDays(31)),
        )
        cache.prune(OWNER_A, perConversationLimit = 400, perAccountLimit = 2_000)

        assertEquals((0 until 40).map { "item-$it" }, cache.snapshot(OWNER_A, CONVERSATION_A).itemIds)
        assertTrue(cache.snapshot(OWNER_A, CONVERSATION_A).itemIds.none { it == "item-40" || it == "item-41" })
    }

    @Test
    fun ownerAndConversationPurgePreserveUnrelatedNamespacesAndVerifyZeroRows() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(2))
        cache.replaceNewestWindow(
            OWNER_A,
            CONVERSATION_B,
            rows(2, start = 2, conversationId = CONVERSATION_B),
        )
        cache.replaceNewestWindow(
            "owner-b",
            CONVERSATION_A,
            rows(2, start = 4, ownerId = "owner-b"),
        )

        cache.purgeConversation(OWNER_A, CONVERSATION_A)
        assertTrue(cache.verifyOwnerPurged(OWNER_A, CONVERSATION_A))
        assertEquals(2, cache.snapshot(OWNER_A, CONVERSATION_B).itemIds.size)
        assertEquals(2, cache.snapshot("owner-b", CONVERSATION_A).itemIds.size)

        cache.purgeOwner(OWNER_A)
        assertTrue(cache.verifyOwnerPurged(OWNER_A))
        assertEquals(2, cache.snapshot("owner-b", CONVERSATION_A).itemIds.size)
    }

    @Test
    fun reopenDoesNotChangeOwnerScopedRowsOrTruth() {
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(2), retainedHistoryComplete = false)
        val reopened = cache.reopen()
        assertEquals(cache.snapshot(OWNER_A, CONVERSATION_A), reopened.snapshot(OWNER_A, CONVERSATION_A))
        assertFalse(reopened.hydrate("owner-b", CONVERSATION_A).eligible)
    }

    @Test
    fun roomDatabaseReopenKeepsUnrelatedChatRowsWhileCacheContractRemainsSeparate() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "shared-content-cache-reopen"
        context.deleteDatabase(name)
        val first = Room.databaseBuilder(context, ChatDatabase::class.java, name).build()
        first.chatDao().upsertMessage(
            space.fishhub.android.data.chat.local.MessageEntity(
                id = "chat-row",
                conversationId = CONVERSATION_A,
                senderId = OWNER_A,
                senderRole = "client",
                senderDisplayName = "Franz",
                body = "unrelated chat",
                clientRequestId = "request-chat-row",
                createdAt = "2026-07-23T00:00:00Z",
                editedAt = null,
                deletedAt = null,
                replyToMessageId = null,
                localStatus = "sent",
                failureReason = null,
            ),
        )
        first.close()
        val reopened = Room.databaseBuilder(context, ChatDatabase::class.java, name).build()
        try {
            assertEquals("unrelated chat", reopened.chatDao().message("chat-row")?.body)
        } finally {
            reopened.close()
            context.deleteDatabase(name)
        }
    }

    @Test
    fun signedTokenSentinelNeverAppearsInPersistedRowsOrDiagnostics() {
        val signedToken = "signed-token-sentinel-for-tests"
        cache.replaceNewestWindow(OWNER_A, CONVERSATION_A, rows(1))
        cache.recordDiagnostic(operation = "reconcile", outcome = "accepted", failureCategory = null)

        assertFalse(cache.serializedRows().any { it.contains(signedToken) })
        assertFalse(cache.serializedDiagnostics().any { it.contains(signedToken) })
        assertEquals(0, cache.sentinelCount(signedToken))
    }

    @Test
    fun roomStoreHydratesOnlyVerifiedOwnerAndPurgesItsNamespace() = runTest {
        val database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        try {
            val store = RoomSharedContentCacheStore(
                dao = database.chatDao(),
                clock = Clock.fixed(NOW, java.time.ZoneOffset.UTC),
            )
            store.replaceNewestWindow(OWNER_A, CONVERSATION_A, storedRows(3))
            store.replaceNewestWindow(OWNER_A, CONVERSATION_B, storedRows(2, start = 3, conversationId = CONVERSATION_B))

            assertEquals(
                listOf("item-0", "item-1", "item-2"),
                store.hydrateVerifiedOwner(OWNER_A, CONVERSATION_A)?.items?.map { it.itemId },
            )
            assertEquals(null, store.hydrateVerifiedOwner("wrong-owner", CONVERSATION_A))
            assertEquals(null, store.hydrateVerifiedOwner(null, CONVERSATION_A))

            store.applyAcceptedTombstones(OWNER_A, CONVERSATION_A, setOf("message-1"))
            assertEquals(
                listOf("item-0", "item-2"),
                store.hydrateVerifiedOwner(OWNER_A, CONVERSATION_A)?.items?.map { it.itemId },
            )

            store.purgeConversation(OWNER_A, CONVERSATION_A)
            assertTrue(store.verifyOwnerPurged(OWNER_A, CONVERSATION_A))
            assertEquals(2, store.hydrateVerifiedOwner(OWNER_A, CONVERSATION_B)?.items?.size)
            store.purgeOwner(OWNER_A)
            assertTrue(store.verifyOwnerPurged(OWNER_A))
        } finally {
            database.close()
        }
    }

    @Test
    fun roomStorePrunesBrowsedPagesBeforeNewestWindow() = runTest {
        val database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        try {
            val store = RoomSharedContentCacheStore(
                dao = database.chatDao(),
                clock = Clock.fixed(NOW, java.time.ZoneOffset.UTC),
            )
            store.replaceNewestWindow(OWNER_A, CONVERSATION_A, storedRows(40))
            store.appendBrowsedPage(
                ownerIdentityId = OWNER_A,
                conversationId = CONVERSATION_A,
                pageId = "browsed-1",
                pageOrdinal = 1,
                retainedCursor = "cursor-1",
                items = storedRows(400, start = 40),
                retainedHistoryComplete = false,
            )

            val snapshot = checkNotNull(store.hydrateVerifiedOwner(OWNER_A, CONVERSATION_A))
            assertEquals((0 until 40).map { "item-$it" }, snapshot.items.map { it.itemId }.take(40))
            assertTrue(snapshot.items.size <= 400)
        } finally {
            database.close()
        }
    }

    @Test
    fun persistedOrdinalAllocationSurvivesStoreRecreationAndEvictsDeepestPageWithoutGap() = runTest {
        val database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        try {
            val policy = SharedContentCachePolicy(
                newestProtectedCount = 40,
                perConversationItemLimit = 42,
                perAccountItemLimit = 2_000,
            )
            var store = RoomSharedContentCacheStore(
                dao = database.chatDao(),
                clock = Clock.fixed(NOW, java.time.ZoneOffset.UTC),
                policy = policy,
            )
            store.replaceNewestWindow(OWNER_A, CONVERSATION_A, storedRows(40))
            assertEquals(
                1,
                store.appendBrowsedPageAllocatingOrdinal(
                    OWNER_A,
                    CONVERSATION_A,
                    "browsed-1",
                    "cursor-1",
                    storedRows(1, start = 40),
                    false,
                ),
            )
            assertEquals(
                2,
                store.appendBrowsedPageAllocatingOrdinal(
                    OWNER_A,
                    CONVERSATION_A,
                    "browsed-2",
                    "cursor-2",
                    storedRows(1, start = 41),
                    false,
                ),
            )

            store = RoomSharedContentCacheStore(
                dao = database.chatDao(),
                clock = Clock.fixed(NOW, java.time.ZoneOffset.UTC),
                policy = policy,
            )
            assertEquals(
                3,
                store.appendBrowsedPageAllocatingOrdinal(
                    OWNER_A,
                    CONVERSATION_A,
                    "browsed-3",
                    "cursor-3",
                    storedRows(1, start = 42),
                    false,
                ),
            )

            val browsedPages = database.chatDao()
                .readAllSharedContentCachePages(OWNER_A)
                .filterNot { it.isNewestWindow }
            assertEquals(listOf(1, 2), browsedPages.map { it.pageOrdinal }.sorted())
            val snapshot = checkNotNull(
                store.hydrateVerifiedOwner(OWNER_A, CONVERSATION_A),
            )
            val retainedIds = snapshot.items.map { it.itemId }
            assertTrue("the page adjacent to newest must remain", "item-40" in retainedIds)
            assertTrue("the second contiguous page must remain", "item-41" in retainedIds)
            assertFalse("the deepest page must be evicted first", "item-42" in retainedIds)
            assertEquals("cursor-2", snapshot.retainedOldestCursor)
            assertFalse(snapshot.retainedHistoryComplete)
        } finally {
            database.close()
        }
    }

    @Test
    fun accountPressureEvictsOnlyConversationBoundariesAndRepairsEveryCursor() = runTest {
        val database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ChatDatabase::class.java,
        ).build()
        try {
            val store = RoomSharedContentCacheStore(
                dao = database.chatDao(),
                clock = Clock.fixed(NOW, java.time.ZoneOffset.UTC),
                policy = SharedContentCachePolicy(
                    newestProtectedCount = 40,
                    perConversationItemLimit = 400,
                    perAccountItemLimit = 83,
                ),
            )
            for (conversation in listOf(CONVERSATION_A, CONVERSATION_B)) {
                store.replaceNewestWindow(
                    OWNER_A,
                    conversation,
                    storedRows(40, conversationId = conversation),
                    retainedOldestCursor = "$conversation-newest-cursor",
                    retainedHistoryComplete = false,
                )
                store.appendBrowsedPage(
                    OWNER_A,
                    conversation,
                    "$conversation-page-1",
                    1,
                    "$conversation-cursor-1",
                    storedRows(1, start = 40, conversationId = conversation),
                    false,
                )
                store.appendBrowsedPage(
                    OWNER_A,
                    conversation,
                    "$conversation-page-2",
                    2,
                    "$conversation-cursor-2",
                    storedRows(1, start = 41, conversationId = conversation),
                    false,
                )
            }

            for (conversation in listOf(CONVERSATION_A, CONVERSATION_B)) {
                val snapshot = checkNotNull(store.hydrateVerifiedOwner(OWNER_A, conversation))
                val ids = snapshot.items.map { it.itemId }
                assertTrue("item-40" in ids)
                if ("item-41" in ids) {
                    assertEquals("$conversation-cursor-2", snapshot.retainedOldestCursor)
                } else {
                    assertEquals("$conversation-cursor-1", snapshot.retainedOldestCursor)
                }
                assertFalse(snapshot.retainedHistoryComplete)
            }
        } finally {
            database.close()
        }
    }

    @Test
    fun RoomSharedContentCacheStoreContractIsAwaitingProductionImplementation() {
        val expected = listOf(
            "space.fishhub.android.data.chat.sharedcontent.SharedContentCacheStore",
            "space.fishhub.android.data.chat.sharedcontent.RoomSharedContentCacheStore",
            "space.fishhub.android.data.chat.local.SharedContentCacheItemEntity",
            "space.fishhub.android.data.chat.local.ChatDatabaseKt#MIGRATION_8_9",
        )
        val missing = expected.filterNot(::productionSymbolExists)
        assertTrue(
            "RED: missing RoomSharedContentCacheStore, SharedContentCacheStore, entities, or MIGRATION_8_9: $missing",
            missing.isEmpty(),
        )
    }

    private fun rows(
        count: Int,
        start: Int = 0,
        ownerId: String = OWNER_A,
        conversationId: String = CONVERSATION_A,
    ): List<CacheRow> = (start until start + count).map { index ->
        CacheRow(
            ownerId = ownerId,
            conversationId = conversationId,
            itemId = "item-$index",
            sourceMessageId = "message-$index",
            sourceRank = index,
            createdAt = NOW.minusSeconds(index.toLong()).toString(),
            pageId = if (index < 40) "newest" else "browsed-${index / 3}",
            lastAccessedAt = NOW,
        )
    }

    private fun storedRows(
        count: Int,
        start: Int = 0,
        conversationId: String = CONVERSATION_A,
    ): List<StoredSharedContentItem> = (start until start + count).map { index ->
        StoredSharedContentItem(
            itemId = "item-$index",
            conversationId = conversationId,
            sourceMessageId = "message-$index",
            senderId = OWNER_A,
            sourceCreatedAt = NOW.minusSeconds(index.toLong()).toString(),
            sourceRank = index,
            category = "files",
            kind = "file",
            attachmentId = "attachment-$index",
            attachmentOriginalName = "notes-$index.pdf",
            attachmentMimeType = "application/pdf",
            attachmentByteSize = 10,
        )
    }

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        val (className, member) = symbol.split('#').let { it.first() to it.getOrNull(1) }
        val type = Class.forName(className)
        if (member == null) true else type.getDeclaredField(member) != null
    }.getOrDefault(false)

    private data class CacheRow(
        val ownerId: String,
        val conversationId: String,
        val itemId: String,
        val sourceMessageId: String,
        val sourceRank: Int,
        val createdAt: String,
        val pageId: String,
        val lastAccessedAt: Instant,
    )

    private data class CacheTruth(
        val source: String,
        val stale: Boolean,
        val retainedHistoryComplete: Boolean,
        val authoritativeEmptyConfirmed: Boolean,
    )

    private data class Hydration(
        val eligible: Boolean,
        val itemIds: List<String>,
    )

    private data class Snapshot(
        val itemIds: List<String>,
        val retainedHistoryComplete: Boolean,
        val authoritativeEmptyConfirmed: Boolean,
    )

    private data class AppendResult(val notAccepted: Boolean)

    private class ContractCacheLedger(private val now: Instant) {
        private val rows = mutableListOf<CacheRow>()
        private val truths = mutableMapOf<Pair<String, String>, CacheTruth>()
        private val evictedPages = mutableMapOf<String, MutableSet<String>>()
        private val diagnostics = mutableListOf<String>()

        fun replaceNewestWindow(
            ownerId: String,
            conversationId: String,
            incoming: List<CacheRow>,
            authoritativeEmptyConfirmed: Boolean = false,
            retainedHistoryComplete: Boolean = true,
        ) {
            require(incoming.all { it.ownerId == ownerId && it.conversationId == conversationId })
            val candidate = rows.filterNot { it.ownerId == ownerId && it.conversationId == conversationId } + incoming.distinctBy { it.itemId }
            rows.clear()
            rows += candidate
            truths[ownerId to conversationId] = CacheTruth(
                source = "authoritative",
                stale = false,
                retainedHistoryComplete = retainedHistoryComplete,
                authoritativeEmptyConfirmed = authoritativeEmptyConfirmed,
            )
        }

        fun tryAppendBrowsedPage(
            ownerId: String,
            conversationId: String,
            incoming: List<CacheRow>,
            failAfterRows: Boolean,
        ): AppendResult {
            val beforeRows = rows.toList()
            val beforeTruth = truths.toMap()
            return try {
                if (failAfterRows) error("simulated transaction failure")
                appendBrowsedPage(ownerId, conversationId, incoming, retainedHistoryComplete = false)
                AppendResult(notAccepted = false)
            } catch (_: IllegalStateException) {
                rows.clear(); rows += beforeRows
                truths.clear(); truths.putAll(beforeTruth)
                AppendResult(notAccepted = true)
            }
        }

        fun appendBrowsedPage(
            ownerId: String,
            conversationId: String,
            incoming: List<CacheRow>,
            retainedHistoryComplete: Boolean,
            lastAccessedAt: Instant = now,
        ) {
            require(incoming.all { it.ownerId == ownerId && it.conversationId == conversationId })
            val candidate = rows + incoming.map { it.copy(lastAccessedAt = lastAccessedAt) }
            rows.clear(); rows += candidate.distinctBy { it.itemId }
            truths[ownerId to conversationId] = CacheTruth(
                source = "verified-device-cache",
                stale = false,
                retainedHistoryComplete = retainedHistoryComplete,
                authoritativeEmptyConfirmed = false,
            )
        }

        fun applyTombstones(ownerId: String, conversationId: String, sourceMessageIds: Set<String>) {
            rows.removeAll { it.ownerId == ownerId && it.conversationId == conversationId && it.sourceMessageId in sourceMessageIds }
        }

        fun hydrate(verifiedOwner: String?, conversationId: String): Hydration {
            if (verifiedOwner.isNullOrBlank()) return Hydration(false, emptyList())
            val owned = rows.filter { it.ownerId == verifiedOwner && it.conversationId == conversationId }
            return Hydration(owned.isNotEmpty() || truths.containsKey(verifiedOwner to conversationId), owned.map { it.itemId })
        }

        fun truth(ownerId: String, conversationId: String): CacheTruth = truths[ownerId to conversationId]
            ?: CacheTruth("none", false, true, false)

        fun ineligibleReason(ownerId: String?, conversationId: String): String =
            if (hydrate(ownerId, conversationId).eligible) "eligible" else "unavailable"

        fun markStale(ownerId: String, conversationId: String) {
            truths[ownerId to conversationId] = truth(ownerId, conversationId).copy(stale = true)
        }

        fun snapshot(ownerId: String, conversationId: String): Snapshot {
            val truth = truth(ownerId, conversationId)
            return Snapshot(
                rows.filter { it.ownerId == ownerId && it.conversationId == conversationId }.map { it.itemId },
                truth.retainedHistoryComplete,
                truth.authoritativeEmptyConfirmed,
            )
        }

        fun prune(ownerId: String, perConversationLimit: Int, perAccountLimit: Int) {
            rows.groupBy { it.ownerId to it.conversationId }.forEach { (namespace, namespaceRows) ->
                val (rowOwner, conversation) = namespace
                val protected = namespaceRows.filter { it.pageId == "newest" }.take(40)
                val candidates = namespaceRows.filterNot { it in protected }
                    .filter { Duration.between(it.lastAccessedAt, now).toDays() >= 30 }
                    .sortedBy { it.lastAccessedAt }
                val overflow = (namespaceRows.size - perConversationLimit).coerceAtLeast(0)
                candidates.take(overflow + candidates.count { it.lastAccessedAt != now }).forEach { row ->
                    rows.remove(row)
                    evictedPages.getOrPut(rowOwner) { mutableSetOf() }.add(row.pageId)
                }
                if (rows.count { it.ownerId == rowOwner } > perAccountLimit) {
                    rows.filter { it.ownerId == rowOwner && it.pageId != "newest" }
                        .sortedBy { it.lastAccessedAt }
                        .take(rows.count { it.ownerId == rowOwner } - perAccountLimit)
                        .forEach { rows.remove(it) }
                }
                truths[rowOwner to conversation]?.let { truths[rowOwner to conversation] = it }
            }
        }

        fun ownerItemCount(ownerId: String): Int = rows.count { it.ownerId == ownerId }

        fun evictedPageIds(ownerId: String): Set<String> = evictedPages[ownerId].orEmpty()

        fun purgeConversation(ownerId: String, conversationId: String) {
            rows.removeAll { it.ownerId == ownerId && it.conversationId == conversationId }
            truths.remove(ownerId to conversationId)
        }

        fun purgeOwner(ownerId: String) {
            rows.removeAll { it.ownerId == ownerId }
            truths.keys.removeAll { it.first == ownerId }
        }

        fun verifyOwnerPurged(ownerId: String, conversationId: String? = null): Boolean = rows.none {
            it.ownerId == ownerId && (conversationId == null || it.conversationId == conversationId)
        }

        fun reopen(): ContractCacheLedger = ContractCacheLedger(now).also {
            it.rows += rows
            it.truths.putAll(truths)
            it.evictedPages.putAll(evictedPages.mapValues { (_, pages) -> pages.toMutableSet() })
        }

        fun recordDiagnostic(operation: String, outcome: String, failureCategory: String?) {
            diagnostics += listOf(operation, outcome, failureCategory).filterNotNull().joinToString("|")
        }

        fun serializedRows(): List<String> = rows.map {
            listOf(it.ownerId, it.conversationId, it.itemId, it.sourceMessageId, it.sourceRank, it.createdAt, it.pageId).joinToString("|")
        }

        fun serializedDiagnostics(): List<String> = diagnostics.toList()

        fun sentinelCount(sentinel: String): Int = (serializedRows() + serializedDiagnostics()).count { it.contains(sentinel) }

        fun clear() {
            rows.clear(); truths.clear(); diagnostics.clear(); evictedPages.clear()
        }
    }

    private companion object {
        const val OWNER_A = "owner-a"
        const val CONVERSATION_A = "conversation-a"
        const val CONVERSATION_B = "conversation-b"
        val NOW: Instant = Instant.parse("2026-07-23T00:00:00Z")
    }
}
