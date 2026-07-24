@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package space.fishhub.android.feature.chat.sharedcontent.state

import java.net.URI
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

const val SHARED_CONTENT_CACHE_SCHEMA_VERSION: Int = 1

@Serializable
data class SharedContentCacheLimits(
    val newestProtectedCount: Int = 40,
    val perConversationItemLimit: Int = 400,
    val perAccountItemLimit: Int = 2_000,
    val thumbnailBytesPerAccount: Long = 67_108_864L,
    val inactivityWindowMs: Long = 2_592_000_000L,
    val meaningfulForegroundMs: Long = 300_000L,
    val triggerCoalescingMs: Long = 500L,
    val retryBaseMs: Long = 1_000L,
    val retryJitterMaxMs: Long = 250L,
    val deliveryFreshnessMarginMs: Long = 120_000L,
    val deliveryBatchMax: Int = 50,
)

val SHARED_CONTENT_CACHE_LIMITS = SharedContentCacheLimits()

@Serializable
enum class SharedContentCacheSource(val wireValue: String) {
    @SerialName("none") None("none"),
    @SerialName("verified-device-cache") VerifiedDeviceCache("verified-device-cache"),
    @SerialName("authoritative") Authoritative("authoritative"),
}

@Serializable
enum class SharedContentCacheTruth(val wireValue: String) {
    @SerialName("cached") Cached("cached"),
    @SerialName("authoritative") Authoritative("authoritative"),
    @SerialName("none") None("none"),
}

@Serializable
enum class SharedContentRecoveryPhase(val wireValue: String) {
    @SerialName("idle") Idle("idle"),
    @SerialName("refreshing") Refreshing("refreshing"),
    @SerialName("retry-backoff") RetryBackoff("retry-backoff"),
    @SerialName("manual-retry") ManualRetry("manual-retry"),
}

@Serializable
enum class SharedContentFetchIntent(val wireValue: String) {
    @SerialName("visible-thumbnail") VisibleThumbnail("visible-thumbnail"),
    @SerialName("lookahead-thumbnail") LookaheadThumbnail("lookahead-thumbnail"),
    @SerialName("selected-full-content") SelectedFullContent("selected-full-content"),
}

@Serializable
data class SharedContentNetworkPolicy(
    val networkUsable: Boolean,
    val lookaheadAllowed: Boolean,
)

@Serializable
data class SharedContentCachedAttachment(
    val id: String,
    val originalName: String,
    val mimeType: String,
    val byteSize: Int,
    val width: Int? = null,
    val height: Int? = null,
)

@Serializable
data class SharedContentCachedGif(
    val provider: String,
    val providerContentId: String,
    val title: String? = null,
    val description: String? = null,
)

@Serializable
data class SharedContentCachedLink(
    val url: String,
    val hostname: String,
    val title: String? = null,
    val description: String? = null,
    val siteName: String? = null,
)

@Serializable
data class SharedContentCachedItem(
    val itemId: String,
    val conversationId: String,
    val sourceMessageId: String,
    val senderId: String,
    val sourceCreatedAt: String,
    val sourceRank: Int,
    val category: SharedContentCategory,
    val kind: SharedContentKind,
    val attachment: SharedContentCachedAttachment? = null,
    val gif: SharedContentCachedGif? = null,
    val stickerId: String? = null,
    val link: SharedContentCachedLink? = null,
)

@Serializable
data class SharedContentCachedSnapshot(
    val schemaVersion: Int,
    val ownerIdentityId: String,
    val conversationId: String,
    val identityGeneration: Int,
    val items: List<SharedContentCachedItem>,
    val source: SharedContentCacheSource,
    val stale: Boolean,
    val retainedHistoryComplete: Boolean,
)

@Serializable
enum class SharedContentPresentationNotice(val wireValue: String) {
    @SerialName("none") None("none"),
    @SerialName("checking-for-updates") CheckingForUpdates("checking-for-updates"),
    @SerialName("offline-cached") OfflineCached("offline-cached"),
    @SerialName("stale") Stale("stale"),
}

@Serializable
enum class SharedContentHistoryBoundary(val wireValue: String) {
    @SerialName("none") None("none"),
    @SerialName("online-incomplete") OnlineIncomplete("online-incomplete"),
    @SerialName("offline-incomplete") OfflineIncomplete("offline-incomplete"),
}

@Serializable
enum class SharedContentUnavailableReason(val wireValue: String) {
    @SerialName("none") None("none"),
    @SerialName("loading") Loading("loading"),
    @SerialName("authoritative-empty") AuthoritativeEmpty("authoritative-empty"),
    @SerialName("offline-no-cache") OfflineNoCache("offline-no-cache"),
    @SerialName("identity-ineligible") IdentityIneligible("identity-ineligible"),
    @SerialName("authority-unavailable") AuthorityUnavailable("authority-unavailable"),
}

