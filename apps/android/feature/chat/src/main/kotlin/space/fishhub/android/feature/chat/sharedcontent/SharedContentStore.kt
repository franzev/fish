package space.fishhub.android.feature.chat.sharedcontent

import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.SharedContentDataCursor
import space.fishhub.android.data.chat.SharedContentDataItem
import space.fishhub.android.data.chat.SharedContentDataPage
import space.fishhub.android.data.chat.SharedContentRequestToken
import space.fishhub.android.data.chat.sharedcontent.StoredSharedContentItem
import space.fishhub.android.data.chat.sharedcontent.StoredSharedContentSnapshot
import space.fishhub.android.feature.chat.sharedcontent.state.SHARED_CONTENT_CACHE_LIMITS
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentDeliveryBatch
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentDeliveryPlanningInput
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentDeliveryPlanningResult
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentHistoryBoundary
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentManualRetryState
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentNetworkPolicy
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationContract
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationNotice
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentUnavailableReason
import space.fishhub.android.feature.chat.sharedcontent.state.planSharedContentDeliveryBatches

fun interface SharedContentClock {
    fun now(): Instant
}

fun interface SharedContentJitter {
    fun millis(attempt: Int): Long
}

enum class SharedContentRecoveryTrigger {
    GalleryOpen,
    MeaningfulForeground,
    Reconnect,
    Realtime,
    ManualRetry,
}

/** Closed global paging truth. Category-specific pagination is intentionally unsupported. */
enum class SharedContentEarlierState {
    Hidden,
    Ready,
    Loading,
    Failed,
    Offline,
}

/**
 * Display-safe metadata accepted by the gallery boundary.
 *
 * Provider locators, delivery leases, raw URLs, cache entities, sender/date
 * preview context, and action authority are deliberately absent.
 */
data class SharedContentAcceptedItem(
    val itemId: String,
    val conversationId: String,
    val category: String,
    val kind: String,
    val originalName: String? = null,
    val mimeType: String? = null,
    val byteSize: Long? = null,
    val width: Int? = null,
    val height: Int? = null,
    val durationMs: Long? = null,
    val mediaTitle: String? = null,
    val mediaDescription: String? = null,
    val linkTitle: String? = null,
    val linkHostname: String? = null,
    internal val sourceMessageId: String? = null,
    internal val attachmentId: String? = null,
    internal val stickerId: String? = null,
    internal val contentVersion: String = itemId,
) {
    init {
        require(itemId.isNotBlank())
        require(conversationId.isNotBlank())
        require(category in SharedContentCategoryValues)
        require(kind in SharedContentKindValues)
        require(contentVersion.isNotBlank())
        require(byteSize == null || byteSize >= 0)
        require(width == null || width > 0)
        require(height == null || height > 0)
        require(durationMs == null || durationMs >= 0)
    }
}

/** The provider-neutral repository surface used by recovery orchestration. */
interface SharedContentRecoveryRepository {
    fun observeSharedContentSnapshot(conversationId: String): Flow<StoredSharedContentSnapshot?>

    suspend fun refreshSharedContent(
        token: SharedContentRequestToken,
        category: String? = null,
    ): ChatResult<SharedContentDataPage>

    suspend fun refreshDelivery(attachmentIds: List<String>): ChatResult<Unit> =
        ChatResult.Success(Unit)
}

/** Visibility is an intent boundary; data and media adapters stay behind this port. */
interface SharedContentVisibilityPort {
    suspend fun submit(batch: SharedContentDeliveryBatch)

    /** The only operation allowed to promote a displayed thumbnail to durable storage. */
    fun confirmThumbnailDisplayed(itemId: String, contentVersion: String): Boolean = false
}

object NoOpSharedContentVisibilityPort : SharedContentVisibilityPort {
    override suspend fun submit(batch: SharedContentDeliveryBatch) = Unit
}

private object SystemSharedContentClock : SharedContentClock {
    override fun now(): Instant = Instant.now()
}

private object NoJitter : SharedContentJitter {
    override fun millis(attempt: Int): Long = 0L
}

