package space.fishhub.android.feature.chat.sharedcontent

import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationContract

enum class SharedContentGalleryCategory(
    val wireValue: String,
    val label: String,
) {
    Media("media", "Media"),
    Files("files", "Files"),
    Links("links", "Links"),
    Voice("voice", "Voice"),
    ;

    companion object {
        fun fromWireValue(value: String): SharedContentGalleryCategory? =
            entries.firstOrNull { it.wireValue == value }
    }
}

enum class SharedContentTextDirection {
    Natural,
    Isolate,
}

sealed interface SharedContentGalleryItem {
    val itemId: String
    val category: SharedContentGalleryCategory
    val kind: String
    val accessibilityLabel: String
    val selectionEnabled: Boolean

    data class Media(
        override val itemId: String,
        override val kind: String,
        val title: String?,
        val description: String?,
        val width: Int?,
        val height: Int?,
        val thumbnailHandle: SharedContentThumbnailHandle =
            SharedContentThumbnailHandle(itemId, itemId),
        internal val stickerId: String? = null,
        override val accessibilityLabel: String,
        override val selectionEnabled: Boolean,
    ) : SharedContentGalleryItem {
        override val category = SharedContentGalleryCategory.Media
    }

    data class File(
        override val itemId: String,
        override val kind: String,
        val filename: String,
        val filenameDirection: SharedContentTextDirection,
        val friendlyType: String,
        val sizeLabel: String?,
        override val accessibilityLabel: String,
        override val selectionEnabled: Boolean,
    ) : SharedContentGalleryItem {
        override val category = SharedContentGalleryCategory.Files
    }

    data class Link(
        override val itemId: String,
        override val kind: String,
        val title: String,
        val hostname: String?,
        val hostnameDirection: SharedContentTextDirection,
        override val accessibilityLabel: String,
        override val selectionEnabled: Boolean,
    ) : SharedContentGalleryItem {
        override val category = SharedContentGalleryCategory.Links
    }

    data class Voice(
        override val itemId: String,
        override val kind: String,
        val durationLabel: String,
        override val accessibilityLabel: String,
        override val selectionEnabled: Boolean,
    ) : SharedContentGalleryItem {
        override val category = SharedContentGalleryCategory.Voice
    }
}

data class SharedContentThumbnailHandle(
    val itemId: String,
    val contentVersion: String,
) {
    init {
        require(itemId.isNotBlank())
        require(contentVersion.isNotBlank())
    }
}

data class SharedContentGalleryAnchor(
    val itemId: String,
    val scrollOffset: Int = 0,
    val focusedItemId: String? = null,
) {
    init {
        require(itemId.isNotBlank())
        require(scrollOffset >= 0)
    }
}

data class SharedContentGalleryUiState(
    val categories: List<SharedContentGalleryCategory>,
    val selectedCategory: SharedContentGalleryCategory?,
    val showCategoryControl: Boolean,
    val items: List<SharedContentGalleryItem>,
    val anchors: Map<SharedContentGalleryCategory, SharedContentGalleryAnchor>,
    val presentation: SharedContentPresentationContract,
    val earlierState: SharedContentEarlierState,
    val itemSelectionEnabled: Boolean,
)

sealed interface SharedContentGalleryIntent {
    data class SelectCategory(
        val category: SharedContentGalleryCategory,
    ) : SharedContentGalleryIntent

    data class ReportVisibility(
        val visibleItemIds: List<String>,
        val lookaheadItemIds: List<String> = emptyList(),
    ) : SharedContentGalleryIntent

    data class RecordAnchor(
        val category: SharedContentGalleryCategory,
        val itemId: String,
        val scrollOffset: Int = 0,
        val focusedItemId: String? = null,
    ) : SharedContentGalleryIntent

    data object Retry : SharedContentGalleryIntent
    data object ShowEarlier : SharedContentGalleryIntent

    data class ConfirmDisplayed(
        val itemId: String,
        val contentVersion: String,
    ) : SharedContentGalleryIntent

    data class SelectItem(
        val itemId: String,
    ) : SharedContentGalleryIntent

    data object Close : SharedContentGalleryIntent
}

/**
 * Route-scoped projection over the accepted Phase 12 store.
 *
 * The presenter owns only session selection, anchors, safe labels, and typed
 * intents. Network, persistence, identity, and delivery authority remain in
 * [SharedContentStore].
 */
