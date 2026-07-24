package space.fishhub.android.feature.chat.sharedcontent

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishDivider
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.feature.chat.R
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun SharedContentCategoryTabs(
    categories: List<SharedContentGalleryCategory>,
    selectedCategory: SharedContentGalleryCategory,
    onCategorySelected: (SharedContentGalleryCategory) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (categories.size < 2) return

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .selectableGroup()
            .padding(horizontal = FishTheme.spacing.page),
    ) {
        categories.forEach { category ->
            val selected = category == selectedCategory
            val label = categoryLabel(category)
            Column(
                modifier = Modifier
                    .heightIn(min = FishTheme.sizes.touchTarget)
                    .selectable(
                        selected = selected,
                        role = Role.Tab,
                        onClick = { onCategorySelected(category) },
                    )
                    .semantics {
                        this.selected = selected
                        contentDescription = label
                    }
                    .padding(horizontal = FishTheme.spacing.md),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
            ) {
                Text(
                    text = label,
                    color = if (selected) FishTheme.colors.foreground else FishTheme.colors.body,
                    style = FishTheme.typography.ui,
                )
                Box(
                    modifier = Modifier
                        .padding(top = FishTheme.spacing.twoXs)
                        .height(FishTheme.spacing.threeXs)
                        .width(FishTheme.spacing.xl)
                        .background(
                            if (selected) FishTheme.colors.foreground else {
                                androidx.compose.ui.graphics.Color.Transparent
                            },
                            RoundedCornerShape(FishTheme.radii.pill),
                        ),
                )
            }
        }
    }
}