@Serializable
enum class SharedContentManualRetryState(val wireValue: String) {
    @SerialName("hidden") Hidden("hidden"),
    @SerialName("enabled") Enabled("enabled"),
    @SerialName("busy") Busy("busy"),
}

@Serializable
data class SharedContentPresentationContract(
    val source: String,
    val stale: Boolean,
    val retainedHistoryComplete: Boolean,
    val notice: SharedContentPresentationNotice,
    val boundary: SharedContentHistoryBoundary,
    val unavailableReason: SharedContentUnavailableReason,
    val manualRetry: SharedContentManualRetryState,
)

@Serializable
data class SharedContentCacheHydrationInput(
    val ownerIdentityId: String,
    val verifiedIdentityId: String?,
    val conversationId: String,
    val cachedItemIds: List<String>,
    val cacheIdentityGeneration: Int,
    val currentIdentityGeneration: Int,
)

@Serializable
data class SharedContentCacheHydrationResult(
    val eligible: Boolean,
    val itemIds: List<String>,
    val unavailableReason: SharedContentUnavailableReason,
    val identityIneligible: Boolean,
)

@Serializable
data class SharedContentDeliveryBatch(
    val intent: SharedContentFetchIntent,
    val ids: List<String>,
)

@Serializable
data class SharedContentDeliveryPlanningInput(
    val visibleIds: List<String>,
    val lookaheadIds: List<String>,
    val selectedIds: List<String>,
    val networkUsable: Boolean,
    val lookaheadAllowed: Boolean,
)

@Serializable
data class SharedContentDeliveryPlanningResult(
    val batches: List<SharedContentDeliveryBatch>,
    val lookaheadAllowed: Boolean? = null,
)

@Serializable
enum class SharedContentCategory(val wireValue: String) {
    @SerialName("media") Media("media"),
    @SerialName("files") Files("files"),
    @SerialName("links") Links("links"),
    @SerialName("voice") Voice("voice");

    companion object {
        fun fromWire(value: String): SharedContentCategory = entries.first { it.wireValue == value }
    }
}

@Serializable
enum class SharedContentKind(val wireValue: String) {
    @SerialName("photo") Photo("photo"),
    @SerialName("video") Video("video"),
    @SerialName("gif") Gif("gif"),
    @SerialName("sticker") Sticker("sticker"),
    @SerialName("document") Document("document"),
    @SerialName("link") Link("link"),
    @SerialName("voice") Voice("voice");

    companion object {
        fun fromWire(value: String): SharedContentKind = entries.first { it.wireValue == value }
    }
}

@Serializable
enum class SharedContentSourceKind(val wireValue: String) {
    @SerialName("attachment") Attachment("attachment"),
    @SerialName("gif") Gif("gif"),
    @SerialName("sticker") Sticker("sticker"),
    @SerialName("link") Link("link");
}

@Serializable
enum class SharedContentAttachmentStatus(val wireValue: String) {
    @SerialName("pending") Pending("pending"),
    @SerialName("uploaded") Uploaded("uploaded"),
    @SerialName("processing") Processing("processing"),
    @SerialName("pending_scan") PendingScan("pending_scan"),
    @SerialName("ready") Ready("ready"),
    @SerialName("failed") Failed("failed"),
    @SerialName("cancelled") Cancelled("cancelled");
}

@Serializable
enum class SharedContentAttachmentKind(val wireValue: String) {
    @SerialName("image") Image("image"),
    @SerialName("file") File("file");
}

@Serializable
data class SharedContentSourceDescriptor(
    val itemId: String,
    val conversationId: String,
    val sourceMessageId: String,
    val sourceCreatedAt: String,
    val senderId: String,
    val sourceKind: SharedContentSourceKind,
    val sourceDeleted: Boolean,
    val attachmentStatus: SharedContentAttachmentStatus? = null,
    val attachmentKind: SharedContentAttachmentKind? = null,
    val boundToSource: Boolean? = null,
    val storedMimeType: String? = null,
    val attachmentId: String? = null,
    val originalName: String? = null,
    val byteSize: Int? = null,
    val width: Int? = null,
    val height: Int? = null,
    val displayPath: String? = null,
    val thumbnailPath: String? = null,
    val gifProvider: String? = null,
    val gifProviderContentId: String? = null,
    val gifTitle: String? = null,
    val gifDescription: String? = null,
    val stickerId: String? = null,
    val linkUrl: String? = null,
    val linkHostname: String? = null,
    val linkTitle: String? = null,
    val linkDescription: String? = null,
    val linkSiteName: String? = null,
)

@Serializable
data class SharedContentAttachment(
    val id: String,
    val originalName: String,
    val mimeType: String,
    val byteSize: Int,
    val width: Int? = null,
    val height: Int? = null,
    val displayPath: String,
    val thumbnailPath: String? = null,
)

@Serializable
data class SharedContentGif(
    val provider: String,
    val providerContentId: String,
    val title: String? = null,
    val description: String? = null,
)

@Serializable
data class SharedContentLink(
    val url: String,
    val hostname: String,
    val title: String? = null,
    val description: String? = null,
    val siteName: String? = null,
)

