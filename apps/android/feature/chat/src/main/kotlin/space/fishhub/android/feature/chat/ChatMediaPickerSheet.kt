package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import android.view.ContextThemeWrapper
import androidx.emoji2.emojipicker.EmojiPickerView
import androidx.emoji2.emojipicker.RecentEmojiProvider
import coil3.compose.AsyncImage
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.core.designsystem.component.FishTextField
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatMediaPickerSheet(
    state: MediaPickerUiState,
    onDismiss: () -> Unit,
    onTabSelected: (MediaPickerTab) -> Unit,
    onQueryChanged: (String) -> Unit,
    onEmojiSelected: (String) -> Unit,
    onGifSelected: (space.fishhub.android.data.chat.GifSearchItem) -> Unit,
    onStickerSelected: (StickerCatalogItem) -> Unit,
    onRetryGifs: () -> Unit,
    onLoadMoreGifs: () -> Unit,
    onToggleGifAnimations: () -> Unit,
) {
    FishModalBottomSheet(
        onDismissRequest = onDismiss,
    ) {
        ChatMediaPickerContent(
            state = state,
            onDismiss = onDismiss,
            onTabSelected = onTabSelected,
            onQueryChanged = onQueryChanged,
            onEmojiSelected = onEmojiSelected,
            onGifSelected = onGifSelected,
            onStickerSelected = onStickerSelected,
            onRetryGifs = onRetryGifs,
            onLoadMoreGifs = onLoadMoreGifs,
            onToggleGifAnimations = onToggleGifAnimations,
        )
    }
}

@Composable
internal fun ChatMediaPickerContent(
    state: MediaPickerUiState,
    onDismiss: () -> Unit,
    onTabSelected: (MediaPickerTab) -> Unit,
    onQueryChanged: (String) -> Unit,
    onEmojiSelected: (String) -> Unit,
    onGifSelected: (space.fishhub.android.data.chat.GifSearchItem) -> Unit,
    onStickerSelected: (StickerCatalogItem) -> Unit,
    onRetryGifs: () -> Unit,
    onLoadMoreGifs: () -> Unit,
    onToggleGifAnimations: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = FishTheme.sizes.chatContentMax)
            .imePadding()
            .background(FishTheme.colors.surface)
            .testTag("chat-media-picker"),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = FishTheme.spacing.page,
                    top = FishTheme.spacing.sm,
                    end = FishTheme.spacing.sm,
                    bottom = FishTheme.spacing.xs,
                ),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.media_picker_title),
                modifier = Modifier.weight(1f),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.heading,
            )
            FishIconButton(
                icon = FishIcons.Close,
                contentDescription = stringResource(R.string.close_media_picker),
                onClick = onDismiss,
                size = FishTheme.sizes.touchTarget,
            )
        }
        MediaTabRow(activeTab = state.activeTab, onTabSelected = onTabSelected)
        val query = when (state.activeTab) {
            MediaPickerTab.Emoji -> state.emojiQuery
            MediaPickerTab.Gif -> state.gifQuery
            MediaPickerTab.Sticker -> state.stickerQuery
        }
        val searchLabel = stringResource(
            when (state.activeTab) {
                MediaPickerTab.Emoji -> R.string.search_emoji
                MediaPickerTab.Gif -> R.string.search_gifs
                MediaPickerTab.Sticker -> R.string.search_stickers
            },
        )
        FishTextField(
            value = query,
            onValueChange = onQueryChanged,
            label = searchLabel,
            placeholder = searchLabel,
            modifier = Modifier.padding(
                horizontal = FishTheme.spacing.page,
                vertical = FishTheme.spacing.sm,
            ),
        )
        when (state.activeTab) {
            MediaPickerTab.Emoji -> EmojiTab(
                query = state.emojiQuery,
                results = state.emojiResults,
                onSelect = onEmojiSelected,
            )
            MediaPickerTab.Gif -> GifTab(
                state = state,
                onSelect = onGifSelected,
                onRetry = onRetryGifs,
                onLoadMore = onLoadMoreGifs,
                onToggleAnimations = onToggleGifAnimations,
            )
            MediaPickerTab.Sticker -> StickerTab(
                stickers = state.stickers,
                online = state.online,
                onSelect = onStickerSelected,
            )
        }
    }
}