@Composable
fun SharedContentMediaGrid(
    items: List<SharedContentGalleryItem.Media>,
    onSelectItem: ((String) -> Unit)?,
    modifier: Modifier = Modifier,
    footer: (@Composable () -> Unit)? = null,
    anchor: SharedContentGalleryAnchor? = null,
    onVisibleItemsChanged: ((List<String>, List<String>) -> Unit)? = null,
    onAnchorChanged: ((String, Int) -> Unit)? = null,
    onItemDisplayed: ((String) -> Unit)? = null,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)? = null,
    displayScopeKey: Any? = null,
) {
    val fontScale = LocalDensity.current.fontScale
    val gridState = rememberLazyGridState()
    LaunchedEffect(gridState, items, onVisibleItemsChanged, onAnchorChanged) {
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
            visible.anchorId?.let { onAnchorChanged?.invoke(it, visible.anchorOffset) }
        }
    }
    LaunchedEffect(anchor?.itemId, items) {
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
    onItemDisplayed: ((String) -> Unit)?,
    displayScopeKey: Any?,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)?,
) {
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
    val enabled = item.selectionEnabled && onSelectItem != null
    val shape = RoundedCornerShape(FishTheme.radii.chatInner)
    Box(
        modifier = Modifier
            .fillMaxWidth()
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

@Composable
internal fun SharedContentDecodedMedia(
    bitmap: androidx.compose.ui.graphics.ImageBitmap,
    kind: String,
    modifier: Modifier = Modifier,
) {
    Image(
        bitmap = bitmap,
        contentDescription = null,
        modifier = modifier,
        contentScale = sharedContentMediaContentScale(kind),
    )
}

internal fun sharedContentMediaContentScale(kind: String): ContentScale =
    if (kind == "sticker") ContentScale.Fit else ContentScale.Crop

@Composable
fun SharedContentMetadataList(
    items: List<SharedContentGalleryItem>,
    onSelectItem: ((String) -> Unit)?,
    modifier: Modifier = Modifier,
    footer: (@Composable () -> Unit)? = null,
    anchor: SharedContentGalleryAnchor? = null,
    onVisibleItemsChanged: ((List<String>, List<String>) -> Unit)? = null,
    onAnchorChanged: ((String, Int) -> Unit)? = null,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(listState, items, onVisibleItemsChanged, onAnchorChanged) {
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
            visible.anchorId?.let { onAnchorChanged?.invoke(it, visible.anchorOffset) }
        }
    }
    LaunchedEffect(anchor?.itemId, items) {
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

@Composable
fun SharedContentMetadataRow(
    item: SharedContentGalleryItem,
    onSelectItem: ((String) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    require(item !is SharedContentGalleryItem.Media)
    val enabled = item.selectionEnabled && onSelectItem != null
    val accessibilityText = LocalDensity.current.fontScale >= AccessibilityFontScale
    val titleMaxLines = if (accessibilityText) Int.MAX_VALUE else 2
    val titleOverflow = if (accessibilityText) TextOverflow.Clip else TextOverflow.Ellipsis
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = FishTheme.sizes.sharedContentMetadataRow)
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
            }
            .padding(vertical = FishTheme.spacing.md),
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(FishTheme.sizes.touchTarget),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = when (item) {
                    is SharedContentGalleryItem.File -> FishIcons.FileText
                    is SharedContentGalleryItem.Link -> FishIcons.Link
                    is SharedContentGalleryItem.Voice -> FishIcons.Voice
                    is SharedContentGalleryItem.Media -> error("Media uses the grid")
                },
                contentDescription = null,
                tint = FishTheme.colors.body,
                modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
        ) {
            when (item) {
                is SharedContentGalleryItem.File -> {
                    Text(
                        text = item.filename,
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.ui,
                        maxLines = titleMaxLines,
                        overflow = titleOverflow,
                    )
                    Text(
                        text = listOfNotNull(item.friendlyType, item.sizeLabel)
                            .joinToString(" · "),
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.caption,
                    )
                }
                is SharedContentGalleryItem.Link -> {
                    Text(
                        text = item.title,
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.ui,
                        maxLines = titleMaxLines,
                        overflow = titleOverflow,
                    )
                    item.hostname?.let { hostname ->
                        Text(
                            text = hostname,
                            color = FishTheme.colors.body,
                            style = FishTheme.typography.caption.copy(
                                textDirection = TextDirection.ContentOrLtr,
                            ),
                        )
                    }
                }
                is SharedContentGalleryItem.Voice -> {
                    Text(
                        text = stringResource(R.string.voice_message),
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.ui,
                    )
                    Text(
                        text = item.durationLabel,
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.caption,
                    )
                }
                is SharedContentGalleryItem.Media -> Unit
            }
        }
    }
}

@Composable
fun SharedContentGallerySkeleton(
    category: SharedContentGalleryCategory?,
    modifier: Modifier = Modifier,
) {
    val loadingLabel = stringResource(R.string.shared_content_loading)
    val skeletonModifier = Modifier.clearAndSetSemantics { }
    Column(
        modifier = modifier
            .fillMaxSize()
            .semantics {
                contentDescription = loadingLabel
                liveRegion = LiveRegionMode.Polite
            }
            .padding(FishTheme.spacing.page),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
    ) {
        if (category == SharedContentGalleryCategory.Media) {
            val fontScale = LocalDensity.current.fontScale
            val minimumCell = if (fontScale >= AccessibilityFontScale) {
                FishTheme.sizes.sharedContentAccessibleMediaCell
            } else {
                FishTheme.sizes.sharedContentMediaCell
            }
            BoxWithConstraints(modifier = skeletonModifier.fillMaxWidth()) {
                val gap = FishTheme.spacing.twoXs
                val columns = remember(maxWidth, minimumCell, gap) {
                    ((maxWidth + gap) / (minimumCell + gap))
                        .toInt()
                        .coerceIn(1, MaximumMediaColumns)
                }
                val cellWidth = (maxWidth - (gap * (columns - 1))) / columns
                Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                    repeat(MediaSkeletonRows) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(gap),
                        ) {
                            repeat(columns) {
                                Box(
                                    modifier = Modifier
                                        .width(cellWidth)
                                        .height(cellWidth)
                                        .background(
                                            FishTheme.colors.surfaceAlt,
                                            RoundedCornerShape(FishTheme.radii.chatInner),
                                        ),
                                )
                            }
                        }
                    }
                }
            }
        } else {
            repeat(ListSkeletonRows) {
                Row(
                    modifier = skeletonModifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FishSkeleton(
                        modifier = Modifier.size(FishTheme.sizes.touchTarget),
                        width = FishTheme.sizes.touchTarget,
                    )
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                    ) {
                        FishSkeleton()
                        FishSkeleton(Modifier.fillMaxWidth(CompactSkeletonFraction))
                    }
                }
            }
        }
    }
}

