package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishDivider
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun SharedContentMetadataList(
    items: List<SharedContentGalleryItem>,
    onSelectItem: ((String) -> Unit)?,
    modifier: Modifier = Modifier,
    footer: (@Composable () -> Unit)? = null,
    anchor: SharedContentGalleryAnchor? = null,
    onVisibleItemsChanged: ((List<String>, List<String>) -> Unit)? = null,
    onAnchorChanged: ((String, Int, String?) -> Unit)? = null,
    focusedItemId: String? = null,
    onItemFocusChanged: ((String, Boolean) -> Unit)? = null,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(
        listState,
        items,
        onVisibleItemsChanged,
        onAnchorChanged,
        focusedItemId,
    ) {
        snapshotFlow {
            val visible = listState.layoutInfo.visibleItemsInfo
                .mapNotNull { info -> items.getOrNull(info.index)?.itemId }
            val visibleCount = visible.size.coerceAtLeast(1)
            val lastVisible = listState.layoutInfo.visibleItemsInfo.maxOfOrNull { it.index } ?: -1
            val lookahead = items
                .drop(lastVisible + 1)
                .take(visibleCount)
                .map(SharedContentGalleryItem::itemId)
            val first = listState.layoutInfo.visibleItemsInfo.minByOrNull { it.index }
            VisibleGalleryItems(
                visible = visible,
                lookahead = lookahead,
                anchorId = first?.index?.let { items.getOrNull(it)?.itemId },
                anchorOffset = first?.offset?.let { (-it).coerceAtLeast(0) } ?: 0,
            )
        }.distinctUntilChanged().collect { visible ->
            onVisibleItemsChanged?.invoke(visible.visible, visible.lookahead)
            visible.anchorId?.let {
                onAnchorChanged?.invoke(it, visible.anchorOffset, focusedItemId)
            }
        }
    }
    LaunchedEffect(anchor?.itemId, anchor?.scrollOffset, items) {
        val anchorIndex = anchor?.let { saved ->
            items.indexOfFirst { it.itemId == saved.itemId }.takeIf { it >= 0 }
        }
        if (anchorIndex != null) {
            listState.scrollToItem(anchorIndex, anchor.scrollOffset)
        }
    }
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        state = listState,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = FishTheme.spacing.page,
            end = FishTheme.spacing.page,
            top = FishTheme.spacing.sm,
            bottom = FishTheme.spacing.page,
        ),
    ) {
        itemsIndexed(
            items = items,
            key = { _, item -> item.itemId },
        ) { index, item ->
            SharedContentMetadataRow(
                item = item,
                onSelectItem = onSelectItem,
                restoreFocus = item.itemId == anchor?.focusedItemId,
                onFocusChanged = onItemFocusChanged,
            )
            if (index != items.lastIndex) FishDivider()
        }
        if (footer != null) {
            item(key = "shared-content-earlier") {
                footer()
            }
        }
    }
}
