package space.fishhub.android.data.chat.sharedcontent

import java.util.LinkedHashMap
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import space.fishhub.android.data.chat.AttachmentDelivery

/**
 * Process-local signed delivery cache with an epoch fence.
 *
 * A purge increments the epoch while holding the same lock used to publish a
 * refresh result. Therefore a completion either lands before the purge and is
 * cleared by it, or arrives afterward and is rejected.
 */
internal class BoundedAttachmentDeliveryCache(
    private val maxEntries: Int = MAX_ENTRIES,
) {
    private val lock = Any()
    private val _deliveries = MutableStateFlow<Map<String, AttachmentDelivery>>(emptyMap())
    private var epoch = 0L

    init {
        require(maxEntries > 0)
    }

    val deliveries: StateFlow<Map<String, AttachmentDelivery>> = _deliveries.asStateFlow()

    fun beginRefresh(): Long = synchronized(lock) { epoch }

    fun acceptRefresh(
        refreshEpoch: Long,
        refreshed: Collection<AttachmentDelivery>,
    ): Boolean = synchronized(lock) {
        if (refreshEpoch != epoch) return@synchronized false
        mergeLocked(refreshed)
        true
    }

    fun cache(refreshed: Collection<AttachmentDelivery>) {
        synchronized(lock) { mergeLocked(refreshed) }
    }

    fun clear() {
        synchronized(lock) {
            epoch += 1
            _deliveries.value = emptyMap()
        }
    }

    private fun mergeLocked(refreshed: Collection<AttachmentDelivery>) {
        if (refreshed.isEmpty()) return
        val bounded = LinkedHashMap(_deliveries.value)
        refreshed.forEach { delivery ->
            val id = delivery.attachmentId.trim()
            if (id.isEmpty()) return@forEach
            bounded.remove(id)
            bounded[id] = delivery
        }
        while (bounded.size > maxEntries) {
            val oldest = bounded.keys.firstOrNull() ?: break
            bounded.remove(oldest)
        }
        _deliveries.value = bounded
    }

    private companion object {
        const val MAX_ENTRIES = 400
    }
}