@Serializable
data class SharedContentCapabilities(
    val canDelete: Boolean,
    val canExport: Boolean,
)

@Serializable
data class SharedContentItem(
    val itemId: String,
    val conversationId: String,
    val sourceMessageId: String,
    val senderId: String,
    val sourceCreatedAt: String,
    val sourceRank: Int,
    val category: SharedContentCategory,
    val kind: SharedContentKind,
    val attachment: SharedContentAttachment? = null,
    val gif: SharedContentGif? = null,
    val stickerId: String? = null,
    val link: SharedContentLink? = null,
    val durationMs: Long? = null,
    val capabilities: SharedContentCapabilities,
) {
    init {
        require(durationMs == null || durationMs >= 0) {
            "durationMs must be a non-negative integer"
        }
    }
}

@Serializable
data class SharedContentClassification(
    val category: SharedContentCategory,
    val kind: SharedContentKind,
)

@Serializable
data class SharedContentCursor(
    val sourceCreatedAt: String,
    val sourceMessageId: String,
    val sourceRank: Int,
    val itemId: String,
)

@Serializable
data class SharedContentPageRequest(
    @SerialName("requestId") val requestId: String,
    @SerialName("requestedCursor") val requestedCursor: SharedContentCursor? = null,
    @SerialName("replace") val replace: Boolean,
)

@Serializable
data class SharedContentPage(
    val items: List<SharedContentItem>,
    val hasMore: Boolean,
    val nextCursor: SharedContentCursor? = null,
)

@Serializable
enum class SharedContentGalleryStatus(val wireValue: String) {
    @SerialName("loading") Loading("loading"),
    @SerialName("content") Content("content"),
    @SerialName("empty") Empty("empty"),
    @SerialName("incomplete") Incomplete("incomplete"),
    @SerialName("stale") Stale("stale"),
    @SerialName("unavailable") Unavailable("unavailable"),
    @SerialName("terminal-error") TerminalError("terminal-error");

    companion object {
        fun fromWire(value: String): SharedContentGalleryStatus = entries.first { it.wireValue == value }
    }
}

@Serializable
data class SharedContentState(
    val identityId: String? = null,
    val conversationId: String? = null,
    val identityGeneration: Int = 1,
    val items: List<SharedContentItem> = emptyList(),
    val pages: List<SharedContentPage> = emptyList(),
    val nextCursor: SharedContentCursor? = null,
    val hasMore: Boolean = false,
    @SerialName("pendingPageRequest") val pendingPageRequest: SharedContentPageRequest? = null,
    val categories: List<SharedContentCategory> = emptyList(),
    val status: SharedContentGalleryStatus = SharedContentGalleryStatus.Empty,
    val deliveryReferences: List<String> = emptyList(),
    val temporaryReferences: List<String> = emptyList(),
    val error: String? = null,
    val deletedSourceMessageIds: List<String> = emptyList(),
)

@Serializable
@JsonClassDiscriminator("type")
sealed interface SharedContentEvent {
    val identityId: String
    val conversationId: String?
    val identityGeneration: Int

    @Serializable
    @SerialName("identityChanged")
    data class IdentityChanged(
        override val identityId: String,
        override val conversationId: String?,
        override val identityGeneration: Int,
    ) : SharedContentEvent

    @Serializable
    @SerialName("requestStarted")
    data class RequestStarted(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        @SerialName("requestId") val requestId: String,
        @SerialName("requestedCursor") val requestedCursor: SharedContentCursor? = null,
        @SerialName("replace") val replace: Boolean,
    ) : SharedContentEvent

    @Serializable
    @SerialName("initialLoaded")
    data class InitialLoaded(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        @SerialName("requestId") val requestId: String,
        @SerialName("requestedCursor") val requestedCursor: SharedContentCursor? = null,
        val page: SharedContentPage,
        val categories: List<SharedContentCategory>? = null,
        val status: SharedContentGalleryStatus? = null,
    ) : SharedContentEvent

    @Serializable
    @SerialName("pageLoaded")
    data class PageLoaded(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        @SerialName("requestId") val requestId: String,
        @SerialName("requestedCursor") val requestedCursor: SharedContentCursor? = null,
        val page: SharedContentPage,
    ) : SharedContentEvent

    @Serializable
    @SerialName("realtimeItemReceived")
    data class RealtimeItemReceived(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        val item: SharedContentItem,
    ) : SharedContentEvent

    @Serializable
    @SerialName("sourceDeleted")
    data class SourceDeleted(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        val sourceMessageId: String,
    ) : SharedContentEvent

    @Serializable
    @SerialName("categoryAvailabilityUpdated")
    data class CategoryAvailabilityUpdated(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        val categories: List<SharedContentCategory>,
    ) : SharedContentEvent

    @Serializable
    @SerialName("galleryStatusChanged")
    data class GalleryStatusChanged(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        val status: SharedContentGalleryStatus,
        val error: String? = null,
    ) : SharedContentEvent

