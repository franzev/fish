package space.fishhub.android.feature.chat.sharedcontent

import java.time.Instant
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.SharedContentDataCursor
import space.fishhub.android.data.chat.SharedContentDataItem
import space.fishhub.android.data.chat.SharedContentDataPage
import space.fishhub.android.data.chat.SharedContentRequestToken
import space.fishhub.android.data.chat.sharedcontent.SharedContentCacheSource
import space.fishhub.android.data.chat.sharedcontent.StoredSharedContentItem
import space.fishhub.android.data.chat.sharedcontent.StoredSharedContentSnapshot
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentDeliveryBatch
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentFetchIntent
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentHistoryBoundary
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentManualRetryState
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentNetworkPolicy
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationNotice
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentUnavailableReason

@OptIn(ExperimentalCoroutinesApi::class)
class SharedContentStoreTest {
    @Test
    fun verifiedIdentityGenerationIsPreservedInTheAuthorityToken() = runTest {
        val repository = FakeRepository()
        val store = store(repository)

        store.bind(
            ownerIdentityId = "owner-a",
            conversationId = "conversation-a",
            verifiedIdentityGeneration = 41L,
        )
        store.open()
        advanceTimeBy(500)
        runCurrent()
        advanceUntilIdle()

        assertEquals(41L, repository.refreshes.single().identityGeneration)
        store.close()
    }

    @Test
    fun openForegroundReconnectAndRealtimeBurstsJoinOneRecoveryCycle() = runTest {
        val repository = FakeRepository()
        val store = store(repository)

        store.bind("owner-a", "conversation-a")
        store.open()
        store.meaningfulForeground()
        store.reconnect()
        store.realtime()
        advanceTimeBy(500)
        runCurrent()
        advanceUntilIdle()

        assertEquals(1, repository.refreshes.size)
        assertEquals(1L, repository.refreshes.single().identityGeneration)
        store.close()
    }

    @Test
    fun realtimeDuringAnActiveRefreshDoesNotStartASecondRequestWithTheSameToken() = runTest {
        val releaseRefresh = CompletableDeferred<Unit>()
        val repository = FakeRepository(refreshGate = releaseRefresh)
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        store.open()
        advanceTimeBy(500)
        runCurrent()
        assertEquals(1, repository.refreshes.size)

        store.realtime()
        advanceTimeBy(500)
        runCurrent()
        assertEquals(1, repository.refreshes.size)

        releaseRefresh.complete(Unit)
        advanceUntilIdle()
        assertEquals(1, repository.refreshes.map(SharedContentRequestToken::requestId).distinct().size)
        store.close()
    }

    @Test
    fun firstFailureSchedulesOneDeterministicRetryAndSecondFailureEnablesManualRetry() = runTest {
        val repository = FakeRepository(
            results = ArrayDeque(
                listOf(
                    failure(),
                    failure(),
                ),
            ),
        )
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        repository.cached.value = cachedSnapshot(complete = true)
        store.open()

        advanceTimeBy(500)
        runCurrent()
        assertEquals(1, repository.refreshes.size)
        advanceTimeBy(1_000)
        runCurrent()
        advanceUntilIdle()

        assertEquals(2, repository.refreshes.size)
        assertEquals(SharedContentManualRetryState.Enabled, store.presentation.value.manualRetry)
        assertEquals(SharedContentPresentationNotice.Stale, store.presentation.value.notice)

        store.retry()
        advanceTimeBy(500)
        runCurrent()
        advanceUntilIdle()
        assertEquals(3, repository.refreshes.size)
        assertEquals(SharedContentManualRetryState.Hidden, store.presentation.value.manualRetry)
        store.close()
    }

    @Test
    fun unusableConnectivityCancelsTheDelayedRetry() = runTest {
        val repository = FakeRepository(results = ArrayDeque(listOf(failure(), successPage())))
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        store.open()
        advanceTimeBy(500)
        runCurrent()
        assertEquals(1, repository.refreshes.size)

        store.connectivity(SharedContentNetworkPolicy(networkUsable = false, lookaheadAllowed = false))
        advanceTimeBy(2_000)
        advanceUntilIdle()

        assertEquals(1, repository.refreshes.size)
        assertEquals(SharedContentUnavailableReason.OfflineNoCache, store.presentation.value.unavailableReason)
        assertEquals(SharedContentManualRetryState.Hidden, store.presentation.value.manualRetry)
        store.close()
    }