@Composable
private fun MediaTabRow(activeTab: MediaPickerTab, onTabSelected: (MediaPickerTab) -> Unit) {
    PrimaryTabRow(
        selectedTabIndex = activeTab.ordinal,
        containerColor = FishTheme.colors.surface,
        contentColor = FishTheme.colors.foreground,
    ) {
        MediaPickerTab.entries.forEach { tab ->
            Tab(
                selected = tab == activeTab,
                onClick = { onTabSelected(tab) },
                text = {
                    Text(
                        text = stringResource(
                            when (tab) {
                                MediaPickerTab.Emoji -> R.string.emoji_tab
                                MediaPickerTab.Gif -> R.string.gif_tab
                                MediaPickerTab.Sticker -> R.string.sticker_tab
                            },
                        ),
                    )
                },
            )
        }
    }
}

@Composable
private fun EmojiTab(
    query: String,
    results: List<EmojiCatalogEntry>,
    onSelect: (String) -> Unit,
) {
    if (query.isBlank()) {
        val background = FishTheme.colors.surface.toArgb()
        AndroidView(
            factory = { context ->
                EmojiPickerView(ContextThemeWrapper(context, R.style.FishEmojiPickerTheme)).apply {
                    setRecentEmojiProvider(NoRecentEmojiProvider)
                    setOnEmojiPickedListener { item -> onSelect(item.emoji) }
                    setBackgroundColor(background)
                }
            },
            update = { view -> view.setBackgroundColor(background) },
            modifier = Modifier
                .fillMaxWidth()
                .weightForPicker(),
        )
    } else if (results.isEmpty()) {
        PickerEmptyText(stringResource(R.string.no_emoji_results))
    } else {
        LazyVerticalGrid(
            columns = GridCells.Fixed(6),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(FishTheme.spacing.page),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
        ) {
            items(results, key = EmojiCatalogEntry::slug) { entry ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(FishTheme.radii.control))
                        .clickable { onSelect(entry.emoji) }
                        .semantics { contentDescription = entry.name },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = entry.emoji, style = FishTheme.typography.heading)
                }
            }
        }
    }
}

@Composable
private fun StickerTab(
    stickers: List<StickerCatalogItem>,
    online: Boolean,
    onSelect: (StickerCatalogItem) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        if (!online) {
            Text(
                text = stringResource(R.string.media_offline),
                modifier = Modifier.padding(horizontal = FishTheme.spacing.page),
                color = FishTheme.colors.notice,
                style = FishTheme.typography.caption,
            )
        }
        if (stickers.isEmpty()) {
            PickerEmptyText(stringResource(R.string.no_sticker_results))
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(FishTheme.spacing.page),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
            ) {
                items(stickers, key = StickerCatalogItem::id) { sticker ->
                    val description = stringResource(R.string.choose_sticker, sticker.phrase)
                    AsyncImage(
                        model = "file:///android_asset/${sticker.assetPath}",
                        contentDescription = description,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .clip(androidx.compose.foundation.shape.RoundedCornerShape(FishTheme.radii.control))
                            .background(FishTheme.colors.surfaceAlt)
                            .clickable(enabled = online) { onSelect(sticker) }
                            .padding(FishTheme.spacing.twoXs),
                    )
                }
            }
        }
    }
}

