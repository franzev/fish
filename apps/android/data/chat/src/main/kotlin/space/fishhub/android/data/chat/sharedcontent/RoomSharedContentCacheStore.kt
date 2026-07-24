package space.fishhub.android.data.chat.sharedcontent

import java.time.Clock
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import space.fishhub.android.data.chat.local.ChatDao
import space.fishhub.android.data.chat.local.SharedContentCacheItemEntity
import space.fishhub.android.data.chat.local.SharedContentCacheOwnerEntity
import space.fishhub.android.data.chat.local.SharedContentCachePageEntity

data class SharedContentCachePolicy(
    val newestProtectedCount: Int = 40,
    val perConversationItemLimit: Int = 400,
    val perAccountItemLimit: Int = 2_000,
    val inactivityWindow: Duration = Duration.ofDays(30),
) {
    init {
        require(newestProtectedCount > 0)
        require(perConversationItemLimit >= newestProtectedCount)
        require(perAccountItemLimit >= newestProtectedCount)
        require(!inactivityWindow.isNegative && !inactivityWindow.isZero)
    }
}

enum class SharedContentCacheSource(val wireValue: String) {
    NONE("none"),
    VERIFIED_DEVICE_CACHE("verified-device-cache"),
    AUTHORITATIVE("authoritative"),
}

data class StoredSharedContentItem(
    val itemId: String,
    val conversationId: String,
    val sourceMessageId: String,
    val senderId: String,
    val sourceCreatedAt: String,
    val sourceRank: Int,
    val category: String,
    val kind: String,
    val attachmentId: String? = null,
    val attachmentOriginalName: String? = null,
    val attachmentMimeType: String? = null,
    val attachmentByteSize: Long? = null,
    val attachmentWidth: Int? = null,
    val attachmentHeight: Int? = null,
    val durationMs: Long? = null,
    val gifProvider: String? = null,
    val gifProviderContentId: String? = null,
    val gifTitle: String? = null,
    val gifDescription: String? = null,
    val stickerId: String? = null,
    /** Canonical link metadata only; delivery leases and provider references are excluded. */
    val linkMetadataJson: String? = null,
) {
    init {
        require(durationMs == null || durationMs >= 0)
    }
}

data class StoredSharedContentSnapshot(
    val schemaVersion: Int,
    val ownerIdentityId: String,
    val conversationId: String,
    val items: List<StoredSharedContentItem>,
    val source: SharedContentCacheSource,
    val stale: Boolean,
    val retainedHistoryComplete: Boolean,
    val authoritativeEmptyConfirmed: Boolean,
    val retainedOldestCursor: String?,
    val newestWindowProtected: Boolean,
)

interface SharedContentCacheStore {
    suspend fun hydrateVerifiedOwner(
        verifiedOwnerId: String?,
        conversationId: String,
    ): StoredSharedContentSnapshot?

    fun observeVerifiedOwner(
        verifiedOwnerId: String?,
        conversationId: String,
    ): Flow<List<StoredSharedContentItem>>

    suspend fun replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: List<StoredSharedContentItem>,
        retainedOldestCursor: String? = null,
        retainedHistoryComplete: Boolean = true,
        authoritativeEmptyConfirmed: Boolean = items.isEmpty(),
    )

    suspend fun appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        items: List<StoredSharedContentItem>,
        retainedHistoryComplete: Boolean,
    )

    suspend fun appendBrowsedPageAllocatingOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        retainedCursor: String?,
        items: List<StoredSharedContentItem>,
        retainedHistoryComplete: Boolean,
    ): Int

    suspend fun applyAcceptedTombstones(
        ownerIdentityId: String,
        conversationId: String,
        sourceMessageIds: Set<String>,
    )

    suspend fun purgeConversation(ownerIdentityId: String, conversationId: String)

    suspend fun purgeOwner(ownerIdentityId: String)

    suspend fun verifyOwnerPurged(ownerIdentityId: String, conversationId: String? = null): Boolean
}