    @Test
    fun cachedItemsRemainVisibleAndTruthfulStatesStayDistinct() = runTest {
        val repository = FakeRepository()
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        repository.cached.value = cachedSnapshot(complete = false)
        advanceUntilIdle()

        assertEquals("cached", store.presentation.value.source)
        assertFalse(store.presentation.value.retainedHistoryComplete)
        assertEquals(SharedContentHistoryBoundary.OnlineIncomplete, store.presentation.value.boundary)

        store.connectivity(SharedContentNetworkPolicy(networkUsable = false, lookaheadAllowed = false))
        assertEquals(SharedContentPresentationNotice.OfflineCached, store.presentation.value.notice)
        assertEquals(SharedContentHistoryBoundary.OfflineIncomplete, store.presentation.value.boundary)

        store.bind(null, "conversation-a")
        assertEquals(SharedContentUnavailableReason.IdentityIneligible, store.presentation.value.unavailableReason)
        store.close()
    }

    @Test
    fun cacheHydrationUsesPersistedCursorInsteadOfDerivingItFromRetainedRows() = runTest {
        val repository = FakeRepository()
        repository.cached.value = cachedSnapshot(complete = false)
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        advanceUntilIdle()

        store.loadEarlier()
        advanceUntilIdle()

        assertEquals("persisted-message", repository.refreshes.single().requestedCursor?.sourceMessageId)
        assertEquals("persisted-item", repository.refreshes.single().requestedCursor?.itemId)
        store.close()
    }

    @Test
    fun incompleteCacheWithMalformedPersistedCursorIsRejected() = runTest {
        val repository = FakeRepository()
        repository.cached.value = cachedSnapshot(complete = false).copy(retainedOldestCursor = "not-json")
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        advanceUntilIdle()

        assertTrue(store.acceptedItems.value.isEmpty())
        store.close()
    }

    @Test
    fun newestRefreshNeverCollapsesContiguousHistoryAcrossCacheEmissionOrder() = runTest {
        listOf(false, true).forEach { cacheEmitsBeforeResponse ->
            val releaseRefresh = CompletableDeferred<Unit>()
            val newest = (0 until 40).map { index ->
                dataItem(
                    itemId = "media-$index",
                    category = "media",
                    createdAt = "2026-07-24T00:${59 - index}:00Z",
                )
            }
            val repository = FakeRepository(
                results = ArrayDeque(listOf(page(newest, hasMore = true))),
                refreshGate = releaseRefresh,
            )
            val retained = (0 until 52).map { index ->
                cachedItem(
                    itemId = if (index < 40) "media-$index" else "file-$index",
                    category = if (index < 40) "media" else "files",
                    createdAt = "2026-07-24T00:${59 - index}:00Z",
                )
            }
            val initial = cachedSnapshot(complete = false).copy(items = retained)
            repository.cached.value = initial
            val store = store(repository)
            store.bind("owner-a", "conversation-a")
            val presenter = SharedContentGalleryPresenter(
                store = store,
                scope = this,
                dispatcher = StandardTestDispatcher(testScheduler),
            )
            advanceUntilIdle()
            presenter.selectCategory(SharedContentGalleryCategory.Files)
            presenter.recordAnchor(
                category = SharedContentGalleryCategory.Files,
                itemId = "file-47",
                scrollOffset = 23,
                focusedItemId = "file-48",
            )

            store.open()
            advanceTimeBy(500)
            runCurrent()
            if (cacheEmitsBeforeResponse) {
                repository.cached.value = initial.copy(source = SharedContentCacheSource.AUTHORITATIVE)
                runCurrent()
            }
            releaseRefresh.complete(Unit)
            advanceUntilIdle()
            if (!cacheEmitsBeforeResponse) {
                repository.cached.value = initial.copy(source = SharedContentCacheSource.AUTHORITATIVE)
                advanceUntilIdle()
            }

            assertEquals(52, store.acceptedItems.value.size)
            assertEquals((40 until 52).map { "file-$it" }, store.acceptedItems.value.takeLast(12).map { it.itemId })
            assertEquals(SharedContentGalleryCategory.Files, presenter.uiState.value.selectedCategory)
            assertEquals(
                SharedContentGalleryAnchor("file-47", 23, "file-48"),
                presenter.uiState.value.anchors[SharedContentGalleryCategory.Files],
            )
            assertFalse(store.presentation.value.retainedHistoryComplete)

            store.loadEarlier()
            advanceUntilIdle()
            assertEquals(
                "persisted-item",
                repository.refreshes.last().requestedCursor?.itemId,
            )
            presenter.close()
        }
    }