@Composable
private fun GifTab(
    state: MediaPickerUiState,
    onSelect: (space.fishhub.android.data.chat.GifSearchItem) -> Unit,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onToggleAnimations: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        if (!state.gifAvailable) {
            PickerEmptyText(stringResource(R.string.gif_unavailable))
            KlipyAttribution()
            return
        }
        if (!state.online) {
            PickerEmptyText(stringResource(R.string.media_offline))
            KlipyAttribution()
            return
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = FishTheme.spacing.page),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(
                    if (state.gifQuery.isBlank()) R.string.trending_gifs else R.string.gif_results,
                ),
                modifier = Modifier.weight(1f),
                color = FishTheme.colors.body,
                style = FishTheme.typography.label,
            )
            FishButton(
                label = stringResource(
                    if (state.animateGifPreviews) {
                        R.string.pause_gif_previews
                    } else {
                        R.string.play_gif_previews
                    },
                ),
                onClick = onToggleAnimations,
                variant = FishButtonVariant.Ghost,
            )
        }
        when {
            state.loadingGifs -> GifSkeletonGrid()
            state.gifError != null -> Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(FishTheme.spacing.page),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                Text(
                    text = stringResource(R.string.gif_load_failed),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.body,
                )
                FishButton(
                    label = stringResource(R.string.retry_gifs),
                    onClick = onRetry,
                    variant = FishButtonVariant.Secondary,
                )
                KlipyAttribution()
            }
            state.gifs.isEmpty() -> {
                PickerEmptyText(stringResource(R.string.no_gif_results))
                KlipyAttribution()
            }
            else -> GifGrid(
                state = state,
                onSelect = onSelect,
                onLoadMore = onLoadMore,
            )
        }
    }
}

@Composable
private fun GifGrid(
    state: MediaPickerUiState,
    onSelect: (space.fishhub.android.data.chat.GifSearchItem) -> Unit,
    onLoadMore: () -> Unit,
) {
    val gridState = rememberLazyGridState()
    LaunchedEffect(gridState, state.gifs.size, state.nextGifCursor) {
        snapshotFlow { gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }
            .map { last -> last >= state.gifs.lastIndex - 2 }
            .distinctUntilChanged()
            .collect { nearEnd -> if (nearEnd) onLoadMore() }
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        state = gridState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(FishTheme.spacing.page),
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
    ) {
        items(state.gifs, key = { item -> "${item.chatGif.provider}:${item.chatGif.providerId}" }) { item ->
            val description = stringResource(R.string.choose_gif, item.chatGif.description)
            AsyncImage(
                model = if (state.animateGifPreviews) {
                    item.animatedPreviewUrl
                } else {
                    item.chatGif.posterUrl
                },
                contentDescription = description,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(item.chatGif.width.toFloat() / item.chatGif.height.toFloat())
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(FishTheme.radii.control))
                    .background(FishTheme.colors.surfaceAlt)
                    .clickable { onSelect(item) },
            )
        }
        if (state.loadingMoreGifs) {
            items(2, key = { index -> "gif-loading-$index" }) {
                GifSkeletonTile()
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) { KlipyAttribution() }
    }
}

@Composable
private fun GifSkeletonGrid() {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize(),
        userScrollEnabled = false,
        contentPadding = PaddingValues(FishTheme.spacing.page),
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
    ) {
        items(6) { GifSkeletonTile() }
        item(span = { GridItemSpan(maxLineSpan) }) { KlipyAttribution() }
    }
}

@Composable
private fun GifSkeletonTile() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.selected),
    )
}

@Composable
private fun PickerEmptyText(text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(FishTheme.spacing.page),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
        )
    }
}

@Composable
private fun KlipyAttribution() {
    Text(
        text = stringResource(R.string.powered_by_klipy),
        modifier = Modifier
            .fillMaxWidth()
            .padding(FishTheme.spacing.sm),
        color = FishTheme.colors.muted,
        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        style = FishTheme.typography.caption,
    )
}

private fun Modifier.weightForPicker(): Modifier = fillMaxHeight()

private object NoRecentEmojiProvider : RecentEmojiProvider {
    override fun recordSelection(emoji: String) = Unit
    override suspend fun getRecentEmojiList(): List<String> = emptyList()
}