class SharedContentGalleryPresenter(
    private val store: SharedContentStore,
    private val scope: CoroutineScope,
    private val locale: Locale = Locale.getDefault(),
    dispatcher: CoroutineDispatcher = Dispatchers.Default,
    private val onSelectItem: ((String) -> Unit)? = null,
) {
    private val lock = Any()
    private var acceptedItems = emptyList<SharedContentAcceptedItem>()
    private var presentation = store.presentation.value
    private var earlierState = store.earlierState.value
    private var selectedCategory: SharedContentGalleryCategory? = null
    private val anchors = mutableMapOf<SharedContentGalleryCategory, SharedContentGalleryAnchor>()
    private var closed = false
    private val _uiState = MutableStateFlow(stateLocked())
    private val observationJob: Job

    val uiState: StateFlow<SharedContentGalleryUiState> = _uiState.asStateFlow()
    val state: StateFlow<SharedContentGalleryUiState> = uiState

    init {
        observationJob = scope.launch(dispatcher) {
            combine(
                store.acceptedItems,
                store.presentation,
                store.earlierState,
            ) { items, presentation, earlier ->
                Triple(items, presentation, earlier)
            }.collect { (items, nextPresentation, nextEarlier) ->
                synchronized(lock) {
                    if (closed) return@collect
                    val priorItems = acceptedItems
                    acceptedItems = items
                    presentation = nextPresentation
                    earlierState = nextEarlier
                    reconcileSessionLocked(priorItems)
                    publishLocked()
                }
            }
        }
    }

    fun dispatch(intent: SharedContentGalleryIntent) {
        when (intent) {
            is SharedContentGalleryIntent.SelectCategory -> selectCategory(intent.category)
            is SharedContentGalleryIntent.ReportVisibility -> visibility(
                visibleItemIds = intent.visibleItemIds,
                lookaheadItemIds = intent.lookaheadItemIds,
            )
            is SharedContentGalleryIntent.RecordAnchor -> recordAnchor(
                category = intent.category,
                itemId = intent.itemId,
                scrollOffset = intent.scrollOffset,
                focusedItemId = intent.focusedItemId,
            )
            SharedContentGalleryIntent.Retry -> store.retry()
            SharedContentGalleryIntent.ShowEarlier -> store.loadEarlier()
            is SharedContentGalleryIntent.ConfirmDisplayed -> {
                displayConfirmed(intent.itemId, intent.contentVersion)
            }
            is SharedContentGalleryIntent.SelectItem -> selectItem(intent.itemId)
            SharedContentGalleryIntent.Close -> close()
        }
    }

    fun selectCategory(category: SharedContentGalleryCategory) {
        val changed = synchronized(lock) {
            if (closed || category !in populatedCategoriesLocked()) return
            if (selectedCategory == category) return
            selectedCategory = category
            publishLocked()
            true
        }
        if (changed) {
            // A category transition has no measured viewport yet. Cancel the
            // prior category's delivery and wait for the new layout report.
            store.clearVisibility()
        }
    }

    fun recordAnchor(
        category: SharedContentGalleryCategory,
        itemId: String,
        scrollOffset: Int = 0,
        focusedItemId: String? = null,
    ) {
        synchronized(lock) {
            if (closed || acceptedItems.none {
                    it.category == category.wireValue && it.itemId == itemId
                }
            ) return
            val acceptedFocus = focusedItemId?.takeIf { focusId ->
                acceptedItems.any {
                    it.category == category.wireValue && it.itemId == focusId
                }
            }
            anchors[category] = SharedContentGalleryAnchor(
                itemId = itemId,
                scrollOffset = scrollOffset,
                focusedItemId = acceptedFocus,
            )
            publishLocked()
        }
    }

    fun anchor(category: SharedContentGalleryCategory): SharedContentGalleryAnchor? =
        synchronized(lock) { anchors[category] }

    fun visibility(
        visibleItemIds: List<String>,
        lookaheadItemIds: List<String> = emptyList(),
    ) {
        val (visible, lookahead) = synchronized(lock) {
            if (closed) return
            val selected = selectedCategory ?: return
            val acceptedIds = acceptedItems
                .asSequence()
                .filter { it.category == selected.wireValue }
                .mapTo(mutableSetOf(), SharedContentAcceptedItem::itemId)
            visibleItemIds.filter(acceptedIds::contains) to
                lookaheadItemIds.filter(acceptedIds::contains)
        }
        store.visibility(
            visibleIds = visible,
            lookaheadIds = lookahead,
        )
    }

    fun retry() = store.retry()

    fun showEarlier() = store.loadEarlier()

    fun displayConfirmed(itemId: String, contentVersion: String): Boolean {
        val accepted = synchronized(lock) {
            !closed && acceptedItems.any { it.itemId == itemId }
        }
        return accepted && store.displayConfirmed(itemId, contentVersion)
    }

    fun displayConfirmed(itemId: String): Boolean {
        val item = synchronized(lock) {
            acceptedItems.firstOrNull { !closed && it.itemId == itemId }
        } ?: return false
        return store.displayConfirmed(item.itemId, item.contentVersion)
    }

    fun selectItem(itemId: String): Boolean {
        val callback = synchronized(lock) {
            onSelectItem?.takeIf {
                !closed && acceptedItems.any { item -> item.itemId == itemId }
            }
        } ?: return false
        callback(itemId)
        return true
    }

    fun close() {
        synchronized(lock) {
            if (closed) return
            closed = true
            acceptedItems = emptyList()
            selectedCategory = null
            anchors.clear()
            earlierState = SharedContentEarlierState.Hidden
            publishLocked()
        }
        observationJob.cancel()
        store.close()
    }

    private fun reconcileSessionLocked(priorItems: List<SharedContentAcceptedItem>) {
        val categories = populatedCategoriesLocked()
        selectedCategory = selectedCategory
            ?.takeIf(categories::contains)
            ?: categories.firstOrNull()
        anchors.keys.retainAll(categories.toSet())
        anchors.entries.toList().forEach { (category, anchor) ->
            val currentCategoryItems = acceptedItems.filter {
                it.category == category.wireValue
            }
            if (currentCategoryItems.any { it.itemId == anchor.itemId }) {
                val focus = anchor.focusedItemId?.takeIf { focusId ->
                    currentCategoryItems.any { it.itemId == focusId }
                }
                anchors[category] = anchor.copy(focusedItemId = focus)
                return@forEach
            }
            val priorCategoryItems = priorItems.filter {
                it.category == category.wireValue
            }
            val priorIndex = priorCategoryItems.indexOfFirst { it.itemId == anchor.itemId }
                .coerceAtLeast(0)
            val replacement = currentCategoryItems.getOrNull(
                priorIndex.coerceAtMost(currentCategoryItems.lastIndex),
            )
            if (replacement == null) {
                anchors.remove(category)
            } else {
                anchors[category] = anchor.copy(
                    itemId = replacement.itemId,
                    focusedItemId = replacement.itemId.takeIf {
                        anchor.focusedItemId != null
                    },
                )
            }
        }
    }

    private fun publishLocked() {
        _uiState.value = stateLocked()
    }

    private fun stateLocked(): SharedContentGalleryUiState {
        val categories = populatedCategoriesLocked()
        val selected = selectedCategory?.takeIf(categories::contains)
            ?: categories.firstOrNull()
        val items = acceptedItems
            .filter { it.category == selected?.wireValue }
            .mapNotNull(::displayItem)
        return SharedContentGalleryUiState(
            categories = categories,
            selectedCategory = selected,
            showCategoryControl = categories.size > 1,
            items = items,
            anchors = anchors.toMap(),
            presentation = presentation,
            earlierState = earlierState,
            itemSelectionEnabled = onSelectItem != null,
        )
    }

    private fun populatedCategoriesLocked(): List<SharedContentGalleryCategory> =
        SharedContentGalleryCategory.entries.filter { category ->
            acceptedItems.any { it.category == category.wireValue }
        }

    private fun displayItem(item: SharedContentAcceptedItem): SharedContentGalleryItem? =
        when (SharedContentGalleryCategory.fromWireValue(item.category)) {
            SharedContentGalleryCategory.Media -> mediaItem(item)
            SharedContentGalleryCategory.Files -> fileItem(item)
            SharedContentGalleryCategory.Links -> linkItem(item)
            SharedContentGalleryCategory.Voice -> voiceItem(item)
            null -> null
        }

    private fun mediaItem(item: SharedContentAcceptedItem): SharedContentGalleryItem.Media {
        val kindLabel = when (item.kind) {
            "photo" -> "Photo"
            "video" -> "Video"
            "gif" -> "GIF"
            "sticker" -> "Sticker"
            else -> "Media"
        }
        val title = item.mediaTitle?.takeIf(String::isNotBlank)
        return SharedContentGalleryItem.Media(
            itemId = item.itemId,
            kind = item.kind,
            title = title,
            description = item.mediaDescription?.takeIf(String::isNotBlank),
            width = item.width,
            height = item.height,
            thumbnailHandle = SharedContentThumbnailHandle(item.itemId, item.contentVersion),
            stickerId = item.stickerId,
            accessibilityLabel = title?.let { "$kindLabel, $it" } ?: kindLabel,
            selectionEnabled = onSelectItem != null,
        )
    }

    private fun fileItem(item: SharedContentAcceptedItem): SharedContentGalleryItem.File {
        val filename = item.originalName?.takeIf(String::isNotBlank) ?: "File"
        val friendlyType = friendlyFileType(filename, item.mimeType)
        val sizeLabel = item.byteSize?.let { formatFileSize(it, locale) }
        val metadata = listOfNotNull(friendlyType, sizeLabel).joinToString(", ")
        return SharedContentGalleryItem.File(
            itemId = item.itemId,
            kind = item.kind,
            filename = filename,
            filenameDirection = SharedContentTextDirection.Natural,
            friendlyType = friendlyType,
            sizeLabel = sizeLabel,
            accessibilityLabel = "$filename, $metadata",
            selectionEnabled = onSelectItem != null,
        )
    }

    private fun linkItem(item: SharedContentAcceptedItem): SharedContentGalleryItem.Link {
        val hostname = item.linkHostname?.takeIf(String::isNotBlank)
        val title = item.linkTitle?.takeIf(String::isNotBlank) ?: hostname ?: "Link"
        return SharedContentGalleryItem.Link(
            itemId = item.itemId,
            kind = item.kind,
            title = title,
            hostname = hostname,
            hostnameDirection = SharedContentTextDirection.Isolate,
            accessibilityLabel = listOfNotNull(title, hostname?.takeIf { it != title })
                .joinToString(", "),
            selectionEnabled = onSelectItem != null,
        )
    }

    private fun voiceItem(item: SharedContentAcceptedItem): SharedContentGalleryItem.Voice {
        val duration = item.durationMs
            ?.let { formatDuration(it, locale) }
            ?: DurationUnavailable
        return SharedContentGalleryItem.Voice(
            itemId = item.itemId,
            kind = item.kind,
            durationLabel = duration,
            accessibilityLabel = "Voice message, $duration",
            selectionEnabled = onSelectItem != null,
        )
    }

    private companion object {
        const val DurationUnavailable = "Duration unavailable"
    }
}

