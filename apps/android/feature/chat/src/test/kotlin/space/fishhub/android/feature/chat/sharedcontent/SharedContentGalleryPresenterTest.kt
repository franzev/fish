package space.fishhub.android.feature.chat.sharedcontent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedContentGalleryPresenterTest {
    @Test
    fun populatedCategoriesUseCanonicalOrderAndSelectionRetainsThenFallsBack() {
        val session = GallerySession()
        session.bind(OWNER, CONVERSATION, generation = 1)

        session.replace(
            token = token(),
            items = listOf(
                item("voice-a", "voice"),
                item("media-a", "media"),
                item("file-a", "files"),
                item("link-a", "links"),
            ),
        )

        assertEquals(listOf("media", "files", "links", "voice"), session.categories)
        assertEquals("media", session.selectedCategory)
        assertTrue(session.showCategoryControl)

        session.selectCategory("links")
        session.recordAnchor("links", "link-a")
        session.realtime(
            ownerId = OWNER,
            conversationId = CONVERSATION,
            generation = 1,
            upserts = listOf(item("media-b", "media")),
        )
        assertEquals("links", session.selectedCategory)
        assertEquals("link-a", session.anchor("links"))

        session.remove(
            ownerId = OWNER,
            conversationId = CONVERSATION,
            generation = 1,
            itemIds = setOf("link-a"),
        )
        assertEquals("media", session.selectedCategory)

        session.replace(token(), listOf(item("voice-only", "voice")))
        assertEquals(listOf("voice"), session.categories)
        assertEquals("voice", session.selectedCategory)
        assertFalse(session.showCategoryControl)
    }

    @Test
    fun categoryAnchorsAreIndependentAndSwitchingDoesNotRestartRecovery() {
        val session = GallerySession()
        session.bind(OWNER, CONVERSATION, generation = 1)
        session.routeOpened()
        session.replace(
            token(),
            listOf(item("media-a", "media"), item("file-a", "files")),
        )
        session.recordAnchor("media", "media-a")
        session.selectCategory("files")
        session.recordAnchor("files", "file-a")
        session.selectCategory("media")

        assertEquals("media-a", session.anchor("media"))
        assertEquals("file-a", session.anchor("files"))
        assertEquals(1, session.openCount)

        session.routeOpened()
        assertEquals(2, session.openCount)
    }

    @Test
    fun acceptedRealtimeAddsAndRemovesCategoriesButWrongIdentityIsFailClosed() {
        val session = GallerySession()
        session.bind(OWNER, CONVERSATION, generation = 1)
        session.replace(token(), listOf(item("media-a", "media")))

        session.realtime(
            ownerId = OWNER,
            conversationId = CONVERSATION,
            generation = 1,
            upserts = listOf(item("voice-a", "voice")),
        )
        assertEquals(listOf("media", "voice"), session.categories)

        session.realtime(
            ownerId = "owner-b",
            conversationId = CONVERSATION,
            generation = 1,
            upserts = listOf(item("file-leak", "files")),
        )
        session.realtime(
            ownerId = OWNER,
            conversationId = "conversation-b",
            generation = 1,
            upserts = listOf(item("link-leak", "links")),
        )
        session.remove(
            ownerId = OWNER,
            conversationId = CONVERSATION,
            generation = 0,
            itemIds = setOf("media-a"),
        )

        assertEquals(listOf("media", "voice"), session.categories)
        assertEquals(listOf("media-a", "voice-a"), session.items.map { it.itemId })
    }

    @Test
    fun globalEarlierRequestSuppressesDuplicateTapAndAcceptsPageWithoutSelectedCategory() {
        val session = GallerySession()
        session.bind(OWNER, CONVERSATION, generation = 1)
        session.replace(
            token(),
            listOf(item("media-a", "media"), item("file-a", "files")),
            nextCursor = "cursor-a",
        )
        session.selectCategory("media")
        session.recordAnchor("media", "media-a")

        assertTrue(session.beginEarlier("earlier-a", "cursor-a"))
        assertFalse(session.beginEarlier("earlier-b", "cursor-a"))
        assertEquals(1, session.earlierRequestCount)

        assertTrue(
            session.completeEarlier(
                ownerId = OWNER,
                conversationId = CONVERSATION,
                generation = 1,
                requestId = "earlier-a",
                requestedCursor = "cursor-a",
                appended = listOf(item("voice-a", "voice")),
                nextCursor = null,
            ),
        )
        assertEquals("media", session.selectedCategory)
        assertEquals("media-a", session.anchor("media"))
        assertEquals(listOf("media", "files", "voice"), session.categories)
        assertEquals(EarlierState.Complete, session.earlierState)
    }

    @Test
    fun failedEarlierRequestRetainsItemsAndWrongRequestOrCursorCannotAppend() {
        val session = GallerySession()
        session.bind(OWNER, CONVERSATION, generation = 1)
        session.replace(token(), listOf(item("media-a", "media")), nextCursor = "cursor-a")
        session.recordAnchor("media", "media-a")
        session.beginEarlier("earlier-a", "cursor-a")

        assertFalse(
            session.completeEarlier(
                ownerId = OWNER,
                conversationId = CONVERSATION,
                generation = 1,
                requestId = "stale-request",
                requestedCursor = "cursor-a",
                appended = listOf(item("file-leak", "files")),
                nextCursor = null,
            ),
        )
        assertFalse(
            session.completeEarlier(
                ownerId = OWNER,
                conversationId = CONVERSATION,
                generation = 1,
                requestId = "earlier-a",
                requestedCursor = "wrong-cursor",
                appended = listOf(item("link-leak", "links")),
                nextCursor = null,
            ),
        )
        session.failEarlier("earlier-a", "cursor-a")

        assertEquals(listOf("media-a"), session.items.map { it.itemId })
        assertEquals("media-a", session.anchor("media"))
        assertEquals(EarlierState.Failed, session.earlierState)
        assertEquals("Earlier content didn't load. Try again.", session.earlierMessage)
    }

    @Test
    fun identityRevocationDuringRefreshOrAppendClearsStateAndRejectsOldCompletions() {
        val session = GallerySession()
        session.bind(OWNER, CONVERSATION, generation = 1)
        session.replace(token(), listOf(item("media-a", "media")), nextCursor = "cursor-a")
        session.beginEarlier("earlier-a", "cursor-a")

        session.bind("owner-b", CONVERSATION, generation = 2)
        assertTrue(session.items.isEmpty())
        assertTrue(session.categories.isEmpty())
        assertNull(session.selectedCategory)
        assertFalse(
            session.completeEarlier(
                ownerId = OWNER,
                conversationId = CONVERSATION,
                generation = 1,
                requestId = "earlier-a",
                requestedCursor = "cursor-a",
                appended = listOf(item("voice-leak", "voice")),
                nextCursor = null,
            ),
        )
        assertFalse(
            session.replace(
                token = token(ownerId = OWNER, generation = 1),
                items = listOf(item("file-leak", "files")),
            ),
        )
        assertTrue(session.items.isEmpty())
    }

    @Test
    fun phaseTwelveTruthRemainsDistinctForLoadingCacheEmptyOfflineAndStale() {
        assertEquals(
            GalleryTruth.Loading,
            galleryTruth(hasCache = false, loading = true),
        )
        assertEquals(
            GalleryTruth.AuthoritativeEmpty,
            galleryTruth(hasCache = false, authoritativeEmpty = true),
        )
        assertEquals(
            GalleryTruth.OfflineUnavailable,
            galleryTruth(hasCache = false, online = false),
        )
        assertEquals(
            GalleryTruth.CachedOffline,
            galleryTruth(hasCache = true, online = false),
        )
        assertEquals(
            GalleryTruth.CachedStale,
            galleryTruth(hasCache = true, stale = true),
        )
        assertEquals(
            GalleryTruth.Content,
            galleryTruth(hasCache = true),
        )
    }

    @Test
    fun phaseThirteenPresenterAndGlobalEarlierSymbolsAreIntentionallyAbsent() {
        val expected = listOf(
            "space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryPresenter",
            "space.fishhub.android.feature.chat.sharedcontent.SharedContentStore#loadEarlier",
            "space.fishhub.android.feature.chat.sharedcontent.SharedContentStore#acceptedItems",
        )
        val missing = expected.filterNot(::productionSymbolExists)
        assertTrue(
            "RED: missing Phase 13 gallery session/store production symbols: $missing",
            missing.isEmpty(),
        )
    }

    private data class GalleryItem(
        val itemId: String,
        val conversationId: String,
        val category: String,
        val durationMs: Long? = null,
    )

    private data class RequestToken(
        val ownerId: String,
        val conversationId: String,
        val generation: Long,
        val requestId: String,
        val requestedCursor: String? = null,
        val replace: Boolean = true,
    )

    private enum class EarlierState { Hidden, Ready, Loading, Failed, Complete }

    private enum class GalleryTruth {
        Loading,
        Content,
        AuthoritativeEmpty,
        OfflineUnavailable,
        CachedOffline,
        CachedStale,
    }

    private class GallerySession {
        private var ownerId: String? = null
        private var conversationId: String? = null
        private var generation: Long = 0
        private var nextCursor: String? = null
        private var pendingEarlier: Pair<String, String>? = null
        private val anchors = mutableMapOf<String, String>()
        private val mutableItems = mutableListOf<GalleryItem>()

        var selectedCategory: String? = null
            private set
        var earlierState: EarlierState = EarlierState.Hidden
            private set
        var earlierMessage: String? = null
            private set
        var earlierRequestCount: Int = 0
            private set
        var openCount: Int = 0
            private set

        val items: List<GalleryItem> get() = mutableItems.toList()
        val categories: List<String>
            get() = CATEGORY_ORDER.filter { category -> mutableItems.any { it.category == category } }
        val showCategoryControl: Boolean get() = categories.size > 1

        fun bind(ownerId: String?, conversationId: String, generation: Long) {
            this.ownerId = ownerId?.takeIf(String::isNotBlank)
            this.conversationId = conversationId.takeIf(String::isNotBlank)
            this.generation = generation
            mutableItems.clear()
            anchors.clear()
            selectedCategory = null
            nextCursor = null
            pendingEarlier = null
            earlierState = EarlierState.Hidden
            earlierMessage = null
        }

        fun routeOpened() {
            openCount += 1
        }

        fun replace(
            token: RequestToken,
            items: List<GalleryItem>,
            nextCursor: String? = null,
        ): Boolean {
            if (!matches(token) || !token.replace || items.any { it.conversationId != conversationId }) {
                return false
            }
            mutableItems.clear()
            mutableItems += items.distinctBy(GalleryItem::itemId)
            this.nextCursor = nextCursor
            earlierState = if (nextCursor == null) EarlierState.Complete else EarlierState.Ready
            projectSelection()
            return true
        }

        fun realtime(
            ownerId: String,
            conversationId: String,
            generation: Long,
            upserts: List<GalleryItem>,
        ) {
            if (!matches(ownerId, conversationId, generation) ||
                upserts.any { it.conversationId != conversationId }
            ) return
            upserts.forEach { item ->
                mutableItems.removeAll { it.itemId == item.itemId }
                mutableItems += item
            }
            projectSelection()
        }

        fun remove(
            ownerId: String,
            conversationId: String,
            generation: Long,
            itemIds: Set<String>,
        ) {
            if (!matches(ownerId, conversationId, generation)) return
            mutableItems.removeAll { it.itemId in itemIds }
            projectSelection()
        }

        fun selectCategory(category: String) {
            if (category in categories) selectedCategory = category
        }

        fun recordAnchor(category: String, itemId: String) {
            if (category in categories && mutableItems.any { it.itemId == itemId && it.category == category }) {
                anchors[category] = itemId
            }
        }

        fun anchor(category: String): String? = anchors[category]

        fun beginEarlier(requestId: String, requestedCursor: String): Boolean {
            if (earlierState != EarlierState.Ready || nextCursor != requestedCursor) return false
            pendingEarlier = requestId to requestedCursor
            earlierState = EarlierState.Loading
            earlierMessage = null
            earlierRequestCount += 1
            return true
        }

        fun completeEarlier(
            ownerId: String,
            conversationId: String,
            generation: Long,
            requestId: String,
            requestedCursor: String,
            appended: List<GalleryItem>,
            nextCursor: String?,
        ): Boolean {
            if (!matches(ownerId, conversationId, generation) ||
                pendingEarlier != requestId to requestedCursor ||
                appended.any { it.conversationId != conversationId }
            ) return false
            mutableItems += appended.filterNot { candidate ->
                mutableItems.any { it.itemId == candidate.itemId }
            }
            pendingEarlier = null
            this.nextCursor = nextCursor
            earlierState = if (nextCursor == null) EarlierState.Complete else EarlierState.Ready
            projectSelection()
            return true
        }

        fun failEarlier(requestId: String, requestedCursor: String) {
            if (pendingEarlier != requestId to requestedCursor) return
            pendingEarlier = null
            earlierState = EarlierState.Failed
            earlierMessage = "Earlier content didn't load. Try again."
        }

        private fun matches(token: RequestToken): Boolean =
            matches(token.ownerId, token.conversationId, token.generation)

        private fun matches(ownerId: String, conversationId: String, generation: Long): Boolean =
            this.ownerId == ownerId &&
                this.conversationId == conversationId &&
                this.generation == generation

        private fun projectSelection() {
            selectedCategory = selectedCategory
                ?.takeIf { it in categories }
                ?: categories.firstOrNull()
            anchors.keys.retainAll(categories.toSet())
        }
    }

    private fun galleryTruth(
        hasCache: Boolean,
        loading: Boolean = false,
        authoritativeEmpty: Boolean = false,
        online: Boolean = true,
        stale: Boolean = false,
    ): GalleryTruth = when {
        authoritativeEmpty -> GalleryTruth.AuthoritativeEmpty
        hasCache && !online -> GalleryTruth.CachedOffline
        hasCache && stale -> GalleryTruth.CachedStale
        hasCache -> GalleryTruth.Content
        !online -> GalleryTruth.OfflineUnavailable
        loading -> GalleryTruth.Loading
        else -> GalleryTruth.Loading
    }

    private fun item(itemId: String, category: String) = GalleryItem(
        itemId = itemId,
        conversationId = CONVERSATION,
        category = category,
    )

    private fun token(
        ownerId: String = OWNER,
        generation: Long = 1,
    ) = RequestToken(
        ownerId = ownerId,
        conversationId = CONVERSATION,
        generation = generation,
        requestId = "refresh-a",
    )

    private fun productionSymbolExists(symbol: String): Boolean = runCatching {
        val parts = symbol.split('#')
        val type = Class.forName(parts.first())
        val member = parts.getOrNull(1)
        member == null ||
            type.declaredMethods.any { it.name == member } ||
            type.declaredFields.any { it.name == member }
    }.getOrDefault(false)

    private companion object {
        const val OWNER = "owner-a"
        const val CONVERSATION = "conversation-a"
        val CATEGORY_ORDER = listOf("media", "files", "links", "voice")
    }
}
