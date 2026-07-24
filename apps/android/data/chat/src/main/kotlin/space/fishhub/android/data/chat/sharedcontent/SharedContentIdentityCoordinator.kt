package space.fishhub.android.data.chat.sharedcontent

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.yield

/** The only identity states that may cross the gallery data boundary. */
enum class SharedContentIdentityStatus {
    UNRESOLVED,
    PURGING,
    ELIGIBLE,
    UNAVAILABLE,
}

enum class SharedContentIdentityUnavailableReason {
    PURGE_INCOMPLETE,
}

/** A process-local, strictly increasing owner generation. */
data class IdentityGeneration(val value: Long) {
    init {
        require(value >= 0)
    }
}

data class SharedContentIdentityState(
    val status: SharedContentIdentityStatus,
    val ownerIdentityId: String?,
    val generation: IdentityGeneration,
    val unavailableReason: SharedContentIdentityUnavailableReason? = null,
) {
    val isGalleryEligible: Boolean
        get() = status == SharedContentIdentityStatus.ELIGIBLE && !ownerIdentityId.isNullOrBlank()

    override fun toString(): String =
        "SharedContentIdentityState(status=$status, generation=${generation.value})"

    companion object {
        fun unresolved(generation: IdentityGeneration = IdentityGeneration(0)) =
            SharedContentIdentityState(
                status = SharedContentIdentityStatus.UNRESOLVED,
                ownerIdentityId = null,
                generation = generation,
            )
    }
}

/**
 * Provider-neutral cleanup boundary for identity changes.
 *
 * Implementations must make each operation idempotent. `ownerIdentityId ==
 * null` means sweep every non-current namespace; it is never an authorization
 * signal. The coordinator is the only caller that may publish a new eligible
 * owner, and it does so only after [verifyZero] succeeds.
 */
interface SharedContentPurgePort {
    suspend fun revokeSharedContentStore() = Unit

    suspend fun cancelTasks() = Unit

    suspend fun clearLeases(
        ownerIdentityId: String?,
        revokedBeforeGeneration: IdentityGeneration,
    ) = Unit

    suspend fun clearDecodedMemory() = Unit

    suspend fun purgeMetadata(ownerIdentityId: String?) = Unit

    suspend fun sweepNonCurrentNamespaces(currentOwnerIdentityId: String?) = Unit

    suspend fun purgeThumbnailRoot(ownerIdentityId: String?): Boolean = true

    suspend fun purgeTempRoot(ownerIdentityId: String?): Boolean = true

    suspend fun verifyZero(ownerIdentityId: String?): Boolean = true
}

/** Provider-neutral verifier used to keep zero-state proof explicit and reusable. */
class IdentityPurgeVerifier(
    private val purgePort: SharedContentPurgePort,
) {
    suspend fun verifyZero(ownerIdentityId: String?): Boolean = purgePort.verifyZero(ownerIdentityId)
}

object NoOpSharedContentPurgePort : SharedContentPurgePort

/** App-owned ephemeral files/tasks register here without importing app types into data. */
fun interface SharedContentEphemeralPurgeHook {
    suspend fun purge(ownerIdentityId: String?, generation: IdentityGeneration): Boolean
}

/**
 * Serializes restore, sign-in, sign-out, token invalidation, and replacement
 * transitions. Old state is hidden and its generation revoked before any
 * cleanup begins; a failed cleanup leaves only gallery eligibility unavailable.
 */
