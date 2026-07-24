package space.fishhub.android.data.chat.sharedcontent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.AttachmentDelivery

class BoundedAttachmentDeliveryCacheTest {
    @Test
    fun clearRejectsAnOlderRefreshCompletion() {
        val cache = BoundedAttachmentDeliveryCache(maxEntries = 2)
        val epoch = cache.beginRefresh()

        cache.clear()

        assertFalse(cache.acceptRefresh(epoch, listOf(delivery("old"))))
        assertTrue(cache.deliveries.value.isEmpty())
    }

    @Test
    fun acceptedRefreshesRetainOnlyTheNewestBoundedEntries() {
        val cache = BoundedAttachmentDeliveryCache(maxEntries = 2)

        assertTrue(
            cache.acceptRefresh(
                cache.beginRefresh(),
                listOf(delivery("one"), delivery("two"), delivery("three")),
            ),
        )

        assertEquals(setOf("two", "three"), cache.deliveries.value.keys)
    }

    private fun delivery(id: String) = AttachmentDelivery(
        attachmentId = id,
        thumbnailUrl = "https://delivery.invalid/$id",
        displayUrl = null,
        expiresAt = "2026-07-24T00:00:00Z",
    )
}