class RoomSharedContentCacheStore(
    private val dao: ChatDao,
    private val clock: Clock = Clock.systemUTC(),
    private val policy: SharedContentCachePolicy = SharedContentCachePolicy(),
) : SharedContentCacheStore {
    override suspend fun hydrateVerifiedOwner(
        verifiedOwnerId: String?,
        conversationId: String,
    ): StoredSharedContentSnapshot? {
        if (verifiedOwnerId.isNullOrBlank() || conversationId.isBlank()) return null
        val owner = dao.readSharedContentCacheOwner(verifiedOwnerId, conversationId) ?: return null
        return StoredSharedContentSnapshot(
            schemaVersion = owner.schemaVersion,
            ownerIdentityId = owner.ownerIdentityId,
            conversationId = owner.conversationId,
            items = dao.readSharedContentCacheRows(verifiedOwnerId, conversationId)
                .map { it.toStoredItem() }
                .sortedWith(storedSharedContentOrder),
            source = if (owner.lastAuthoritativeAt != null || owner.authoritativeEmptyConfirmed) {
                SharedContentCacheSource.AUTHORITATIVE
            } else {
                SharedContentCacheSource.VERIFIED_DEVICE_CACHE
            },
            stale = false,
            retainedHistoryComplete = owner.retainedHistoryComplete,
            authoritativeEmptyConfirmed = owner.authoritativeEmptyConfirmed,
            retainedOldestCursor = owner.retainedOldestCursor,
            newestWindowProtected = owner.newestWindowProtected,
        )
    }

    override fun observeVerifiedOwner(
        verifiedOwnerId: String?,
        conversationId: String,
    ): Flow<List<StoredSharedContentItem>> {
        if (verifiedOwnerId.isNullOrBlank() || conversationId.isBlank()) {
            return kotlinx.coroutines.flow.flowOf(emptyList())
        }
        return dao.observeSharedContentCacheRows(verifiedOwnerId, conversationId)
            .map { rows -> rows.map { it.toStoredItem() }.sortedWith(storedSharedContentOrder) }
    }

    override suspend fun replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: List<StoredSharedContentItem>,
        retainedOldestCursor: String?,
        retainedHistoryComplete: Boolean,
        authoritativeEmptyConfirmed: Boolean,
    ) {
        require(items.all {
            it.conversationId == conversationId &&
                (it.durationMs == null || it.durationMs >= 0)
        })
        val now = clock.instant()
        val owner = ownerForMutation(
            ownerIdentityId = ownerIdentityId,
            conversationId = conversationId,
            now = now,
            retainedOldestCursor = retainedOldestCursor,
            retainedHistoryComplete = retainedHistoryComplete,
            authoritativeEmptyConfirmed = authoritativeEmptyConfirmed,
            authoritative = true,
        )
        val page = page(
            ownerIdentityId,
            conversationId,
            pageId = NEWEST_PAGE_ID,
            pageOrdinal = 0,
            retainedCursor = retainedOldestCursor,
            now = now,
            isNewestWindow = true,
        )
        dao.replaceSharedContentNewestWindowAndPrune(
            owner = owner,
            page = page,
            items = items.map { it.toEntity(ownerIdentityId, conversationId, NEWEST_PAGE_ID) },
            now = now.toString(),
            protectedNewestCount = policy.newestProtectedCount,
            perConversationLimit = policy.perConversationItemLimit,
            perAccountLimit = policy.perAccountItemLimit,
            inactivityCutoff = now.minus(policy.inactivityWindow).toString(),
        )
    }

    override suspend fun appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        items: List<StoredSharedContentItem>,
        retainedHistoryComplete: Boolean,
    ) {
        require(pageId.isNotBlank())
        require(pageId != NEWEST_PAGE_ID)
        require(pageOrdinal > 0)
        require(items.all {
            it.conversationId == conversationId &&
                (it.durationMs == null || it.durationMs >= 0)
        })
        val now = clock.instant()
        val existing = dao.readSharedContentCacheOwner(ownerIdentityId, conversationId)
        val owner = ownerForMutation(
            ownerIdentityId = ownerIdentityId,
            conversationId = conversationId,
            now = now,
            retainedOldestCursor = retainedCursor,
            retainedHistoryComplete = retainedHistoryComplete,
            authoritativeEmptyConfirmed = false,
            authoritative = false,
            existing = existing,
        )
        val page = page(
            ownerIdentityId,
            conversationId,
            pageId,
            pageOrdinal,
            retainedCursor,
            now,
            isNewestWindow = false,
        )
        dao.appendSharedContentBrowsedPageAndPrune(
            owner = owner,
            page = page,
            items = items.map { it.toEntity(ownerIdentityId, conversationId, pageId) },
            now = now.toString(),
            protectedNewestCount = policy.newestProtectedCount,
            perConversationLimit = policy.perConversationItemLimit,
            perAccountLimit = policy.perAccountItemLimit,
            inactivityCutoff = now.minus(policy.inactivityWindow).toString(),
        )
    }

    override suspend fun appendBrowsedPageAllocatingOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        retainedCursor: String?,
        items: List<StoredSharedContentItem>,
        retainedHistoryComplete: Boolean,
    ): Int {
        require(pageId.isNotBlank())
        require(pageId != NEWEST_PAGE_ID)
        require(items.all {
            it.conversationId == conversationId &&
                (it.durationMs == null || it.durationMs >= 0)
        })
        val now = clock.instant()
        val owner = ownerForMutation(
            ownerIdentityId = ownerIdentityId,
            conversationId = conversationId,
            now = now,
            retainedOldestCursor = retainedCursor,
            retainedHistoryComplete = retainedHistoryComplete,
            authoritativeEmptyConfirmed = false,
            authoritative = false,
            existing = dao.readSharedContentCacheOwner(ownerIdentityId, conversationId),
        )
        return dao.appendSharedContentBrowsedPageAndPruneAllocatingOrdinal(
            owner = owner,
            pageId = pageId,
            retainedCursor = retainedCursor,
            items = items.map { it.toEntity(ownerIdentityId, conversationId, pageId) },
            now = now.toString(),
            protectedNewestCount = policy.newestProtectedCount,
            perConversationLimit = policy.perConversationItemLimit,
            perAccountLimit = policy.perAccountItemLimit,
            inactivityCutoff = now.minus(policy.inactivityWindow).toString(),
        )
    }

    override suspend fun applyAcceptedTombstones(
        ownerIdentityId: String,
        conversationId: String,
        sourceMessageIds: Set<String>,
    ) {
        if (sourceMessageIds.isEmpty()) return
        val existing = dao.readSharedContentCacheOwner(ownerIdentityId, conversationId) ?: return
        val now = clock.instant()
        val owner = existing.copy(lastAccessedAt = now.toString())
        dao.applySharedContentTombstonesAndPrune(
            owner = owner,
            sourceMessageIds = sourceMessageIds.toList(),
            now = now.toString(),
            protectedNewestCount = policy.newestProtectedCount,
            perConversationLimit = policy.perConversationItemLimit,
            perAccountLimit = policy.perAccountItemLimit,
            inactivityCutoff = now.minus(policy.inactivityWindow).toString(),
        )
    }

    override suspend fun purgeConversation(ownerIdentityId: String, conversationId: String) {
        if (ownerIdentityId.isBlank() || conversationId.isBlank()) return
        dao.purgeSharedContentConversation(ownerIdentityId, conversationId)
    }

    override suspend fun purgeOwner(ownerIdentityId: String) {
        if (ownerIdentityId.isBlank()) return
        dao.purgeSharedContentOwner(ownerIdentityId)
    }

    override suspend fun verifyOwnerPurged(ownerIdentityId: String, conversationId: String?): Boolean =
        if (ownerIdentityId.isBlank()) {
            false
        } else {
            dao.verifyOwnerPurged(ownerIdentityId, conversationId)
        }

    private suspend fun ownerForMutation(
        ownerIdentityId: String,
        conversationId: String,
        now: Instant,
        retainedOldestCursor: String?,
        retainedHistoryComplete: Boolean,
        authoritativeEmptyConfirmed: Boolean,
        authoritative: Boolean,
        existing: SharedContentCacheOwnerEntity? = null,
    ): SharedContentCacheOwnerEntity {
        require(ownerIdentityId.isNotBlank())
        require(conversationId.isNotBlank())
        return SharedContentCacheOwnerEntity(
            ownerIdentityId = ownerIdentityId,
            conversationId = conversationId,
            schemaVersion = CACHE_SCHEMA_VERSION,
            savedAt = existing?.savedAt ?: now.toString(),
            lastAuthoritativeAt = if (authoritative) now.toString() else existing?.lastAuthoritativeAt,
            lastAccessedAt = now.toString(),
            authoritativeEmptyConfirmed = authoritativeEmptyConfirmed,
            retainedOldestCursor = retainedOldestCursor,
            retainedHistoryComplete = retainedHistoryComplete,
            newestWindowProtected = true,
        )
    }

    private fun page(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        now: Instant,
        isNewestWindow: Boolean,
    ) = SharedContentCachePageEntity(
        ownerIdentityId = ownerIdentityId,
        conversationId = conversationId,
        pageId = pageId,
        pageOrdinal = pageOrdinal,
        retainedCursor = retainedCursor,
        lastAccessedAt = now.toString(),
        isNewestWindow = isNewestWindow,
    )

    private companion object {
        const val CACHE_SCHEMA_VERSION = 1
        const val NEWEST_PAGE_ID = "newest"
    }
}