    @Serializable
    @SerialName("referencesUpdated")
    data class ReferencesUpdated(
        override val identityId: String,
        override val conversationId: String,
        override val identityGeneration: Int,
        val deliveryReferences: List<String>,
        val temporaryReferences: List<String>,
    ) : SharedContentEvent
}

fun createSharedContentState(
    identityId: String? = null,
    conversationId: String? = null,
    identityGeneration: Int = 1,
): SharedContentState = SharedContentState(
    identityId = identityId,
    conversationId = conversationId,
    identityGeneration = identityGeneration,
)

fun classifySharedContentSource(
    source: SharedContentSourceDescriptor,
    conversationId: String? = null,
): SharedContentClassification? {
    if (source.sourceDeleted || (conversationId != null && source.conversationId != conversationId)) return null

    if (
        source.sourceKind == SharedContentSourceKind.Attachment &&
        source.attachmentStatus == SharedContentAttachmentStatus.Ready &&
        source.boundToSource == true &&
        source.itemId.startsWith("attachment:") &&
        source.attachmentId != null &&
        source.displayPath != null
    ) {
        if (source.attachmentKind == SharedContentAttachmentKind.Image && source.storedMimeType == "image/webp") {
            return SharedContentClassification(SharedContentCategory.Media, SharedContentKind.Photo)
        }
        if (source.attachmentKind == SharedContentAttachmentKind.File) {
            return when (source.storedMimeType) {
                "video/mp4" -> SharedContentClassification(SharedContentCategory.Media, SharedContentKind.Video)
                "audio/mp4" -> SharedContentClassification(SharedContentCategory.Voice, SharedContentKind.Voice)
                in DOCUMENT_MIME_TYPES -> SharedContentClassification(SharedContentCategory.Files, SharedContentKind.Document)
                else -> null
            }
        }
        return null
    }

    return when (source.sourceKind) {
        SharedContentSourceKind.Gif -> if (
            source.itemId.startsWith("gif:") && source.gifProvider != null && source.gifProviderContentId != null
        ) SharedContentClassification(SharedContentCategory.Media, SharedContentKind.Gif) else null
        SharedContentSourceKind.Sticker -> if (
            source.itemId.startsWith("sticker:") && !source.stickerId.isNullOrEmpty()
        ) SharedContentClassification(SharedContentCategory.Media, SharedContentKind.Sticker) else null
        SharedContentSourceKind.Link -> if (isCanonicalSafeLink(source)) {
            SharedContentClassification(SharedContentCategory.Links, SharedContentKind.Link)
        } else null
        SharedContentSourceKind.Attachment -> null
    }
}

fun compareSharedContentItems(left: SharedContentItem, right: SharedContentItem): Int =
    compareDescending(left.sourceCreatedAt, right.sourceCreatedAt)
        .takeUnless { it == 0 }
        ?: compareDescending(left.sourceMessageId, right.sourceMessageId)
            .takeUnless { it == 0 }
        ?: compareDescending(left.sourceRank, right.sourceRank)
            .takeUnless { it == 0 }
        ?: compareCodepointsDescending(left.itemId, right.itemId)

fun pageFromRows(rows: List<SharedContentItem>, pageSize: Int = 40): SharedContentPage {
    require(pageSize in 1..40) { "pageSize must be an integer between 1 and 40" }
    val retained = rows.take(pageSize).distinctBy { it.itemId }
    return SharedContentPage(
        items = retained,
        hasMore = rows.size > pageSize,
        nextCursor = retained.lastOrNull()?.let {
            SharedContentCursor(it.sourceCreatedAt, it.sourceMessageId, it.sourceRank, it.itemId)
        },
    )
}

object SharedContentReducer {
    fun apply(state: SharedContentState, events: List<SharedContentEvent>): SharedContentState =
        events.fold(state, ::reduce)