    @Test
    fun successfulAuthoritativeZeroIsEmptyNotUnavailable() = runTest {
        val repository = FakeRepository(results = ArrayDeque(listOf(successPage())))
        val store = store(repository)
        store.bind("owner-a", "conversation-a")
        store.open()
        advanceTimeBy(500)
        runCurrent()
        advanceUntilIdle()

        assertEquals("authoritative", store.presentation.value.source)
        assertEquals(SharedContentUnavailableReason.AuthoritativeEmpty, store.presentation.value.unavailableReason)
        store.close()
    }

    @Test
    fun visibilityDeduplicatesBatchesAndDataSaverRemovesOnlyLookahead() = runTest {
        val repository = FakeRepository()
        val submitted = mutableListOf<SharedContentDeliveryBatch>()
        val store = store(repository, object : SharedContentVisibilityPort {
            override suspend fun submit(batch: SharedContentDeliveryBatch) { submitted += batch }
        })
        store.bind("owner-a", "conversation-a")

        val result = store.visibility(
            visibleIds = listOf("a", "a"),
            lookaheadIds = listOf("a", "b"),
            selectedIds = listOf("selected"),
            policy = SharedContentNetworkPolicy(networkUsable = true, lookaheadAllowed = false),
        )
        advanceUntilIdle()

        assertEquals(
            listOf(
                SharedContentDeliveryBatch(SharedContentFetchIntent.VisibleThumbnail, listOf("a")),
                SharedContentDeliveryBatch(SharedContentFetchIntent.SelectedFullContent, listOf("selected")),
            ),
            result.batches,
        )
        assertEquals(result.batches, submitted)
        assertTrue(result.batches.all { it.ids.size <= 50 })
        assertEquals(false, result.lookaheadAllowed)
        store.close()
    }

    @Test
    fun rebindingCancelsOldVisibilityWorkBeforeTheNewOwnerCanSubmit() = runTest {
        val repository = FakeRepository()
        val started = CompletableDeferred<Unit>()
        val cancelled = CompletableDeferred<Unit>()
        val store = store(repository, object : SharedContentVisibilityPort {
            override suspend fun submit(batch: SharedContentDeliveryBatch) {
                started.complete(Unit)
                try {
                    awaitCancellation()
                } finally {
                    cancelled.complete(Unit)
                }
            }
        })
        store.bind("owner-a", "conversation-a")
        store.visibility(visibleIds = listOf("old-owner-item"))
        runCurrent()
        assertTrue(started.isCompleted)

        store.bind("owner-b", "conversation-b")
        runCurrent()

        assertTrue("old visibility work must be cancelled during rebind", cancelled.isCompleted)
        store.close()
    }

    @Test
    fun categorySwitchWaitsForMeasuredViewportAndNeverSubmitsWholeConstrainedCategory() = runTest {
        val repository = FakeRepository()
        val submitted = mutableListOf<SharedContentDeliveryBatch>()
        val store = store(repository, object : SharedContentVisibilityPort {
            override suspend fun submit(batch: SharedContentDeliveryBatch) {
                submitted += batch
            }
        })
        repository.cached.value = cachedSnapshot(complete = true).copy(
            items = (0 until 64).flatMap { index ->
                listOf(
                    cachedItem("media-$index", "media"),
                    cachedItem("file-$index", "files"),
                )
            },
        )
        store.bind("owner-a", "conversation-a")
        store.connectivityChanged(
            SharedContentNetworkPolicy(networkUsable = true, lookaheadAllowed = false),
        )
        val presenter = SharedContentGalleryPresenter(
            store = store,
            scope = this,
            dispatcher = StandardTestDispatcher(testScheduler),
        )
        advanceUntilIdle()

        presenter.selectCategory(SharedContentGalleryCategory.Files)
        advanceUntilIdle()
        assertTrue("selection must wait for a measured viewport", submitted.isEmpty())

        presenter.visibility(
            visibleItemIds = listOf("file-0", "file-1", "file-2"),
            lookaheadItemIds = (3 until 60).map { "file-$it" },
        )
        advanceUntilIdle()

        assertEquals(
            listOf(
                SharedContentDeliveryBatch(
                    SharedContentFetchIntent.VisibleThumbnail,
                    listOf("file-0", "file-1", "file-2"),
                ),
            ),
            submitted,
        )
        assertTrue(submitted.flatMap { it.ids }.size < 50)
        presenter.close()
    }