class SharedContentIdentityCoordinator(
    private val purgePort: SharedContentPurgePort,
) {
    private val purgeVerifier = IdentityPurgeVerifier(purgePort)
    private val mutex = Mutex()
    private val _state = MutableStateFlow(SharedContentIdentityState.unresolved())
    private val hooks = LinkedHashSet<SharedContentEphemeralPurgeHook>()
    private var lastKnownOwnerIdentityId: String? = null

    val state: StateFlow<SharedContentIdentityState> = _state.asStateFlow()
    val identityState: StateFlow<SharedContentIdentityState> = state

    /** Synchronously exposes the fail-closed state before cleanup can suspend. */
    val currentState: SharedContentIdentityState
        get() = state.value

    fun registerEphemeralPurgeHook(hook: SharedContentEphemeralPurgeHook) {
        synchronized(hooks) { hooks += hook }
    }

    fun unregisterEphemeralPurgeHook(hook: SharedContentEphemeralPurgeHook) {
        synchronized(hooks) { hooks -= hook }
    }

    suspend fun transitionTo(ownerIdentityId: String?): Boolean =
        transitionInternal(ownerIdentityId = ownerIdentityId.normalized(), force = false)

    /** Alias retained for callers that model auth as a transition event. */
    suspend fun transition(ownerIdentityId: String?): Boolean = transitionTo(ownerIdentityId)

    /** Re-runs the full purge, including a non-current namespace sweep. */
    suspend fun retryPurgeAndBind(ownerIdentityId: String?): Boolean =
        transitionInternal(ownerIdentityId = ownerIdentityId.normalized(), force = true)

    suspend fun retry(ownerIdentityId: String?): Boolean = retryPurgeAndBind(ownerIdentityId)

    suspend fun sweepOnVerifiedStart(ownerIdentityId: String?): Boolean {
        val normalized = ownerIdentityId.normalized()
        if (normalized == null && state.value.generation.value == 0L &&
            state.value.status == SharedContentIdentityStatus.UNRESOLVED
        ) return false
        if (state.value.isGalleryEligible && state.value.ownerIdentityId == normalized) return true
        return retryPurgeAndBind(normalized)
    }

    suspend fun onVerifiedStart(ownerIdentityId: String?): Boolean =
        sweepOnVerifiedStart(ownerIdentityId)

    suspend fun onForeground(ownerIdentityId: String?): Boolean =
        sweepOnVerifiedStart(ownerIdentityId)

    fun accepts(ownerIdentityId: String, generation: IdentityGeneration): Boolean {
        val current = state.value
        return current.isGalleryEligible &&
            current.ownerIdentityId == ownerIdentityId &&
            current.generation == generation
    }

    fun accepts(ownerIdentityId: String, generation: Long): Boolean =
        accepts(ownerIdentityId, IdentityGeneration(generation))

    private suspend fun transitionInternal(ownerIdentityId: String?, force: Boolean): Boolean =
        mutex.withLock {
            val current = state.value
            if (!force && current.isGalleryEligible && current.ownerIdentityId == ownerIdentityId) {
                return@withLock true
            }
            if (!force && ownerIdentityId == null &&
                current.status == SharedContentIdentityStatus.UNRESOLVED &&
                current.ownerIdentityId == null
            ) {
                return@withLock false
            }

            val oldOwner = lastKnownOwnerIdentityId
            val generation = nextGeneration(current.generation)
            lastKnownOwnerIdentityId = oldOwner ?: current.ownerIdentityId

            // StateFlow.value is intentionally assigned before the first await.
            _state.value = SharedContentIdentityState.unresolved(generation)
            yield()
            _state.value = SharedContentIdentityState(
                status = SharedContentIdentityStatus.PURGING,
                ownerIdentityId = null,
                generation = generation,
            )

            val verified = runCatching {
                purgePort.revokeSharedContentStore()
                purgePort.cancelTasks()
                purgePort.clearLeases(lastKnownOwnerIdentityId, generation)
                purgePort.clearDecodedMemory()
                purgePort.purgeMetadata(lastKnownOwnerIdentityId)
                purgePort.sweepNonCurrentNamespaces(ownerIdentityId)
                require(purgePort.purgeThumbnailRoot(lastKnownOwnerIdentityId))
                require(purgePort.purgeTempRoot(lastKnownOwnerIdentityId))
                val currentHooks = synchronized(hooks) { hooks.toList() }
                require(currentHooks.all { hook -> hook.purge(lastKnownOwnerIdentityId, generation) })
                require(purgeVerifier.verifyZero(lastKnownOwnerIdentityId))
                true
            }.getOrElse { error ->
                if (error is CancellationException) throw error
                false
            }

            if (!verified) {
                _state.value = SharedContentIdentityState(
                    status = SharedContentIdentityStatus.UNAVAILABLE,
                    ownerIdentityId = null,
                    generation = generation,
                    unavailableReason = SharedContentIdentityUnavailableReason.PURGE_INCOMPLETE,
                )
                return@withLock false
            }

            if (ownerIdentityId == null) {
                lastKnownOwnerIdentityId = null
                _state.value = SharedContentIdentityState.unresolved(generation)
                return@withLock false
            }

            lastKnownOwnerIdentityId = ownerIdentityId
            _state.value = SharedContentIdentityState(
                status = SharedContentIdentityStatus.ELIGIBLE,
                ownerIdentityId = ownerIdentityId,
                generation = generation,
            )
            true
        }

    private fun nextGeneration(current: IdentityGeneration): IdentityGeneration {
        check(current.value < Long.MAX_VALUE) { "Identity generation exhausted." }
        return IdentityGeneration(current.value + 1)
    }

    private fun String?.normalized(): String? = takeUnless { it.isNullOrBlank() }
}