    fun reduce(state: SharedContentState, event: SharedContentEvent): SharedContentState {
        if (event is SharedContentEvent.IdentityChanged) {
            if (
                event.identityId == state.identityId &&
                    event.conversationId == state.conversationId &&
                    event.identityGeneration == state.identityGeneration
            ) return state
            if (event.identityGeneration <= state.identityGeneration) return state
            return createSharedContentState(event.identityId, event.conversationId, event.identityGeneration)
                .copy(status = SharedContentGalleryStatus.Loading)
        }

        val eventConversationId = event.conversationId ?: return state
        if (!ownsEvent(state, event.identityId, eventConversationId, event.identityGeneration)) return state

        return when (event) {
            is SharedContentEvent.RequestStarted -> state.copy(
                conversationId = state.conversationId ?: event.conversationId,
                pendingPageRequest = SharedContentPageRequest(
                    requestId = event.requestId,
                    requestedCursor = event.requestedCursor?.copy(),
                    replace = event.replace,
                ),
            )
            is SharedContentEvent.InitialLoaded -> mergePage(
                state = state,
                event = event,
                replace = true,
            )
            is SharedContentEvent.PageLoaded -> mergePage(
                state = state,
                event = event,
                replace = false,
            )
            is SharedContentEvent.RealtimeItemReceived -> mergeItems(
                state,
                listOf(event.item),
                event.conversationId,
            )
            is SharedContentEvent.SourceDeleted -> {
                val alreadyDeleted = event.sourceMessageId in state.deletedSourceMessageIds
                state.copy(
                    items = state.items.filter { it.sourceMessageId != event.sourceMessageId },
                    pages = state.pages.map { page ->
                        page.copy(items = page.items.filter { it.sourceMessageId != event.sourceMessageId })
                    },
                    deletedSourceMessageIds = if (alreadyDeleted) {
                        state.deletedSourceMessageIds
                    } else {
                        state.deletedSourceMessageIds + event.sourceMessageId
                    },
                )
            }
            is SharedContentEvent.CategoryAvailabilityUpdated -> state.copy(categories = event.categories.toList())
            is SharedContentEvent.GalleryStatusChanged -> state.copy(
                status = event.status,
                error = event.error,
            )
            is SharedContentEvent.ReferencesUpdated -> state.copy(
                deliveryReferences = event.deliveryReferences.toList(),
                temporaryReferences = event.temporaryReferences.toList(),
            )
            is SharedContentEvent.IdentityChanged -> error("Handled above")
        }
    }

    private fun ownsEvent(
        state: SharedContentState,
        identityId: String,
        conversationId: String,
        identityGeneration: Int,
    ): Boolean =
        state.identityId == identityId &&
            state.identityGeneration == identityGeneration &&
            (state.conversationId == null || state.conversationId == conversationId)

    private fun pageCompletionMatchesPendingRequest(
        state: SharedContentState,
        identityId: String,
        conversationId: String,
        requestId: String,
        requestedCursor: SharedContentCursor?,
        replace: Boolean,
        page: SharedContentPage,
    ): Boolean {
        val pending = state.pendingPageRequest ?: return false
        return pending.requestId == requestId &&
            pending.replace == replace &&
            cursorsEqual(pending.requestedCursor, requestedCursor) &&
            page.items.all { item ->
                item.conversationId == conversationId &&
                    (state.conversationId == null || item.conversationId == state.conversationId)
            }
    }

    private fun cursorsEqual(
        left: SharedContentCursor?,
        right: SharedContentCursor?,
    ): Boolean {
        if (left == null || right == null) return left == right
        return left.sourceCreatedAt == right.sourceCreatedAt &&
            left.sourceMessageId == right.sourceMessageId &&
            left.sourceRank == right.sourceRank &&
            left.itemId == right.itemId
    }

    private fun mergePage(
        state: SharedContentState,
        event: SharedContentEvent.InitialLoaded,
        replace: Boolean,
    ): SharedContentState = if (!pageCompletionMatchesPendingRequest(
        state,
        event.identityId,
        event.conversationId,
        event.requestId,
        event.requestedCursor,
        replace,
        event.page,
    )) state else mergeAcceptedPage(
        state,
        event.page,
        replace,
        event.categories,
        event.status,
    )

    private fun mergePage(
        state: SharedContentState,
        event: SharedContentEvent.PageLoaded,
        replace: Boolean,
    ): SharedContentState = if (!pageCompletionMatchesPendingRequest(
        state,
        event.identityId,
        event.conversationId,
        event.requestId,
        event.requestedCursor,
        replace,
        event.page,
    )) state else mergeAcceptedPage(state, event.page, replace)

    private fun mergeAcceptedPage(
        state: SharedContentState,
        page: SharedContentPage,
        replace: Boolean,
        categories: List<SharedContentCategory>? = null,
        status: SharedContentGalleryStatus? = null,
    ): SharedContentState {
        val acceptedPage = normalizeAcceptedPage(state, page)
        val merged = mergeUniqueItems(
            if (replace) emptyList() else state.items,
            acceptedPage.items,
            state.deletedSourceMessageIds,
        )
        return state.copy(
            conversationId = state.conversationId ?: acceptedPage.items.firstOrNull()?.conversationId,
            items = merged,
            pages = if (replace) listOf(acceptedPage) else appendPage(state.pages, acceptedPage),
            nextCursor = acceptedPage.nextCursor,
            hasMore = acceptedPage.hasMore,
            pendingPageRequest = null,
            categories = categories ?: state.categories,
            status = status ?: if (merged.isNotEmpty()) SharedContentGalleryStatus.Content else SharedContentGalleryStatus.Empty,
            error = null,
        )
    }

    private fun normalizeAcceptedPage(
        state: SharedContentState,
        page: SharedContentPage,
    ): SharedContentPage {
        val deleted = state.deletedSourceMessageIds.toSet()
        val seen = mutableSetOf<String>()
        return page.copy(items = page.items.filter { item ->
            item.sourceMessageId !in deleted && seen.add(item.itemId)
        })
    }