private val storedSharedContentOrder = Comparator<StoredSharedContentItem> { left, right ->
    compareValuesDescending(left.sourceCreatedAt, right.sourceCreatedAt)
        .takeIf { it != 0 }
        ?: compareValuesDescending(left.sourceMessageId, right.sourceMessageId)
            .takeIf { it != 0 }
        ?: right.sourceRank.compareTo(left.sourceRank)
            .takeIf { it != 0 }
        ?: compareUtf8Descending(left.itemId, right.itemId)
}

private fun compareValuesDescending(left: String, right: String): Int =
    right.compareTo(left)

private fun compareUtf8Descending(left: String, right: String): Int {
    val leftBytes = left.encodeToByteArray()
    val rightBytes = right.encodeToByteArray()
    val sharedLength = minOf(leftBytes.size, rightBytes.size)
    for (index in 0 until sharedLength) {
        val comparison = (rightBytes[index].toInt() and 0xff)
            .compareTo(leftBytes[index].toInt() and 0xff)
        if (comparison != 0) return comparison
    }
    return rightBytes.size.compareTo(leftBytes.size)
}

private fun StoredSharedContentItem.toEntity(
    ownerIdentityId: String,
    conversationId: String,
    pageId: String,
) = SharedContentCacheItemEntity(
    ownerIdentityId = ownerIdentityId,
    conversationId = conversationId,
    itemId = itemId,
    sourceMessageId = sourceMessageId,
    senderId = senderId,
    sourceCreatedAt = sourceCreatedAt,
    sourceRank = sourceRank,
    category = category,
    kind = kind,
    attachmentId = attachmentId,
    attachmentOriginalName = attachmentOriginalName,
    attachmentMimeType = attachmentMimeType,
    attachmentByteSize = attachmentByteSize,
    attachmentWidth = attachmentWidth,
    attachmentHeight = attachmentHeight,
    durationMs = durationMs,
    gifProvider = gifProvider,
    gifProviderContentId = gifProviderContentId,
    gifTitle = gifTitle,
    gifDescription = gifDescription,
    stickerId = stickerId,
    linkMetadataJson = linkMetadataJson,
    pageId = pageId,
)

private fun SharedContentCacheItemEntity.toStoredItem() = StoredSharedContentItem(
    itemId = itemId,
    conversationId = conversationId,
    sourceMessageId = sourceMessageId,
    senderId = senderId,
    sourceCreatedAt = sourceCreatedAt,
    sourceRank = sourceRank,
    category = category,
    kind = kind,
    attachmentId = attachmentId,
    attachmentOriginalName = attachmentOriginalName,
    attachmentMimeType = attachmentMimeType,
    attachmentByteSize = attachmentByteSize,
    attachmentWidth = attachmentWidth,
    attachmentHeight = attachmentHeight,
    durationMs = durationMs,
    gifProvider = gifProvider,
    gifProviderContentId = gifProviderContentId,
    gifTitle = gifTitle,
    gifDescription = gifDescription,
    stickerId = stickerId,
    linkMetadataJson = linkMetadataJson,
)