private fun friendlyFileType(filename: String, mimeType: String?): String {
    val extension = filename.substringAfterLast('.', missingDelimiterValue = "")
        .lowercase(Locale.ROOT)
    return when {
        extension == "pdf" || mimeType == "application/pdf" -> "PDF"
        extension in setOf("doc", "docx", "odt", "rtf") ||
            mimeType?.contains("word") == true -> "Document"
        extension in setOf("xls", "xlsx", "ods", "csv") ||
            mimeType?.contains("spreadsheet") == true -> "Spreadsheet"
        extension in setOf("ppt", "pptx", "odp") ||
            mimeType?.contains("presentation") == true -> "Presentation"
        extension in setOf("zip", "rar", "7z", "tar", "gz") ||
            mimeType?.contains("zip") == true -> "Archive"
        extension in setOf("txt", "md") || mimeType?.startsWith("text/") == true -> "Text"
        mimeType?.startsWith("image/") == true -> "Image"
        mimeType?.startsWith("video/") == true -> "Video"
        mimeType?.startsWith("audio/") == true -> "Audio"
        else -> "File"
    }
}

private fun formatFileSize(bytes: Long, locale: Locale): String {
    val units = listOf("B", "KB", "MB", "GB", "TB")
    var value = bytes.toDouble()
    var unitIndex = 0
    while (value >= 1_000 && unitIndex < units.lastIndex) {
        value /= 1_000
        unitIndex += 1
    }
    val formatter = NumberFormat.getNumberInstance(locale).apply {
        isGroupingUsed = true
        maximumFractionDigits = if (unitIndex == 0 || value >= 10) 0 else 1
        minimumFractionDigits = 0
    }
    return "${formatter.format(value)} ${units[unitIndex]}"
}

private fun formatDuration(durationMs: Long, locale: Locale): String {
    val totalSeconds = durationMs / 1_000
    val hours = totalSeconds / 3_600
    val minutes = (totalSeconds % 3_600) / 60
    val seconds = totalSeconds % 60
    val number = NumberFormat.getIntegerInstance(locale).apply {
        isGroupingUsed = false
    }
    fun Long.localized(minimumDigits: Int): String {
        number.minimumIntegerDigits = minimumDigits
        return number.format(this)
    }
    return if (hours > 0) {
        "${hours.localized(1)}:${minutes.localized(2)}:${seconds.localized(2)}"
    } else {
        "${minutes.localized(1)}:${seconds.localized(2)}"
    }
}