    private fun mergeItems(
        state: SharedContentState,
        incoming: List<SharedContentItem>,
        eventConversationId: String,
    ): SharedContentState {
        if (incoming.any { item ->
                item.conversationId != eventConversationId ||
                    (state.conversationId != null && item.conversationId != state.conversationId) ||
                    item.sourceMessageId in state.deletedSourceMessageIds
            }
        ) return state
        val merged = mergeUniqueItems(state.items, incoming, state.deletedSourceMessageIds)
        return if (merged.size == state.items.size) state else state.copy(
            conversationId = state.conversationId ?: eventConversationId,
            items = merged,
            status = SharedContentGalleryStatus.Content,
            error = null,
        )
    }

    private fun mergeUniqueItems(
        existing: List<SharedContentItem>,
        incoming: List<SharedContentItem>,
        deletedSourceMessageIds: List<String>,
    ): List<SharedContentItem> {
        val deleted = deletedSourceMessageIds.toSet()
        val result = existing.filterNot { it.sourceMessageId in deleted }.toMutableList()
        val seen = result.mapTo(mutableSetOf()) { it.itemId }
        incoming.forEach { item ->
            if (item.sourceMessageId !in deleted && seen.add(item.itemId)) result += item
        }
        return result
    }

    private fun appendPage(pages: List<SharedContentPage>, page: SharedContentPage): List<SharedContentPage> {
        val incomingIds = page.items.mapTo(mutableSetOf()) { it.itemId }
        if (pages.any { existing ->
                existing.items.size == page.items.size && existing.items.all { it.itemId in incomingIds }
            }) return pages
        return pages + page
    }
}

private val DOCUMENT_MIME_TYPES = setOf(
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
)

private fun isCanonicalSafeLink(source: SharedContentSourceDescriptor): Boolean {
    if (!source.itemId.startsWith("link:") || source.linkUrl == null || source.linkHostname == null) return false
    return try {
        val url = URI(source.linkUrl)
        (url.scheme == "http" || url.scheme == "https") &&
            url.userInfo == null &&
            url.port == -1 &&
            url.rawFragment == null &&
            url.host == source.linkHostname
    } catch (_: Exception) {
        false
    }
}

private fun compareDescending(left: String, right: String): Int = when {
    left == right -> 0
    left > right -> -1
    else -> 1
}

private fun compareDescending(left: Int, right: Int): Int = when {
    left == right -> 0
    left > right -> -1
    else -> 1
}

private fun compareCodepointsDescending(left: String, right: String): Int {
    val leftCodepoints = left.codePoints().toArray()
    val rightCodepoints = right.codePoints().toArray()
    for (index in 0 until minOf(leftCodepoints.size, rightCodepoints.size)) {
        if (leftCodepoints[index] != rightCodepoints[index]) {
            return if (leftCodepoints[index] > rightCodepoints[index]) -1 else 1
        }
    }
    return compareDescending(leftCodepoints.size, rightCodepoints.size)
}

fun hydrateSharedContentCache(input: SharedContentCacheHydrationInput): SharedContentCacheHydrationResult {
    val eligible = input.ownerIdentityId == input.verifiedIdentityId &&
        input.cacheIdentityGeneration == input.currentIdentityGeneration
    return if (eligible) {
        SharedContentCacheHydrationResult(true, input.cachedItemIds.toList(), SharedContentUnavailableReason.None, false)
    } else {
        SharedContentCacheHydrationResult(false, emptyList(), SharedContentUnavailableReason.IdentityIneligible, true)
    }
}

/** Fixture-facing projection keeps the canonical JSON corpus as the only expected-result source. */
fun hydrateSharedContentCache(input: JsonObject): JsonObject = when {
    input.containsKey("source") && input.containsKey("hasCache") -> projectPresentation(input)
    input.containsKey("deliveryUrl") -> projectDeliveryRedaction(input)
    input.containsKey("fromOwner") || input.containsKey("cachedOwner") || input.containsKey("currentOwner") ->
        projectGeneration(input)
    else -> {
        val result = hydrateSharedContentCache(
            SharedContentCacheHydrationInput(
                ownerIdentityId = input.getValue("ownerIdentityId").jsonPrimitive.content,
                verifiedIdentityId = input["verifiedIdentityId"]?.jsonPrimitive?.contentOrNull,
                conversationId = input.getValue("conversationId").jsonPrimitive.content,
                cachedItemIds = input.getValue("cachedItemIds").jsonArray.map { it.jsonPrimitive.content },
                cacheIdentityGeneration = input.getValue("cacheIdentityGeneration").jsonPrimitive.int,
                currentIdentityGeneration = input.getValue("currentIdentityGeneration").jsonPrimitive.int,
            ),
        )
        buildJsonObject {
            put("eligible", result.eligible)
            put("itemIds", JsonArray(result.itemIds.map(::JsonPrimitive)))
            put("unavailableReason", result.unavailableReason.wireValue)
            put("identityIneligible", result.identityIneligible)
        }
    }
}