@Composable
fun SharedContentGalleryNotice(
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    actionLoading: Boolean = false,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
    ) {
        FishNotice(message = message)
        if (actionLabel != null && onAction != null) {
            FishButton(
                label = actionLabel,
                onClick = onAction,
                variant = FishButtonVariant.Ghost,
                loading = actionLoading,
                loadingDescription = stringResource(R.string.shared_content_loading),
            )
        }
    }
}

@Composable
fun SharedContentGalleryEmpty(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    retryAllowed: Boolean = false,
    retryBusy: Boolean = false,
    onRetry: (() -> Unit)? = null,
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        FishEmptyState(
            title = title,
            description = description,
            action = if (retryAllowed && onRetry != null) {
                {
                    FishButton(
                        label = stringResource(R.string.shared_content_try_again),
                        onClick = onRetry,
                        variant = FishButtonVariant.Ghost,
                        loading = retryBusy,
                        loadingDescription = stringResource(R.string.shared_content_loading),
                    )
                }
            } else {
                null
            },
        )
    }
}

@Composable
fun ShowEarlierBoundary(
    state: SharedContentEarlierState,
    onShowEarlier: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.lg),
        contentAlignment = Alignment.Center,
    ) {
        when (state) {
            SharedContentEarlierState.Hidden -> Unit
            SharedContentEarlierState.Ready -> FishButton(
                label = stringResource(R.string.shared_content_show_earlier),
                onClick = onShowEarlier,
                variant = FishButtonVariant.Ghost,
            )
            SharedContentEarlierState.Loading -> FishButton(
                label = stringResource(R.string.shared_content_show_earlier),
                onClick = onShowEarlier,
                variant = FishButtonVariant.Ghost,
                loading = true,
                loadingDescription = stringResource(R.string.shared_content_loading_earlier),
            )
            SharedContentEarlierState.Failed -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                Text(
                    text = stringResource(R.string.shared_content_earlier_failed),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.caption,
                )
                FishButton(
                    label = stringResource(R.string.shared_content_try_again),
                    onClick = onShowEarlier,
                    variant = FishButtonVariant.Ghost,
                )
            }
            SharedContentEarlierState.Offline -> Text(
                text = stringResource(R.string.shared_content_connect_for_more),
                color = FishTheme.colors.body,
                style = FishTheme.typography.caption,
            )
        }
    }
}

@Composable
private fun categoryLabel(category: SharedContentGalleryCategory): String =
    stringResource(
        when (category) {
            SharedContentGalleryCategory.Media -> R.string.shared_content_media
            SharedContentGalleryCategory.Files -> R.string.shared_content_files
            SharedContentGalleryCategory.Links -> R.string.shared_content_links
            SharedContentGalleryCategory.Voice -> R.string.shared_content_voice
        },
    )

private const val MaximumMediaColumns = 6
private const val AccessibilityFontScale = 1.3f
private const val MediaSkeletonRows = 3
private const val ListSkeletonRows = 6
private const val CompactSkeletonFraction = 0.64f

private data class VisibleGalleryItems(
    val visible: List<String>,
    val lookahead: List<String>,
    val anchorId: String?,
    val anchorOffset: Int,
)
