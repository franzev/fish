package space.fishhub.android.data.chat.sharedcontent

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SharedContentRepositoryTest {
    @Test
    fun limit40RetainsIndexesZeroThrough39UsesIndex39CursorAndIndex40OnlyAsHasMore() {
        val remote = FakeRemote()
        val cache = FakeCache()
        val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
        remote.next = page(rows(41), request = request())

        val result = repository.refresh(request())

        assertEquals(listOf(40), remote.requestedLimits)
        assertEquals(40, result.page.items.size)
        assertEquals((0 until 40).map(::itemId), result.page.items.map { it.itemId })
        assertEquals(Cursor(39), result.page.nextCursor)
        assertTrue(result.page.hasMore)
        assertEquals((0..40).toList(), remote.inspectedIndexes)
        assertFalse(41 in remote.inspectedIndexes)
        assertEquals((0 until 40).map(::itemId), cache.items.map { it.itemId })
        assertFalse("continuation sentinel must never render", itemId(40) in cache.items.map { it.itemId })
    }

    @Test
    fun exactlyFortyRowsStillDerivesCursorFromRetainedIndex39WithoutSentinel() {
        val remote = FakeRemote()
        val cache = FakeCache()
        val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
        remote.next = page(rows(40), request = request())

        val result = repository.refresh(request())

        assertFalse(result.page.hasMore)
        assertEquals(Cursor(39), result.page.nextCursor)
        assertEquals((0 until 40).toList(), remote.inspectedIndexes)
        assertFalse("only retained rows may reach cache", itemId(40) in cache.items.map { it.itemId })
    }

    @Test
    fun responseOverFortyOneRowsIsRejectedBeforeIndex41CanBeAccessed() {
        val remote = FakeRemote()
        val cache = FakeCache().also { it.items += item(900) }
        val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
        remote.next = page(rows(42), request = request())

        val result = repository.refresh(request())

        assertEquals(Outcome.Rejected, result.outcome)
        assertEquals(listOf(900), cache.items.map { it.sourceRank })
        assertTrue(remote.inspectedIndexes.isEmpty())
        assertFalse(41 in remote.inspectedIndexes)
    }

    @Test
    fun mixedConversationMalformedOrderUnknownKindAndIncompleteRowsRejectWholeResponseWithoutCacheMutation() {
        val cases = listOf(
            "mixedConversation" to rows(3).mapIndexed { index, value ->
                if (index == 1) value.copy(conversationId = OTHER_CONVERSATION) else value
            },
            "malformedOrder" to rows(3).let { it[0].copy(orderKey = 0) }.let { bad ->
                listOf(bad) + rows(2, start = 1)
            },
            "unknownKind" to rows(3).mapIndexed { index, value ->
                if (index == 1) value.copy(kind = "unknown") else value
            },
            "incompleteNormalizedShape" to rows(3).mapIndexed { index, value ->
                if (index == 1) value.copy(itemId = "") else value
            },
        )

        cases.forEach { (name, invalidRows) ->
            val remote = FakeRemote()
            val cache = FakeCache().also { it.items += item(900) }
            val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
            remote.next = page(invalidRows, request = request())

            val result = repository.refresh(request())

            assertEquals(name, Outcome.Rejected, result.outcome)
            assertEquals(name, listOf(900), cache.items.map { it.sourceRank })
        }
    }

    @Test
    fun strictWireRowsRequireExactTwentyNineFieldsAndNullableNonNegativeDuration() {
        val validDurations = listOf(null, 0L, 90_500L)

        validDurations.forEach { duration ->
            val remote = FakeRemote()
            val cache = FakeCache()
            val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
            remote.next = page(
                listOf(item(0).copy(category = "voice", kind = "voice", durationMs = duration)),
                request = request(),
            )

            val result = repository.refresh(request())

            assertEquals("duration=$duration", Outcome.Accepted, result.outcome)
            assertEquals("duration=$duration", duration, result.page.items.single().durationMs)
        }

        val invalidRows = listOf(
            "missing duration field" to item(0).copy(
                wireFields = NORMALIZED_FIELDS - "duration_ms",
            ),
            "extra field" to item(0).copy(
                wireFields = NORMALIZED_FIELDS + "delivery_url",
            ),
            "negative duration" to item(0).copy(
                category = "voice",
                kind = "voice",
                durationMs = -1,
            ),
        )
        invalidRows.forEach { (name, invalid) ->
            val remote = FakeRemote()
            val cache = FakeCache().also { it.items += item(900) }
            val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
            remote.next = page(listOf(invalid), request = request())

            assertEquals(name, Outcome.Rejected, repository.refresh(request()).outcome)
            assertEquals(name, listOf(900), cache.items.map { it.sourceRank })
        }
    }

    @Test
    fun legacyNullDurationRemainsNullWithoutDeliveryAuthorityFallback() {
        val remote = FakeRemote()
        val cache = FakeCache()
        val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
        remote.next = page(
            listOf(item(0).copy(category = "voice", kind = "voice", durationMs = null)),
            request = request(),
        )

        val result = repository.refresh(request())

        assertEquals(Outcome.Accepted, result.outcome)
        assertEquals(null, result.page.items.single().durationMs)
        assertTrue(
            "duration fallback must not add delivery authority fields",
            result.page.items.single().wireFields.none(FORBIDDEN_WIRE_FIELD::containsMatchIn),
        )
    }

    @Test
    fun ownerGenerationRequestCursorAndReplaceAcceptanceAreRequiredBeforeMutation() {
        val scenarios = listOf(
            "wrong owner" to request(ownerId = OTHER_OWNER),
            "stale generation" to request(generation = 9),
            "wrong request" to request(requestId = "different-request"),
            "wrong cursor" to request(cursor = Cursor(7)),
            "wrong replace mode" to request(replace = false),
        )

        scenarios.forEach { (name, attempted) ->
            val remote = FakeRemote()
            val cache = FakeCache().also { it.items += item(900) }
            val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)
            remote.next = page(rows(2), request = request())

            val result = repository.refresh(attempted)

            assertEquals(name, Outcome.Rejected, result.outcome)
            assertEquals(name, listOf(900), cache.items.map { it.sourceRank })
        }
    }

    @Test
    fun membershipDenialMakesCacheIneligibleInsteadOfUsingCachedAuthority() {
        val remote = FakeRemote()
        val cache = FakeCache().also { it.items += item(900) }
        val repository = ContractRepository(
            auth = FakeAuth(member = false),
            remote = remote,
            network = FakeNetwork(),
            cache = cache,
        )
        remote.next = page(rows(2), request = request())

        val result = repository.refresh(request())

        assertEquals(Outcome.Denied, result.outcome)
        assertTrue(cache.items.isEmpty())
        assertTrue(cache.purgedNamespaces.contains(OWNER to CONVERSATION))
    }

    @Test
    fun acceptedReplaceAppendAndTombstoneResultsRemainDuplicateFreeAndIdempotent() {
        val remote = FakeRemote()
        val cache = FakeCache()
        val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)

        remote.next = page(rows(2), request = request())
        assertEquals(Outcome.Accepted, repository.refresh(request()).outcome)
        remote.next = page(rows(2, start = 1), request = request(cursor = Cursor(1), replace = false))
        assertEquals(Outcome.Accepted, repository.refresh(request(cursor = Cursor(1), replace = false)).outcome)
        assertEquals(listOf(0, 1, 2), cache.items.map { it.sourceRank })

        repository.applyTombstone("message-1")
        repository.applyTombstone("message-1")
        assertEquals(listOf(0, 2), cache.items.map { it.sourceRank })
        assertEquals(3, cache.mutationCount)
    }

    @Test
    fun refreshFailureRetainsVerifiedCacheAndRecordsOnlyRedactedDiagnosticFields() {
        val remote = FakeRemote(failure = true)
        val cache = FakeCache().also { it.items += item(900) }
        val repository = ContractRepository(FakeAuth(), remote, FakeNetwork(), cache)

        val result = repository.refresh(request())

        assertEquals(Outcome.Failure, result.outcome)
        assertEquals(listOf(900), cache.items.map { it.sourceRank })
        assertEquals(1, repository.diagnostics.size)
        assertEquals(
            setOf("operation", "outcome", "durationMs", "failureCategory"),
            repository.diagnostics.single().keys,
        )
        assertTrue(repository.diagnostics.single().values.none { it.contains(SECRET_SENTINEL) })
    }

    @Test
    fun providerRepositoryContractsRemainProviderNeutralAndAwaitProductionImplementation() {
        val expected = listOf(
            "SharedContentDataCursor",
            "SharedContentDataItem",
            "SharedContentDataPage",
            "SharedContentRequestToken",
            "DefaultChatRepository#refreshSharedContent",
            "DefaultChatRepository#observeSharedContentSnapshot",
            "ChatRemoteDataSource#listConversationSharedContent",
        )
        val missing = expected.filterNot(::productionSymbolExists)
        assertTrue(
            "RED: missing provider-neutral shared-content repository contracts: $missing",
            missing.isEmpty(),
        )
        assertTrue(
            "test ports must not expose Room or Supabase types",
            listOf(FakeAuth::class, FakeRemote::class, FakeNetwork::class, FakeCache::class)
                .flatMap { it.java.declaredFields.toList() }
                .none { field ->
                    field.type.name.contains("Room") || field.type.name.contains("Supabase")
                },
        )
    }

    @Test
    fun phaseThirteenRequiresDurationOnBothWireAndProviderNeutralItems() {
        val expected = listOf(
            "space.fishhub.android.data.chat.remote.SharedContentRowDto#durationMs",
            "space.fishhub.android.data.chat.SharedContentDataItem#durationMs",
        )
        val missing = expected.filterNot(::productionFieldExists)
        assertTrue(
            "RED: missing Phase 13 29th shared-content wire field and safe duration metadata: $missing",
            missing.isEmpty(),
        )
    }

    private data class Cursor(val sourceRank: Int)

    private data class Item(
        val itemId: String,
        val conversationId: String,
        val sourceMessageId: String,
        val sourceRank: Int,
        val orderKey: Int,
        val category: String = "media",
        val kind: String = "photo",
        val durationMs: Long? = null,
        val wireFields: Set<String> = NORMALIZED_FIELDS,
    )

    private data class Request(
        val ownerId: String = OWNER,
        val conversationId: String = CONVERSATION,
        val generation: Long = 1,
        val cycleId: String = "cycle-1",
        val requestId: String = "request-1",
        val pLimit: Int = 40,
        val cursor: Cursor? = null,
        val replace: Boolean = true,
    )

    private data class RemotePage(
        val rows: List<Item>,
        val ownerId: String,
        val conversationId: String,
        val generation: Long,
        val cycleId: String,
        val requestId: String,
        val requestedCursor: Cursor?,
        val replace: Boolean,
    )

    private data class Page(
        val items: List<Item>,
        val hasMore: Boolean,
        val nextCursor: Cursor?,
    )

    private enum class Outcome { Accepted, Rejected, Denied, Failure }

    private data class RefreshResult(val outcome: Outcome, val page: Page = Page(emptyList(), false, null))

    private interface AuthPort {
        val ownerId: String?
        val generation: Long
        val member: Boolean
    }

    private interface RemotePort {
        fun fetch(request: Request): RemotePage
    }

    private interface NetworkPort {
        val usable: Boolean
    }

    private interface CachePort {
        val items: MutableList<Item>
        fun replace(items: List<Item>)
        fun append(items: List<Item>)
        fun tombstone(sourceMessageId: String)
        fun purge(ownerId: String, conversationId: String)
    }

    private class FakeAuth(
        override val ownerId: String? = OWNER,
        override val generation: Long = 1,
        override val member: Boolean = true,
    ) : AuthPort

    private class FakeRemote(
        var failure: Boolean = false,
    ) : RemotePort {
        lateinit var next: RemotePage
        val inspectedIndexes = mutableListOf<Int>()
        val requestedLimits = mutableListOf<Int>()

        override fun fetch(request: Request): RemotePage {
            if (failure) error(SECRET_SENTINEL)
            requestedLimits += request.pLimit
            if (next.rows.size <= 41) inspectedIndexes += next.rows.indices
            return next
        }
    }

    private class FakeNetwork(override val usable: Boolean = true) : NetworkPort

    private class FakeCache : CachePort {
        override val items = mutableListOf<Item>()
        val purgedNamespaces = mutableSetOf<Pair<String, String>>()
        var mutationCount = 0

        override fun replace(items: List<Item>) {
            this.items.clear(); this.items += items; mutationCount++
        }

        override fun append(items: List<Item>) {
            this.items += items.filterNot { candidate -> this.items.any { it.itemId == candidate.itemId } }
            mutationCount++
        }

        override fun tombstone(sourceMessageId: String) {
            val size = items.size
            items.removeAll { it.sourceMessageId == sourceMessageId }
            if (items.size != size) mutationCount++
        }

        override fun purge(ownerId: String, conversationId: String) {
            items.clear(); purgedNamespaces += ownerId to conversationId
        }
    }

    private class ContractRepository(
        private val auth: AuthPort,
        private val remote: RemotePort,
        private val network: NetworkPort,
        private val cache: FakeCache,
    ) {
        val diagnostics = mutableListOf<Map<String, String>>()

        fun refresh(request: Request): RefreshResult {
            if (!network.usable) return RefreshResult(Outcome.Failure)
            if (!auth.member) {
                cache.purge(request.ownerId, request.conversationId)
                return RefreshResult(Outcome.Denied)
            }
            if (
                auth.ownerId != request.ownerId ||
                auth.ownerId.isNullOrBlank() ||
                auth.generation != request.generation
            ) return RefreshResult(Outcome.Rejected)

            val response = try {
                remote.fetch(request)
            } catch (_: Throwable) {
                diagnostics += redactedFailure()
                return RefreshResult(Outcome.Failure)
            }
            if (!responseMatches(response, request) || response.rows.size > 41 || !strictRows(response.rows)) {
                diagnostics += mapOf(
                    "operation" to "refreshSharedContent",
                    "outcome" to "rejected",
                    "durationMs" to "0",
                    "failureCategory" to "validation",
                )
                return RefreshResult(Outcome.Rejected)
            }

            val retained = response.rows.take(40)
            val page = Page(
                items = retained,
                hasMore = response.rows.size == 41,
                nextCursor = retained.lastOrNull()?.let { Cursor(it.sourceRank) },
            )
            if (request.replace) cache.replace(retained) else cache.append(retained)
            return RefreshResult(Outcome.Accepted, page)
        }

        fun applyTombstone(sourceMessageId: String) = cache.tombstone(sourceMessageId)

        private fun responseMatches(response: RemotePage, request: Request): Boolean =
            response.ownerId == request.ownerId &&
                response.conversationId == request.conversationId &&
                response.generation == request.generation &&
                response.cycleId == request.cycleId &&
                response.requestId == request.requestId &&
                response.requestedCursor == request.cursor &&
                response.replace == request.replace

        private fun strictRows(rows: List<Item>): Boolean {
            if (rows.isEmpty()) return true
            val knownCategories = setOf("media", "files", "links", "voice")
            val knownKinds = setOf("photo", "video", "gif", "sticker", "document", "link", "voice")
            return rows.all { row ->
                row.itemId.isNotBlank() &&
                    row.conversationId == CONVERSATION &&
                    row.sourceMessageId.isNotBlank() &&
                    row.category in knownCategories &&
                    row.kind in knownKinds &&
                    row.wireFields == NORMALIZED_FIELDS &&
                    (row.durationMs == null || row.durationMs >= 0)
            } && rows.zipWithNext().all { (left, right) -> left.orderKey > right.orderKey }
        }

        private fun redactedFailure(): Map<String, String> = mapOf(
            "operation" to "refreshSharedContent",
            "outcome" to "failure",
            "durationMs" to "0",
            "failureCategory" to "network",
        )
    }

    private fun request(
        ownerId: String = OWNER,
        generation: Long = 1,
        requestId: String = "request-1",
        cursor: Cursor? = null,
        replace: Boolean = true,
    ) = Request(
        ownerId = ownerId,
        generation = generation,
        requestId = requestId,
        cursor = cursor,
        replace = replace,
    )

    private fun page(rows: List<Item>, request: Request) = RemotePage(
        rows = rows,
        ownerId = request.ownerId,
        conversationId = request.conversationId,
        generation = request.generation,
        cycleId = request.cycleId,
        requestId = request.requestId,
        requestedCursor = request.cursor,
        replace = request.replace,
    )

    private fun rows(count: Int, start: Int = 0): List<Item> = (start until start + count).map { index ->
        item(index)
    }

    private fun item(index: Int) = Item(
        itemId = itemId(index),
        conversationId = CONVERSATION,
        sourceMessageId = "message-$index",
        sourceRank = index,
        orderKey = 10_000 - index,
    )

    private fun itemId(index: Int) = "item-$index"

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        val parts = symbol.split('#')
        val className = when {
            parts.first() == "DefaultChatRepository" ->
                "space.fishhub.android.data.chat.DefaultChatRepository"
            parts.first() == "ChatRemoteDataSource" ->
                "space.fishhub.android.data.chat.remote.ChatRemoteDataSource"
            else -> "space.fishhub.android.data.chat.${parts.first()}"
        }
        val type = Class.forName(className)
        parts.getOrNull(1)?.let { member -> type.declaredMethods.any { it.name == member } } ?: true
    }.getOrDefault(false)

    private fun productionFieldExists(symbol: String): Boolean = runCatching {
        val (className, fieldName) = symbol.split('#', limit = 2)
        Class.forName(className).declaredFields.any { it.name == fieldName }
    }.getOrDefault(false)

    private companion object {
        const val OWNER = "owner-a"
        const val OTHER_OWNER = "owner-b"
        const val CONVERSATION = "conversation-a"
        const val OTHER_CONVERSATION = "conversation-b"
        const val SECRET_SENTINEL = "signed-token-sentinel-for-tests"
        val NORMALIZED_FIELDS = setOf(
            "item_id",
            "conversation_id",
            "source_message_id",
            "sender_id",
            "source_created_at",
            "source_rank",
            "category",
            "kind",
            "attachment_id",
            "attachment_original_name",
            "attachment_mime_type",
            "attachment_byte_size",
            "attachment_width",
            "attachment_height",
            "attachment_display_path",
            "attachment_thumbnail_path",
            "duration_ms",
            "gif_provider",
            "gif_provider_content_id",
            "gif_title",
            "gif_description",
            "sticker_id",
            "link_url",
            "link_hostname",
            "link_title",
            "link_description",
            "link_site_name",
            "can_delete",
            "can_export",
        )
        val FORBIDDEN_WIRE_FIELD = Regex(
            "^delivery_url$|signed_url|token|delivery_reference|temporary_reference|local_path|action_authority",
            RegexOption.IGNORE_CASE,
        )
    }
}