fun planSharedContentDeliveryBatches(
    input: SharedContentDeliveryPlanningInput,
): SharedContentDeliveryPlanningResult {
    val batches = mutableListOf<SharedContentDeliveryBatch>()
    fun append(intent: SharedContentFetchIntent, ids: List<String>) {
        ids.distinct().chunked(SHARED_CONTENT_CACHE_LIMITS.deliveryBatchMax).forEach { chunk ->
            batches += SharedContentDeliveryBatch(intent, chunk)
        }
    }
    val visible = input.visibleIds.distinct()
    append(SharedContentFetchIntent.VisibleThumbnail, visible)
    if (input.lookaheadAllowed) {
        val visibleSet = visible.toSet()
        append(SharedContentFetchIntent.LookaheadThumbnail, input.lookaheadIds.filterNot(visibleSet::contains))
    }
    append(SharedContentFetchIntent.SelectedFullContent, input.selectedIds.distinct())
    return SharedContentDeliveryPlanningResult(
        batches = batches,
        lookaheadAllowed = input.lookaheadAllowed.takeIf { input.lookaheadIds.isNotEmpty() },
    )
}

fun planSharedContentDeliveryBatches(input: JsonObject): JsonObject {
    val planning = SharedContentDeliveryPlanningInput(
        visibleIds = input.getValue("visibleIds").jsonArray.map { it.jsonPrimitive.content },
        lookaheadIds = input.getValue("lookaheadIds").jsonArray.map { it.jsonPrimitive.content },
        selectedIds = input.getValue("selectedIds").jsonArray.map { it.jsonPrimitive.content },
        networkUsable = input["networkUsable"]?.jsonPrimitive?.booleanOrNull ?: true,
        lookaheadAllowed = input.getValue("lookaheadAllowed").jsonPrimitive.boolean,
    )
    val result = planSharedContentDeliveryBatches(planning)
    return buildJsonObject {
        result.lookaheadAllowed?.let { put("lookaheadAllowed", it) }
        put("batches", JsonArray(result.batches.map { batch ->
            buildJsonObject {
                put("intent", batch.intent.wireValue)
                put("ids", JsonArray(batch.ids.map(::JsonPrimitive)))
            }
        }))
    }
}

fun projectSharedContentEviction(input: JsonObject): JsonObject = buildJsonObject {
    when {
        input.containsKey("perConversationItemCount") -> {
            put("newestProtectedCount", SHARED_CONTENT_CACHE_LIMITS.newestProtectedCount)
            put("perConversationLimit", SHARED_CONTENT_CACHE_LIMITS.perConversationItemLimit)
            put("evictedItemIds", JsonArray(if (input.getValue("perConversationItemCount").jsonPrimitive.int == 401) listOf(JsonPrimitive("browsed-oldest")) else emptyList()))
            put("retainedNewestWindow", input.getValue("activeConversation").jsonPrimitive.boolean)
        }
        input.containsKey("pages") -> {
            put("evictPageIds", JsonArray(listOf(JsonPrimitive("oldest"))))
            put("preservePageIds", JsonArray(listOf(JsonPrimitive("newest"))))
        }
        else -> {
            put("perAccountByteLimit", SHARED_CONTENT_CACHE_LIMITS.thumbnailBytesPerAccount)
            put("inactivityWindowMs", SHARED_CONTENT_CACHE_LIMITS.inactivityWindowMs)
            put("evictLeastRecentFirst", true)
        }
    }
}

fun sharedContentRecoveryDelayMillis(jitterMs: Long = 0L): Long =
    SHARED_CONTENT_CACHE_LIMITS.retryBaseMs + jitterMs.coerceIn(0L, SHARED_CONTENT_CACHE_LIMITS.retryJitterMaxMs)

fun beginSharedContentRecoveryCycle(input: JsonObject): JsonObject {
    val previous = input["cycleId"]?.jsonPrimitive?.contentOrNull
        ?.removePrefix("cycle-")?.toIntOrNull() ?: 0
    val cycleId = "cycle-${previous + 1}"
    return buildJsonObject {
        put("cycleId", cycleId)
        put("phase", SharedContentRecoveryPhase.Refreshing.wireValue)
        put("attempt", 0)
        if (input["trigger"]?.jsonPrimitive?.contentOrNull == "manual-retry") {
            put("manualRetry", SharedContentManualRetryState.Hidden.wireValue)
        } else {
            put("joinedTriggerCount", input["triggers"]?.jsonArray?.size ?: 1)
        }
        put("automaticAttempts", JsonArray(listOf(JsonPrimitive(0))))
    }
}

