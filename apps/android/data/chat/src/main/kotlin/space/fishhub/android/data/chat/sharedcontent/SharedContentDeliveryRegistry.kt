package space.fishhub.android.data.chat.sharedcontent

import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.LinkedHashMap
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import space.fishhub.android.data.chat.AttachmentDelivery
import space.fishhub.android.data.chat.ChatRepository
import space.fishhub.android.data.chat.ChatResult

/**
 * A live delivery value. This type deliberately is not serializable: signed
 * URLs are authority-bearing runtime values and never belong in Room, files,
 * HTTP caches, or diagnostics.
 */
data class SharedContentDeliveryLease(
    val attachmentId: String,
    val thumbnailUrl: String?,
    val displayUrl: String?,
    val expiresAt: Instant,
    val opaqueKey: String = attachmentId,
) {
    fun isFresh(now: Instant, freshnessMargin: Long = FRESHNESS_MARGIN_SECONDS): Boolean =
        expiresAt.isAfter(now.plusSeconds(freshnessMargin))

    override fun toString(): String =
        "SharedContentDeliveryLease(attachmentId=$attachmentId, expiresAt=$expiresAt)"

    private companion object {
        const val FRESHNESS_MARGIN_SECONDS = 120L
    }
}

/** Binary-compatibility marker for the Wave 0 contract name. */
@Deprecated("Use SharedContentDeliveryLease.")
class DeliveryLease private constructor()

/**
 * Generation-scoped in-memory delivery leases for one verified owner and
 * conversation. Refreshes are serialized so overlapping visibility callbacks
 * share the same lease instead of issuing duplicate function calls.
 */
class SharedContentDeliveryRegistry(
    private val ownerIdentityId: String,
    private val conversationId: String,
    private val identityGeneration: Long,
    private val refreshAttachmentUrls: suspend (List<String>) -> ChatResult<List<AttachmentDelivery>>,
    private val now: () -> Instant = Instant::now,
) {
    constructor(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Long,
        repository: ChatRepository,
        now: () -> Instant = Instant::now,
    ) : this(
        ownerIdentityId = ownerIdentityId,
        conversationId = conversationId,
        identityGeneration = identityGeneration,
        refreshAttachmentUrls = repository::refreshAttachmentUrls,
        now = now,
    )

    private val mutex = Mutex()
    private val leases = LinkedHashMap<RegistryKey, SharedContentDeliveryLease>()

    init {
        require(ownerIdentityId.isNotBlank())
        require(conversationId.isNotBlank())
        require(identityGeneration > 0)
    }

    /** Resolves only absent or expiring leases, returning no provider state. */
    suspend fun resolve(
        attachmentIds: Collection<String>,
    ): ChatResult<Map<String, SharedContentDeliveryLease>> = mutex.withLock {
        val uniqueIds = attachmentIds.map(String::trim).filter(String::isNotBlank).distinct()
        if (uniqueIds.isEmpty()) return@withLock ChatResult.Success(emptyMap())

        val now = now()
        val missing = uniqueIds.filter { id ->
            leases[RegistryKey(ownerIdentityId, conversationId, identityGeneration, id)]
                ?.isFresh(now) != true
        }

        for (batch in missing.chunked(MAX_REFRESH_BATCH)) {
            when (val result = refreshAttachmentUrls(batch)) {
                is ChatResult.Failure -> return@withLock result
                is ChatResult.Success -> result.value.forEach { delivery ->
                    val id = delivery.attachmentId.trim()
                    if (id !in batch || id.isBlank()) return@forEach
                    val lease = delivery.toLease(id, now)
                    if (lease != null) {
                        leases[RegistryKey(ownerIdentityId, conversationId, identityGeneration, id)] = lease
                        trimLeases(now)
                    }
                }
            }
        }

        ChatResult.Success(
            uniqueIds.mapNotNull { id ->
                leases[RegistryKey(ownerIdentityId, conversationId, identityGeneration, id)]
                    ?.let { id to it }
            }.toMap(),
        )
    }

    suspend fun lease(attachmentId: String): SharedContentDeliveryLease? =
        when (val result = resolve(listOf(attachmentId))) {
            is ChatResult.Success -> result.value[attachmentId.trim()]
            is ChatResult.Failure -> null
        }

    /** Invalidates one live lease after a delivery response is unauthorized. */
    suspend fun invalidate(attachmentId: String): Boolean = mutex.withLock {
        leases.remove(keyFor(attachmentId)) != null
    }

    /**
     * The caller invokes this once for a 401/403 response. The invalidated
     * lease is refreshed exactly once; callers must not loop this method.
     */
    suspend fun resolveAfterAuthorizationFailure(
        attachmentIds: Collection<String>,
    ): ChatResult<Map<String, SharedContentDeliveryLease>> {
        mutex.withLock {
            attachmentIds.map(String::trim).filter(String::isNotBlank).distinct().forEach { id ->
                leases.remove(keyFor(id))
            }
        }
        return resolve(attachmentIds)
    }

    /** Clears leases only for this exact generation. */
    suspend fun clearGeneration(generation: Long): Int = mutex.withLock {
        if (generation != identityGeneration) return@withLock 0
        val removed = leases.size
        leases.clear()
        removed
    }

    /** Clears this owner/conversation/generation namespace before rebinding. */
    suspend fun clear(): Int = mutex.withLock {
        val removed = leases.size
        leases.clear()
        removed
    }

    suspend fun leaseCount(): Int = mutex.withLock { leases.size }

    private fun keyFor(attachmentId: String): RegistryKey = RegistryKey(
        ownerIdentityId = ownerIdentityId,
        conversationId = conversationId,
        identityGeneration = identityGeneration,
        attachmentId = attachmentId.trim(),
    )

    private fun trimLeases(observedAt: Instant) {
        leases.entries.removeIf { entry -> !entry.value.isFresh(observedAt) }
        while (leases.size > MAX_LEASES) {
            val oldest = leases.entries.minByOrNull { it.value.expiresAt } ?: break
            leases.remove(oldest.key)
        }
    }

    private fun AttachmentDelivery.toLease(
        id: String,
        observedAt: Instant,
    ): SharedContentDeliveryLease? {
        if (thumbnailUrl.isNullOrBlank() && displayUrl.isNullOrBlank()) return null
        val expiry = expiresAt?.let { value ->
            runCatching { Instant.parse(value) }.getOrNull()
        } ?: observedAt.plus(15, ChronoUnit.MINUTES)
        return SharedContentDeliveryLease(
            attachmentId = id,
            thumbnailUrl = thumbnailUrl,
            displayUrl = displayUrl,
            expiresAt = expiry,
            opaqueKey = id,
        )
    }

    private data class RegistryKey(
        val ownerIdentityId: String,
        val conversationId: String,
        val identityGeneration: Long,
        val attachmentId: String,
    )

    private companion object {
        const val MAX_REFRESH_BATCH = 50
        const val MAX_LEASES = 400
    }
}
