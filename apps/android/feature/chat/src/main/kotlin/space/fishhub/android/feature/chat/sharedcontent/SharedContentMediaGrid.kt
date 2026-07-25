package space.fishhub.android.feature.chat.sharedcontent

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.focusable
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.produceState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun SharedContentMediaGrid(
    items: List<SharedContentGalleryItem.Media>,
    onSelectItem: ((String) -> Unit)?,
    modifier: Modifier = Modifier,
    footer: (@Composable () -> Unit)? = null,
    anchor: SharedContentGalleryAnchor? = null,
    onVisibleItemsChanged: ((List<String>, List<String>) -> Unit)? = null,
    onAnchorChanged: ((String, Int, String?) -> Unit)? = null,
    focusedItemId: String? = null,
    onItemFocusChanged: ((String, Boolean) -> Unit)? = null,
    onItemDisplayed: ((String) -> Unit)? = null,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)? = null,
    displayScopeKey: Any? = null,
) {
    val fontScale = LocalDensity.current.fontScale
    val gridState = rememberLazyGridState()
    LaunchedEffect(
        gridState,
        items,
        onVisibleItemsChanged,
        onAnchorChanged,
        focusedItemId,
    ) {
        snapshotFlow {
            val visible = gridState.layoutInfo.visibleItemsInfo
                .mapNotNull { info -> items.getOrNull(info.index)?.itemId }
            val visibleCount = visible.size.coerceAtLeast(1)
            val lastVisible = gridState.layoutInfo.visibleItemsInfo.maxOfOrNull { it.index } ?: -1
            val lookahead = items
                .drop(lastVisible + 1)
                .take(visibleCount)
                .map(SharedContentGalleryItem.Media::itemId)
            val first = gridState.layoutInfo.visibleItemsInfo.minByOrNull { it.index }
            VisibleGalleryItems(
                visible = visible,
                lookahead = lookahead,
                anchorId = first?.index?.let { items.getOrNull(it)?.itemId },
                anchorOffset = first?.offset?.y?.let { (-it).coerceAtLeast(0) } ?: 0,
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
            gridState.scrollToItem(anchorIndex, anchor.scrollOffset)
        }
    }
    val minimumCell = if (fontScale >= AccessibilityFontScale) {
        FishTheme.sizes.sharedContentAccessibleMediaCell
    } else {
        FishTheme.sizes.sharedContentMediaCell
    }
    BoxWithConstraints(modifier = modifier) {
        val gap = FishTheme.spacing.twoXs
        val horizontalPadding = FishTheme.spacing.page
        val columns = remember(maxWidth, horizontalPadding, minimumCell, gap) {
            calculateSharedContentMediaColumns(
                containerWidth = maxWidth.value,
                horizontalPadding = horizontalPadding.value,
                minimumCellWidth = minimumCell.value,
                gap = gap.value,
            )
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            state = gridState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = FishTheme.spacing.page,
                end = FishTheme.spacing.page,
                top = FishTheme.spacing.sm,
                bottom = FishTheme.spacing.page,
            ),
            horizontalArrangement = Arrangement.spacedBy(gap),
            verticalArrangement = Arrangement.spacedBy(gap),
        ) {
            items(
                items = items,
                key = SharedContentGalleryItem.Media::itemId,
            ) { item ->
                SharedContentMediaTile(
                    item = item,
                    onSelectItem = onSelectItem,
                    restoreFocus = item.itemId == anchor?.focusedItemId,
                    onFocusChanged = onItemFocusChanged,
                    onItemDisplayed = onItemDisplayed,
                    displayScopeKey = displayScopeKey,
                    thumbnailLoader = thumbnailLoader,
                )
            }
            if (footer != null) {
                item(
                    key = "shared-content-earlier",
                    span = { GridItemSpan(maxLineSpan) },
                ) {
                    footer()
                }
            }
        }
    }
}

internal fun calculateSharedContentMediaColumns(
    containerWidth: Float,
    horizontalPadding: Float,
    minimumCellWidth: Float,
    gap: Float,
): Int {
    val availableWidth = (containerWidth - (horizontalPadding * 2)).coerceAtLeast(0f)
    return ((availableWidth + gap) / (minimumCellWidth + gap))
        .toInt()
        .coerceIn(1, MaximumMediaColumns)
}

@Composable
private fun SharedContentMediaTile(
    item: SharedContentGalleryItem.Media,
    onSelectItem: ((String) -> Unit)?,
    restoreFocus: Boolean,
    onFocusChanged: ((String, Boolean) -> Unit)?,
    onItemDisplayed: ((String) -> Unit)?,
    displayScopeKey: Any?,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)?,
) {
    val focusRequester = remember(item.itemId) { FocusRequester() }
    val bitmap by produceState<android.graphics.Bitmap?>(
        initialValue = null,
        key1 = displayScopeKey,
        key2 = item.thumbnailHandle,
        key3 = thumbnailLoader,
    ) {
        val bytes = thumbnailLoader?.invoke(item.thumbnailHandle) ?: return@produceState
        value = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    }
    LaunchedEffect(displayScopeKey, item.itemId, bitmap, onItemDisplayed) {
        if (bitmap != null) onItemDisplayed?.invoke(item.itemId)
    }
    LaunchedEffect(restoreFocus, item.itemId) {
        if (restoreFocus) focusRequester.requestFocusWhenReady()
    }
    val enabled = item.selectionEnabled && onSelectItem != null
    val shape = RoundedCornerShape(FishTheme.radii.chatInner)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(focusRequester)
            .onFocusChanged { onFocusChanged?.invoke(item.itemId, it.isFocused) }
            .focusable()
            .clip(shape)
            .background(FishTheme.colors.surfaceAlt)
            .then(
                if (enabled) {
                    Modifier.clickable(
                        role = Role.Button,
                        onClick = { onSelectItem(item.itemId) },
                    )
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) {
                contentDescription = item.accessibilityLabel
                if (enabled) role = Role.Button
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .padding(FishTheme.spacing.sm),
            contentAlignment = Alignment.Center,
        ) {
            val renderedBitmap = bitmap
            if (renderedBitmap != null) {
                SharedContentDecodedMedia(
                    bitmap = renderedBitmap.asImageBitmap(),
                    kind = item.kind,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Icon(
                    imageVector = FishIcons.Gallery,
                    contentDescription = null,
                    tint = FishTheme.colors.body,
                    modifier = Modifier.size(FishTheme.sizes.iconGlyph),
                )
            }
            when (item.kind) {
                "video" -> Icon(
                    imageVector = FishIcons.Play,
                    contentDescription = null,
                    tint = FishTheme.colors.foreground,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(FishTheme.sizes.iconGlyph),
                )
                "gif" -> Text(
                    text = "GIF",
                    modifier = Modifier.align(Alignment.BottomEnd),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.caption,
                )
            }
        }
    }
}