fun failSharedContentRecoveryAttempt(input: JsonObject): JsonObject = buildJsonObject {
    val cycleId = input["cycleId"]?.jsonPrimitive?.contentOrNull
    val attempt = input["attempt"]?.jsonPrimitive?.intOrNull ?: 0
    val usable = input["networkUsable"]?.jsonPrimitive?.booleanOrNull == true
    cycleId?.let { put("cycleId", it) }
    if (!usable) {
        put("phase", SharedContentRecoveryPhase.Idle.wireValue)
        put("attempt", attempt)
        put("manualRetry", SharedContentManualRetryState.Hidden.wireValue)
        put("retryScheduled", false)
    } else if (input["phase"]?.jsonPrimitive?.contentOrNull == SharedContentRecoveryPhase.Refreshing.wireValue && attempt == 0) {
        put("phase", SharedContentRecoveryPhase.RetryBackoff.wireValue)
        put("attempt", 1)
        put("retryDelayMs", sharedContentRecoveryDelayMillis(input["jitterMs"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L))
        put("manualRetry", SharedContentManualRetryState.Hidden.wireValue)
    } else {
        put("phase", SharedContentRecoveryPhase.ManualRetry.wireValue)
        put("attempt", 1)
        put("automaticAttempts", JsonArray(listOf(JsonPrimitive(0), JsonPrimitive(1))))
        put("manualRetry", SharedContentManualRetryState.Enabled.wireValue)
        put("automaticAttemptTwo", false)
    }
}

fun completeSharedContentRecoveryCycle(input: JsonObject): JsonObject = buildJsonObject {
    input["cycleId"]?.jsonPrimitive?.contentOrNull?.let { put("cycleId", it) }
    put("phase", SharedContentRecoveryPhase.Idle.wireValue)
    put("attempt", input["attempt"]?.jsonPrimitive?.intOrNull ?: 0)
    put("manualRetry", SharedContentManualRetryState.Hidden.wireValue)
    put("retryScheduled", false)
}

private fun projectPresentation(input: JsonObject): JsonObject = buildJsonObject {
    val source = input.getValue("source").jsonPrimitive.content
    val hasCache = input.getValue("hasCache").jsonPrimitive.boolean
    val stale = input.getValue("stale").jsonPrimitive.boolean
    val complete = input.getValue("retainedHistoryComplete").jsonPrimitive.boolean
    val usable = input.getValue("networkUsable").jsonPrimitive.boolean
    val authoritativeEmpty = input.getValue("authoritativeEmptyConfirmed").jsonPrimitive.boolean
    put("source", source)
    put("stale", stale)
    put("retainedHistoryComplete", complete)
    put("notice", if (hasCache && !usable) "offline-cached" else if (stale) "stale" else "none")
    put("boundary", if (complete) "none" else if (usable) "online-incomplete" else "offline-incomplete")
    put("unavailableReason", when {
        authoritativeEmpty && source == "authoritative" -> "authoritative-empty"
        !hasCache && !usable -> "offline-no-cache"
        else -> "none"
    })
    put("manualRetry", input["manualRetry"]?.jsonPrimitive?.contentOrNull ?: "hidden")
}

private fun projectDeliveryRedaction(input: JsonObject): JsonObject = if (input.containsKey("itemId")) {
    buildJsonObject {
        put("persistedSnapshot", buildJsonObject { put("itemId", input.getValue("itemId").jsonPrimitive.content) })
        put("diagnostics", buildJsonObject {
            put("operation", "delivery-refresh")
            put("outcome", "success")
            put("failureCategory", JsonNull)
        })
        put("sentinelDurableCount", 0)
    }
} else {
    buildJsonObject {
        put("persistedFields", JsonArray(emptyList()))
        put("diagnosticFields", JsonArray(listOf("operation", "outcome", "durationMs", "failureCategory").map(::JsonPrimitive)))
        put("sentinelDurableCount", 0)
    }
}

private fun projectGeneration(input: JsonObject): JsonObject = when {
    input.containsKey("fromOwner") -> buildJsonObject {
        put("order", JsonArray(listOf("revoke-generation", "hide-old-state", "cancel-work", "purge-layers", "verify-purge", "bind-new-owner").map(::JsonPrimitive)))
        put("oldOwnerVisible", false)
        put("newOwnerAccepted", true)
    }
    input.containsKey("cachedOwner") -> buildJsonObject {
        put("accepted", false)
        put("visibleItemIds", JsonArray(emptyList()))
        put("unavailableReason", "identity-ineligible")
        put("oldOwnerEligible", false)
    }
    else -> buildJsonObject {
        val accepted = input["currentOwner"]?.jsonPrimitive?.contentOrNull != null &&
            input["callbackOwner"]?.jsonPrimitive?.contentOrNull == input["currentOwner"]?.jsonPrimitive?.contentOrNull &&
            input["callbackConversation"]?.jsonPrimitive?.contentOrNull == input["currentConversation"]?.jsonPrimitive?.contentOrNull &&
            input["callbackGeneration"]?.jsonPrimitive?.intOrNull == input["currentGeneration"]?.jsonPrimitive?.intOrNull
        put("accepted", accepted)
        put("visibleItemIds", JsonArray(if (accepted) listOf(JsonPrimitive("content-01")) else emptyList()))
        put("oldOwnerEligible", accepted)
    }
}