/**
 * Provider-neutral recovery and visibility orchestration for shared content.
 *
 * This class owns lifecycle policy only. The repository remains the authority
 * for accepted pages, while the visibility port owns delivery and displayed
 * thumbnail promotion.
 */
class SharedContentStore(
    private val repository: SharedContentRecoveryRepository,
    private val clock: SharedContentClock = SystemSharedContentClock,
    private val jitter: SharedContentJitter = NoJitter,
    private val scope: CoroutineScope,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default,
    visibilityPort: SharedContentVisibilityPort? = null,
) {
    constructor(
        repository: ChatRepository,
        clock: SharedContentClock = SystemSharedContentClock,
        jitter: SharedContentJitter = NoJitter,
        scope: CoroutineScope,
        dispatcher: CoroutineDispatcher = Dispatchers.Default,
        visibilityPort: SharedContentVisibilityPort? = null,
    ) : this(
        repository = ChatRepositoryRecoveryAdapter(repository),
        clock = clock,
        jitter = jitter,
        scope = scope,
        dispatcher = dispatcher,
        visibilityPort = visibilityPort,
    )

    private val lock = Any()
    private val _presentation = MutableStateFlow(initialPresentation())
    private val _acceptedItems = MutableStateFlow<List<SharedContentAcceptedItem>>(emptyList())
    private val _earlierState = MutableStateFlow(SharedContentEarlierState.Hidden)
    private val _visibleItemIds = MutableStateFlow<List<String>>(emptyList())
    private var boundOwnerId: String? = null
    private var boundConversationId: String? = null
    private var identityGeneration = 0L
    private var cycleSequence = 0L
    private var cycleId: String? = null
    private var cycleActive = false
    private var coalescing = false
    private var retryScheduled = false
    private var recoveryJob: Job? = null
    private var earlierJob: Job? = null
    private var snapshotJob: Job? = null
    private val visibilityJobs = mutableSetOf<Job>()
    private var closed = false
    private var networkPolicy = SharedContentNetworkPolicy(
        networkUsable = true,
        lookaheadAllowed = true,
    )
    private var lastBackgroundAt: Instant? = null
    private var hasCache = false
    private var authoritativeEmpty = false
    private var retainedHistoryComplete = true
    private var stale = false
    private var terminalFailure = false
    private var retainedCursor: SharedContentDataCursor? = null
    private var pendingEarlierToken: SharedContentRequestToken? = null
    private var earlierFailure = false
    private var earlierSequence = 0L
    private val visibilityPort: SharedContentVisibilityPort =
        visibilityPort ?: RepositoryVisibilityPort(repository)

    val presentation: StateFlow<SharedContentPresentationContract> = _presentation.asStateFlow()
    val acceptedItems: StateFlow<List<SharedContentAcceptedItem>> = _acceptedItems.asStateFlow()
    val earlierState: StateFlow<SharedContentEarlierState> = _earlierState.asStateFlow()
    val visibleItemIds: StateFlow<List<String>> = _visibleItemIds.asStateFlow()

    /** Binds a verified owner. A missing owner is intentionally ineligible. */
    fun bind(ownerIdentityId: String?, conversationId: String) {
        bind(ownerIdentityId, conversationId, identityGeneration + 1L)
    }

    /** Binds the exact verified identity generation supplied by the data authority. */
    fun bind(
        ownerIdentityId: String?,
        conversationId: String,
        verifiedIdentityGeneration: Long,
    ) {
        synchronized(lock) {
            closeJobsLocked()
            closed = false
            identityGeneration = verifiedIdentityGeneration
            boundOwnerId = ownerIdentityId?.takeIf(String::isNotBlank)
            boundConversationId = conversationId.takeIf(String::isNotBlank)
            cycleId = null
            cycleActive = false
            coalescing = false
            retryScheduled = false
            hasCache = false
            authoritativeEmpty = false
            retainedHistoryComplete = true
            stale = false
            terminalFailure = false
            retainedCursor = null
            pendingEarlierToken = null
            earlierFailure = false
            lastBackgroundAt = null
            _acceptedItems.value = emptyList()
            _visibleItemIds.value = emptyList()
            publishLocked()

            val owner = boundOwnerId
            val conversation = boundConversationId
            if (owner == null || conversation == null) return
            val generation = identityGeneration
            snapshotJob = scope.launch(dispatcher) {
                try {
                    repository.observeSharedContentSnapshot(conversation).collect { snapshot ->
                        synchronized(lock) {
                            if (!isCurrentBindingLocked(owner, conversation, generation)) return@collect
                            acceptSnapshotLocked(snapshot)
                            publishLocked()
                        }
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Throwable) {
                    // A cache observation is disposable; authoritative recovery remains available.
                }
            }
        }
    }

    fun open() = trigger(SharedContentRecoveryTrigger.GalleryOpen)

    fun meaningfulForeground() {
        val shouldRefresh = synchronized(lock) {
            val backgroundedAt = lastBackgroundAt ?: return@synchronized false
            Duration.between(backgroundedAt, clock.now()).toMillis() >=
                SHARED_CONTENT_CACHE_LIMITS.meaningfulForegroundMs
        }
        if (shouldRefresh) trigger(SharedContentRecoveryTrigger.MeaningfulForeground)
    }

    fun foreground() = meaningfulForeground()

    fun background() {
        synchronized(lock) { lastBackgroundAt = clock.now() }
    }

    fun reconnect() {
        synchronized(lock) {
            if (!networkPolicy.networkUsable) return
        }
        trigger(SharedContentRecoveryTrigger.Reconnect)
    }

    fun realtime() = trigger(SharedContentRecoveryTrigger.Realtime)

    fun connectivityChanged(policy: SharedContentNetworkPolicy) = connectivity(policy)

    fun realtimeSignal() = realtime()

    fun connectivity(policy: SharedContentNetworkPolicy) {
        val shouldReconnect = synchronized(lock) {
            val wasUsable = networkPolicy.networkUsable
            networkPolicy = policy.copy(
                lookaheadAllowed = policy.lookaheadAllowed && policy.networkUsable,
            )
            if (!networkPolicy.networkUsable && retryScheduled) {
                recoveryJob?.cancel()
                recoveryJob = null
                retryScheduled = false
                cycleActive = false
                coalescing = false
                terminalFailure = !hasCache
                publishLocked()
            } else {
                publishLocked()
            }
            !wasUsable && networkPolicy.networkUsable
        }
        if (shouldReconnect) trigger(SharedContentRecoveryTrigger.Reconnect)
    }

    /** Starts the explicit retry cycle only after the automatic retry is exhausted. */
    fun retry() {
        synchronized(lock) {
            if (_presentation.value.manualRetry != SharedContentManualRetryState.Enabled ||
                !networkPolicy.networkUsable
            ) return
            _presentation.value = _presentation.value.copy(manualRetry = SharedContentManualRetryState.Busy)
        }
        trigger(SharedContentRecoveryTrigger.ManualRetry)
    }

    /** Loads one global retained-history page and suppresses duplicate in-flight requests. */
    fun loadEarlier() {
        val job = synchronized(lock) {
            val owner = boundOwnerId ?: return@synchronized null
            val conversation = boundConversationId ?: return@synchronized null
            val cursor = retainedCursor ?: return@synchronized null
            if (closed || retainedHistoryComplete || !networkPolicy.networkUsable ||
                pendingEarlierToken != null
            ) return@synchronized null

            earlierSequence += 1
            val generation = identityGeneration
            val token = SharedContentRequestToken(
                ownerIdentityId = owner,
                conversationId = conversation,
                identityGeneration = generation,
                cycleId = "earlier-$generation-$earlierSequence",
                requestId = "earlier-request-$earlierSequence",
                requestedCursor = cursor,
                replace = false,
            )
            pendingEarlierToken = token
            earlierFailure = false
            publishEarlierLocked()
            scope.launch(dispatcher, start = CoroutineStart.LAZY) {
                val result = try {
                    repository.refreshSharedContent(token)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Throwable) {
                    null
                }
                synchronized(lock) {
                    if (!isCurrentEarlierTokenLocked(token)) return@synchronized
                    pendingEarlierToken = null
                    when (result) {
                        is ChatResult.Success -> {
                            val accepted = result.value.acceptedItemsOrNull(conversation)
                            if (accepted == null || result.value.nextCursor !=
                                result.value.items.lastOrNull()?.toCursor()
                            ) {
                                earlierFailure = true
                            } else {
                                _acceptedItems.value = (_acceptedItems.value + accepted)
                                    .distinctBy(SharedContentAcceptedItem::itemId)
                                _visibleItemIds.value = _acceptedItems.value
                                    .map(SharedContentAcceptedItem::itemId)
                                hasCache = _acceptedItems.value.isNotEmpty()
                                authoritativeEmpty = false
                                retainedHistoryComplete = !result.value.hasMore
                                retainedCursor = result.value.nextCursor.takeIf { result.value.hasMore }
                                earlierFailure = false
                            }
                        }
                        else -> earlierFailure = true
                    }
                    publishLocked()
                }
            }.also { pending ->
                earlierJob = pending
                pending.invokeOnCompletion {
                    synchronized(lock) {
                        if (earlierJob === pending) earlierJob = null
                    }
                }
            }
        }
        job?.start()
    }

    fun close() {
        synchronized(lock) {
            closed = true
            closeJobsLocked()
            identityGeneration += 1
            boundOwnerId = null
            boundConversationId = null
            cycleActive = false
            coalescing = false
            retryScheduled = false
            hasCache = false
            authoritativeEmpty = false
            retainedHistoryComplete = true
            stale = false
            terminalFailure = false
            retainedCursor = null
            pendingEarlierToken = null
            earlierFailure = false
            lastBackgroundAt = null
            _acceptedItems.value = emptyList()
            _visibleItemIds.value = emptyList()
            publishLocked()
        }
    }

    /** Cancels delivery work while a new category waits for viewport measurement. */
    fun clearVisibility() {
        synchronized(lock) {
            visibilityJobs.forEach(Job::cancel)
            visibilityJobs.clear()
        }
    }

    /** Plans and submits only typed, deduplicated, bounded delivery intents. */
    fun visibility(
        visibleIds: List<String>,
        lookaheadIds: List<String> = emptyList(),
        selectedIds: List<String> = emptyList(),
        policy: SharedContentNetworkPolicy? = null,
    ): SharedContentDeliveryPlanningResult {
        val effectivePolicy = synchronized(lock) { policy ?: networkPolicy }
        val result = if (!effectivePolicy.networkUsable) {
            SharedContentDeliveryPlanningResult(emptyList(), false.takeIf { lookaheadIds.isNotEmpty() })
        } else {
            planSharedContentDeliveryBatches(
                SharedContentDeliveryPlanningInput(
                    visibleIds = visibleIds,
                    lookaheadIds = lookaheadIds,
                    selectedIds = selectedIds,
                    networkUsable = effectivePolicy.networkUsable,
                    lookaheadAllowed = effectivePolicy.lookaheadAllowed,
                ),
            )
        }
        result.batches.forEach { batch ->
            val job = synchronized(lock) {
                val owner = boundOwnerId ?: return@synchronized null
                val conversation = boundConversationId ?: return@synchronized null
                val generation = identityGeneration
                if (!isCurrentBindingLocked(owner, conversation, generation)) {
                    return@synchronized null
                }
                scope.launch(dispatcher, start = CoroutineStart.LAZY) {
                    val stillCurrent = synchronized(lock) {
                        isCurrentBindingLocked(owner, conversation, generation)
                    }
                    if (stillCurrent) visibilityPort.submit(batch)
                }.also { pending ->
                    visibilityJobs += pending
                    pending.invokeOnCompletion {
                        synchronized(lock) { visibilityJobs -= pending }
                    }
                }
            }
            job?.start()
        }
        return result
    }

    fun confirmThumbnailDisplayed(itemId: String, contentVersion: String): Boolean {
        val accepted = synchronized(lock) {
            !closed && boundOwnerId != null && boundConversationId != null &&
                _acceptedItems.value.any { it.itemId == itemId }
        }
        return accepted && visibilityPort.confirmThumbnailDisplayed(itemId, contentVersion)
    }

    fun displayConfirmed(itemId: String, contentVersion: String): Boolean =
        confirmThumbnailDisplayed(itemId, contentVersion)

    fun trigger(trigger: SharedContentRecoveryTrigger) {
        synchronized(lock) {
            if (closed || boundOwnerId == null || boundConversationId == null) return
            if (!coalescing && recoveryJob?.isActive == true) return
            if (!cycleActive) {
                cycleSequence += 1
                cycleId = "cycle-$cycleSequence"
                cycleActive = true
                terminalFailure = false
                retryScheduled = false
                stale = false
            }
            if (coalescing) recoveryJob?.cancel()
            coalescing = true
            val expectedCycle = cycleId ?: return
            recoveryJob = scope.launch(dispatcher) {
                delay(SHARED_CONTENT_CACHE_LIMITS.triggerCoalescingMs)
                synchronized(lock) {
                    if (!isCurrentCycleLocked(expectedCycle)) return@launch
                    coalescing = false
                    publishLocked()
                }
                runCycle(expectedCycle)
            }
        }
    }

    private suspend fun runCycle(expectedCycle: String) {
        val owner: String
        val conversation: String
        val generation: Long
        synchronized(lock) {
            if (!isCurrentCycleLocked(expectedCycle)) return
            owner = boundOwnerId ?: return
            conversation = boundConversationId ?: return
            generation = identityGeneration
            publishLocked()
        }

        val first = refresh(expectedCycle, owner, conversation, generation, attempt = 0)
        if (first) return
        synchronized(lock) {
            if (!isCurrentCycleLocked(expectedCycle)) return
            if (!networkPolicy.networkUsable) {
                cycleActive = false
                terminalFailure = !hasCache
                publishLocked()
                return
            }
            retryScheduled = true
            publishLocked()
        }
        try {
            val jitterMs = jitter.millis(1).coerceIn(0L, SHARED_CONTENT_CACHE_LIMITS.retryJitterMaxMs)
            delay(SHARED_CONTENT_CACHE_LIMITS.retryBaseMs + jitterMs)
        } catch (cancelled: CancellationException) {
            synchronized(lock) {
                retryScheduled = false
                if (!networkPolicy.networkUsable) cycleActive = false
                publishLocked()
            }
            return
        }
        synchronized(lock) {
            if (!isCurrentCycleLocked(expectedCycle) || !networkPolicy.networkUsable) {
                retryScheduled = false
                publishLocked()
                return
            }
            retryScheduled = false
        }
        refresh(expectedCycle, owner, conversation, generation, attempt = 1)
    }

    private suspend fun refresh(
        expectedCycle: String,
        owner: String,
        conversation: String,
        generation: Long,
        attempt: Int,
    ): Boolean {
        synchronized(lock) {
            if (!isCurrentCycleLocked(expectedCycle)) return false
            publishLocked()
        }
        val token = SharedContentRequestToken(
            ownerIdentityId = owner,
            conversationId = conversation,
            identityGeneration = generation,
            cycleId = expectedCycle,
            requestId = "$expectedCycle-attempt-$attempt",
            requestedCursor = null,
            replace = true,
        )
        val result = try {
            repository.refreshSharedContent(token)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            null
        }
        synchronized(lock) {
            if (!isCurrentCycleLocked(expectedCycle)) return false
            when (result) {
                is ChatResult.Success -> {
                    if (!acceptPageLocked(result.value, conversation)) {
                        if (attempt == 1) {
                            cycleActive = false
                            retryScheduled = false
                            terminalFailure = true
                            stale = hasCache
                            publishLocked()
                        }
                        return false
                    }
                    cycleActive = false
                    retryScheduled = false
                    terminalFailure = false
                    stale = false
                    publishLocked()
                    return true
                }
                else -> {
                    if (attempt == 1) {
                        cycleActive = false
                        retryScheduled = false
                        terminalFailure = true
                        stale = hasCache
                        publishLocked()
                    }
                    return false
                }
            }
        }
    }

    private fun acceptSnapshotLocked(snapshot: StoredSharedContentSnapshot?) {
        if (snapshot == null || snapshot.ownerIdentityId != boundOwnerId ||
            snapshot.conversationId != boundConversationId ||
            snapshot.items.map(StoredSharedContentItem::itemId).distinct().size != snapshot.items.size
        ) return
        val accepted = snapshot.items.mapNotNull(StoredSharedContentItem::toAcceptedItem)
        if (accepted.size != snapshot.items.size ||
            accepted.any { it.conversationId != snapshot.conversationId }
        ) return
        val persistedCursor = snapshot.retainedOldestCursor
            ?.let(::decodePersistedSharedContentCursor)
        if (!snapshot.retainedHistoryComplete && persistedCursor == null) return
        _acceptedItems.value = accepted.distinctBy(SharedContentAcceptedItem::itemId)
        _visibleItemIds.value = _acceptedItems.value.map(SharedContentAcceptedItem::itemId)
        hasCache = _acceptedItems.value.isNotEmpty()
        authoritativeEmpty = snapshot.authoritativeEmptyConfirmed && _acceptedItems.value.isEmpty()
        retainedHistoryComplete = snapshot.retainedHistoryComplete
        retainedCursor = persistedCursor.takeIf { !snapshot.retainedHistoryComplete }
        earlierFailure = false
        stale = snapshot.stale
        terminalFailure = false
    }

    private fun acceptPageLocked(page: SharedContentDataPage, conversation: String): Boolean {
        val accepted = page.acceptedItemsOrNull(conversation) ?: return false
        if (page.nextCursor != page.items.lastOrNull()?.toCursor()) return false
        val previouslyAccepted = _acceptedItems.value
        val priorRetainedHistoryComplete = retainedHistoryComplete
        val priorRetainedCursor = retainedCursor
        val priorBoundaryIndex = accepted.lastOrNull()?.let { boundary ->
            previouslyAccepted.indexOfFirst { it.itemId == boundary.itemId }
        } ?: -1
        val hasContiguousRetainedSuffix = priorBoundaryIndex >= 0 &&
            priorBoundaryIndex < previouslyAccepted.lastIndex
        _acceptedItems.value = if (hasContiguousRetainedSuffix) {
            (accepted + previouslyAccepted.drop(priorBoundaryIndex + 1))
                .distinctBy(SharedContentAcceptedItem::itemId)
        } else {
            accepted.distinctBy(SharedContentAcceptedItem::itemId)
        }
        _visibleItemIds.value = _acceptedItems.value.map(SharedContentAcceptedItem::itemId)
        hasCache = _acceptedItems.value.isNotEmpty()
        authoritativeEmpty = _acceptedItems.value.isEmpty()
        if (hasContiguousRetainedSuffix) {
            // The replacement page overlaps the already accepted newest
            // window. Its retained suffix therefore remains the authoritative
            // deepest history boundary regardless of Room invalidation order.
            retainedHistoryComplete = priorRetainedHistoryComplete
            retainedCursor = priorRetainedCursor
        } else {
            retainedHistoryComplete = !page.hasMore
            retainedCursor = page.nextCursor.takeIf { page.hasMore }
        }
        earlierFailure = false
        return true
    }

    private fun isCurrentBindingLocked(owner: String, conversation: String, generation: Long): Boolean =
        !closed && boundOwnerId == owner && boundConversationId == conversation &&
            identityGeneration == generation

    private fun isCurrentCycleLocked(expectedCycle: String): Boolean =
        !closed && cycleActive && cycleId == expectedCycle && boundOwnerId != null && boundConversationId != null

    private fun isCurrentEarlierTokenLocked(token: SharedContentRequestToken): Boolean =
        !closed &&
            pendingEarlierToken == token &&
            token.ownerIdentityId == boundOwnerId &&
            token.conversationId == boundConversationId &&
            token.identityGeneration == identityGeneration &&
            !token.replace

    private fun closeJobsLocked() {
        recoveryJob?.cancel()
        earlierJob?.cancel()
        snapshotJob?.cancel()
        visibilityJobs.forEach(Job::cancel)
        visibilityJobs.clear()
        recoveryJob = null
        earlierJob = null
        snapshotJob = null
    }

    private fun publishLocked() {
        _presentation.value = presentationLocked()
        publishEarlierLocked()
    }

    private fun publishEarlierLocked() {
        _earlierState.value = when {
            closed || boundOwnerId == null || boundConversationId == null ||
                retainedHistoryComplete || retainedCursor == null -> SharedContentEarlierState.Hidden
            pendingEarlierToken != null -> SharedContentEarlierState.Loading
            !networkPolicy.networkUsable -> SharedContentEarlierState.Offline
            earlierFailure -> SharedContentEarlierState.Failed
            else -> SharedContentEarlierState.Ready
        }
    }

    private fun presentationLocked(): SharedContentPresentationContract {
        val ownerEligible = boundOwnerId != null && boundConversationId != null
        if (!ownerEligible) {
            return SharedContentPresentationContract(
                source = "unavailable",
                stale = false,
                retainedHistoryComplete = true,
                notice = SharedContentPresentationNotice.None,
                boundary = SharedContentHistoryBoundary.None,
                unavailableReason = SharedContentUnavailableReason.IdentityIneligible,
                manualRetry = SharedContentManualRetryState.Hidden,
            )
        }
        val notice = when {
            hasCache && !networkPolicy.networkUsable -> SharedContentPresentationNotice.OfflineCached
            stale -> SharedContentPresentationNotice.Stale
            cycleActive && hasCache -> SharedContentPresentationNotice.CheckingForUpdates
            else -> SharedContentPresentationNotice.None
        }
        val boundary = if (retainedHistoryComplete) {
            SharedContentHistoryBoundary.None
        } else if (networkPolicy.networkUsable) {
            SharedContentHistoryBoundary.OnlineIncomplete
        } else {
            SharedContentHistoryBoundary.OfflineIncomplete
        }
        val unavailable = when {
            authoritativeEmpty -> SharedContentUnavailableReason.AuthoritativeEmpty
            !hasCache && !networkPolicy.networkUsable -> SharedContentUnavailableReason.OfflineNoCache
            !hasCache && terminalFailure -> SharedContentUnavailableReason.AuthorityUnavailable
            !hasCache -> SharedContentUnavailableReason.Loading
            else -> SharedContentUnavailableReason.None
        }
        val manualRetry = if (terminalFailure && networkPolicy.networkUsable) {
            SharedContentManualRetryState.Enabled
        } else {
            SharedContentManualRetryState.Hidden
        }
        return SharedContentPresentationContract(
            source = when {
                authoritativeEmpty -> "authoritative"
                hasCache -> "cached"
                else -> "unavailable"
            },
            stale = stale,
            retainedHistoryComplete = retainedHistoryComplete,
            notice = notice,
            boundary = boundary,
            unavailableReason = unavailable,
            manualRetry = manualRetry,
        )
    }

    private companion object {
        fun initialPresentation() = SharedContentPresentationContract(
            source = "unavailable",
            stale = false,
            retainedHistoryComplete = true,
            notice = SharedContentPresentationNotice.None,
            boundary = SharedContentHistoryBoundary.None,
            unavailableReason = SharedContentUnavailableReason.IdentityIneligible,
            manualRetry = SharedContentManualRetryState.Hidden,
        )
    }
}

private val SharedContentCategoryValues = setOf("media", "files", "links", "voice")
private val SharedContentKindValues =
    setOf("photo", "video", "gif", "sticker", "document", "link", "voice")

private fun decodePersistedSharedContentCursor(encoded: String): SharedContentDataCursor? =
    runCatching {
        val objectValue = Json.parseToJsonElement(encoded).jsonObject
        SharedContentDataCursor(
            sourceCreatedAt = objectValue.getValue("source_created_at").jsonPrimitive.content,
            sourceMessageId = objectValue.getValue("source_message_id").jsonPrimitive.content,
            sourceRank = objectValue.getValue("source_rank").jsonPrimitive.content.toInt(),
            itemId = objectValue.getValue("item_id").jsonPrimitive.content,
        )
    }.getOrNull()

private fun SharedContentDataPage.acceptedItemsOrNull(
    conversationId: String,
): List<SharedContentAcceptedItem>? {
    if (items.any { it.conversationId != conversationId } ||
        items.map(SharedContentDataItem::itemId).distinct().size != items.size ||
        hasMore && nextCursor == null
    ) return null
    return items.map { it.toAcceptedItem() ?: return null }
}

private fun SharedContentDataItem.toAcceptedItem(): SharedContentAcceptedItem? = runCatching {
    SharedContentAcceptedItem(
        itemId = itemId,
        conversationId = conversationId,
        category = category,
        kind = kind,
        originalName = attachmentOriginalName,
        mimeType = attachmentMimeType,
        byteSize = attachmentByteSize,
        width = attachmentWidth,
        height = attachmentHeight,
        durationMs = durationMs,
        mediaTitle = gifTitle,
        mediaDescription = gifDescription,
        linkTitle = linkTitle,
        linkHostname = linkHostname,
        sourceMessageId = sourceMessageId,
        attachmentId = attachmentId,
        stickerId = stickerId,
        contentVersion = sourceCreatedAt,
    )
}.getOrNull()

private fun StoredSharedContentItem.toAcceptedItem(): SharedContentAcceptedItem? {
    val linkMetadata = linkMetadataJson?.let { encoded ->
        runCatching { Json.parseToJsonElement(encoded).jsonObject }.getOrNull()
            ?: return null
    }
    return runCatching {
        SharedContentAcceptedItem(
            itemId = itemId,
            conversationId = conversationId,
            category = category,
            kind = kind,
            originalName = attachmentOriginalName,
            mimeType = attachmentMimeType,
            byteSize = attachmentByteSize,
            width = attachmentWidth,
            height = attachmentHeight,
            durationMs = durationMs,
            mediaTitle = gifTitle,
            mediaDescription = gifDescription,
            linkTitle = linkMetadata?.get("title")?.jsonPrimitive?.contentOrNull,
            linkHostname = linkMetadata?.get("hostname")?.jsonPrimitive?.contentOrNull,
            sourceMessageId = sourceMessageId,
            attachmentId = attachmentId,
            stickerId = stickerId,
            contentVersion = sourceCreatedAt,
        )
    }.getOrNull()
}

private fun SharedContentDataItem.toCursor() = SharedContentDataCursor(
    sourceCreatedAt = sourceCreatedAt,
    sourceMessageId = sourceMessageId,
    sourceRank = sourceRank,
    itemId = itemId,
)

private fun StoredSharedContentItem.toCursor() = SharedContentDataCursor(
    sourceCreatedAt = sourceCreatedAt,
    sourceMessageId = sourceMessageId,
    sourceRank = sourceRank,
    itemId = itemId,
)

/** Recovery facade retained for callers that name the coordinator explicitly. */
class SharedContentRecoveryCoordinator(
    private val store: SharedContentStore,
) {
    fun bind(ownerIdentityId: String?, conversationId: String) = store.bind(ownerIdentityId, conversationId)
    fun bind(ownerIdentityId: String?, conversationId: String, identityGeneration: Long) =
        store.bind(ownerIdentityId, conversationId, identityGeneration)
    fun open() = store.open()
    fun foreground() = store.foreground()
    fun connectivity(policy: SharedContentNetworkPolicy) = store.connectivity(policy)
    fun reconnect() = store.reconnect()
    fun realtime() = store.realtime()
    fun retry() = store.retry()
    fun close() = store.close()
}

private class ChatRepositoryRecoveryAdapter(
    private val repository: ChatRepository,
) : SharedContentRecoveryRepository {
    override fun observeSharedContentSnapshot(conversationId: String): Flow<StoredSharedContentSnapshot?> =
        repository.observeSharedContentSnapshot(conversationId)

    override suspend fun refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?,
    ): ChatResult<SharedContentDataPage> = repository.refreshSharedContent(token, category)

    override suspend fun refreshDelivery(attachmentIds: List<String>): ChatResult<Unit> =
        when (val result = repository.refreshAttachmentUrls(attachmentIds)) {
            is ChatResult.Success -> ChatResult.Success(Unit)
            is ChatResult.Failure -> result
        }
}

private class RepositoryVisibilityPort(
    private val repository: SharedContentRecoveryRepository,
) : SharedContentVisibilityPort {
    override suspend fun submit(batch: SharedContentDeliveryBatch) {
        repository.refreshDelivery(batch.ids)
    }
}