    private fun TestScope.store(
        repository: FakeRepository,
        visibilityPort: SharedContentVisibilityPort = NoOpSharedContentVisibilityPort,
    ): SharedContentStore = SharedContentStore(
        repository = repository,
        clock = SharedContentClock { Instant.parse("2026-07-23T00:00:00Z") },
        jitter = SharedContentJitter { 0L },
        scope = this,
        dispatcher = StandardTestDispatcher(testScheduler),
        visibilityPort = visibilityPort,
    )

    private class FakeRepository(
        val results: ArrayDeque<ChatResult<SharedContentDataPage>> = ArrayDeque(listOf(successPage())),
        private val refreshGate: CompletableDeferred<Unit>? = null,
    ) : SharedContentRecoveryRepository {
        val cached = MutableStateFlow<StoredSharedContentSnapshot?>(null)
        val refreshes = mutableListOf<SharedContentRequestToken>()

        override fun observeSharedContentSnapshot(conversationId: String) = cached

        override suspend fun refreshSharedContent(
            token: SharedContentRequestToken,
            category: String?,
        ): ChatResult<SharedContentDataPage> {
            refreshes += token
            refreshGate?.await()
            return if (results.isEmpty()) successPage() else results.removeFirst()
        }
    }

    private companion object {
        fun failure() = ChatResult.Failure(
            message = "redacted",
            recoverable = true,
            category = space.fishhub.android.data.chat.FailureCategory.Network,
        )

        fun successPage() = ChatResult.Success(
            SharedContentDataPage(
                items = emptyList(),
                hasMore = false,
                nextCursor = null,
            ),
        )

        fun cachedSnapshot(complete: Boolean) = StoredSharedContentSnapshot(
            schemaVersion = 1,
            ownerIdentityId = "owner-a",
            conversationId = "conversation-a",
            items = listOf(
                StoredSharedContentItem(
                    itemId = "item-a",
                    conversationId = "conversation-a",
                    sourceMessageId = "message-a",
                    senderId = "sender-a",
                    sourceCreatedAt = "2026-07-23T00:00:00Z",
                    sourceRank = 1,
                    category = "media",
                    kind = "photo",
                ),
            ),
            source = SharedContentCacheSource.VERIFIED_DEVICE_CACHE,
            stale = false,
            retainedHistoryComplete = complete,
            authoritativeEmptyConfirmed = false,
            retainedOldestCursor = if (complete) null else
                """{"source_created_at":"2026-07-22T00:00:00Z","source_message_id":"persisted-message","source_rank":9,"item_id":"persisted-item"}""",
            newestWindowProtected = true,
        )

        fun cachedItem(
            itemId: String,
            category: String,
            createdAt: String = "2026-07-23T00:00:00Z",
        ) = StoredSharedContentItem(
            itemId = itemId,
            conversationId = "conversation-a",
            sourceMessageId = "message-$itemId",
            senderId = "sender-a",
            sourceCreatedAt = createdAt,
            sourceRank = 1,
            category = category,
            kind = if (category == "media") "photo" else "document",
        )

        fun dataItem(
            itemId: String,
            category: String,
            createdAt: String,
        ) = SharedContentDataItem(
            itemId = itemId,
            conversationId = "conversation-a",
            sourceMessageId = "message-$itemId",
            senderId = "sender-a",
            sourceCreatedAt = createdAt,
            sourceRank = 1,
            category = category,
            kind = if (category == "media") "photo" else "document",
            canDelete = false,
            canExport = false,
        )

        fun page(
            items: List<SharedContentDataItem>,
            hasMore: Boolean,
        ) = ChatResult.Success(
            SharedContentDataPage(
                items = items,
                hasMore = hasMore,
                nextCursor = items.lastOrNull()?.let {
                    SharedContentDataCursor(
                        sourceCreatedAt = it.sourceCreatedAt,
                        sourceMessageId = it.sourceMessageId,
                        sourceRank = it.sourceRank,
                        itemId = it.itemId,
                    )
                },
            ),
        )
    }
}
