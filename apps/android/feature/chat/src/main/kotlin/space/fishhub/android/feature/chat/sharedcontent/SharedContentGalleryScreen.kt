package space.fishhub.android.feature.chat.sharedcontent

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentManualRetryState
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentPresentationNotice
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentUnavailableReason

@Composable
fun SharedContentGalleryScreen(
    presenter: SharedContentGalleryPresenter,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    onSelectItem: ((String) -> Unit)? = null,
    onItemDisplayed: ((String) -> Unit)? = null,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)? = null,
) {
    val state by presenter.state.collectAsStateWithLifecycle()

    SharedContentGalleryScreen(
        state = state,
        onBack = onBack,
        onIntent = presenter::dispatch,
        modifier = modifier,
        onSelectItem = onSelectItem ?: if (state.itemSelectionEnabled) {
            { itemId -> presenter.dispatch(SharedContentGalleryIntent.SelectItem(itemId)) }
        } else {
            null
        },
        onItemDisplayed = onItemDisplayed ?: { itemId ->
            presenter.displayConfirmed(itemId)
            Unit
        },
        displayScopeKey = presenter,
        thumbnailLoader = thumbnailLoader,
    )
}

@Composable
fun SharedContentGalleryScreen(
    state: SharedContentGalleryUiState,
    onBack: () -> Unit,
    onIntent: (SharedContentGalleryIntent) -> Unit,
    modifier: Modifier = Modifier,
    onSelectItem: ((String) -> Unit)? = null,
    onItemDisplayed: ((String) -> Unit)? = null,
    displayScopeKey: Any = state,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)? = null,
) {
    val selectedCategory = state.selectedCategory
    val savedAnchor = selectedCategory?.let(state.anchors::get)
    var focusedItemId by remember(selectedCategory, savedAnchor?.focusedItemId) {
        mutableStateOf(savedAnchor?.focusedItemId)
    }

    fun recordFocus(itemId: String, focused: Boolean) {
        if (focused) focusedItemId = itemId
    }

    BackHandler(onBack = onBack)
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        FishTopBar(
            title = stringResource(R.string.shared_content),
            showBack = true,
            onBack = onBack,
        )
        state.selectedCategory?.takeIf { state.showCategoryControl }?.let { selected ->
            SharedContentCategoryBar(
                categories = state.categories,
                selectedCategory = selected,
                onSelect = {
                    onIntent(SharedContentGalleryIntent.SelectCategory(it))
                },
            )
        }
        SharedContentGalleryBody(
            state = state,
            onIntent = onIntent,
            onSelectItem = onSelectItem,
            onItemDisplayed = onItemDisplayed,
            displayScopeKey = displayScopeKey,
            thumbnailLoader = thumbnailLoader,
            focusedItemId = focusedItemId,
            onItemFocusChanged = ::recordFocus,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun SharedContentGalleryBody(
    state: SharedContentGalleryUiState,
    onIntent: (SharedContentGalleryIntent) -> Unit,
    onSelectItem: ((String) -> Unit)?,
    onItemDisplayed: ((String) -> Unit)?,
    displayScopeKey: Any,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)?,
    focusedItemId: String?,
    onItemFocusChanged: (String, Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val presentation = state.presentation
    when (presentation.unavailableReason) {
        SharedContentUnavailableReason.Loading,
        SharedContentUnavailableReason.IdentityIneligible,
        -> SharedContentGallerySkeleton(
            category = state.selectedCategory,
            modifier = modifier,
        )
        SharedContentUnavailableReason.AuthoritativeEmpty -> SharedContentUnavailableState(
            title = stringResource(R.string.shared_content_empty_title),
            description = stringResource(R.string.shared_content_empty_description),
            modifier = modifier,
        )
        SharedContentUnavailableReason.OfflineNoCache -> SharedContentUnavailableState(
            title = stringResource(R.string.shared_content_offline_unavailable_title),
            description = stringResource(R.string.shared_content_offline_unavailable_description),
            modifier = modifier,
        )
        SharedContentUnavailableReason.AuthorityUnavailable -> SharedContentUnavailableState(
            title = stringResource(R.string.shared_content_unavailable_title),
            description = stringResource(R.string.shared_content_unavailable_description),
            modifier = modifier,
            retryAllowed = presentation.manualRetry != SharedContentManualRetryState.Hidden,
            retryBusy = presentation.manualRetry == SharedContentManualRetryState.Busy,
            onRetry = { onIntent(SharedContentGalleryIntent.Retry) },
        )
        SharedContentUnavailableReason.None -> {
            if (state.selectedCategory == null) {
                SharedContentGallerySkeleton(
                    category = null,
                    modifier = modifier,
                )
            } else {
                SharedContentGalleryPopulated(
                    state = state,
                    onIntent = onIntent,
                    onSelectItem = onSelectItem,
                    onItemDisplayed = onItemDisplayed,
                    displayScopeKey = displayScopeKey,
                    thumbnailLoader = thumbnailLoader,
                    focusedItemId = focusedItemId,
                    onItemFocusChanged = onItemFocusChanged,
                    modifier = modifier,
                )
            }
        }
    }
}

@Composable
private fun SharedContentGalleryPopulated(
    state: SharedContentGalleryUiState,
    onIntent: (SharedContentGalleryIntent) -> Unit,
    onSelectItem: ((String) -> Unit)?,
    onItemDisplayed: ((String) -> Unit)?,
    displayScopeKey: Any,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)?,
    focusedItemId: String?,
    onItemFocusChanged: (String, Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val selectedCategory = state.selectedCategory ?: return
    Column(modifier = modifier.fillMaxSize()) {
        GalleryNotice(
            state = state,
            onRetry = { onIntent(SharedContentGalleryIntent.Retry) },
        )
        val footer: @Composable () -> Unit = {
            ShowEarlierBoundary(
                state = state.earlierState,
                onShowEarlier = { onIntent(SharedContentGalleryIntent.ShowEarlier) },
            )
        }
        val visibleItemsChanged: (List<String>, List<String>) -> Unit = { visible, lookahead ->
            onIntent(
                SharedContentGalleryIntent.ReportVisibility(
                    visibleItemIds = visible,
                    lookaheadItemIds = lookahead,
                ),
            )
        }
        val anchorChanged: (String, Int, String?) -> Unit = { itemId, scrollOffset, focusedId ->
            onIntent(
                SharedContentGalleryIntent.RecordAnchor(
                    category = selectedCategory,
                    itemId = itemId,
                    scrollOffset = scrollOffset,
                    focusedItemId = focusedId,
                ),
            )
        }
        when (selectedCategory) {
            SharedContentGalleryCategory.Media -> {
                val mediaItems = state.items.filterIsInstance<SharedContentGalleryItem.Media>()
                SharedContentMediaGrid(
                    items = mediaItems,
                    onSelectItem = onSelectItem,
                    modifier = Modifier.weight(1f),
                    footer = footer,
                    anchor = state.anchors[selectedCategory],
                    onVisibleItemsChanged = visibleItemsChanged,
                    onAnchorChanged = anchorChanged,
                    focusedItemId = focusedItemId,
                    onItemFocusChanged = onItemFocusChanged,
                    displayScopeKey = displayScopeKey,
                    onItemDisplayed = { itemId ->
                        if (state.selectedCategory == selectedCategory &&
                            state.items.any { it.itemId == itemId }
                        ) {
                            onItemDisplayed?.invoke(itemId)
                        }
                    },
                    thumbnailLoader = thumbnailLoader,
                )
            }
            SharedContentGalleryCategory.Files,
            SharedContentGalleryCategory.Links,
            SharedContentGalleryCategory.Voice,
            -> SharedContentMetadataList(
                items = state.items,
                onSelectItem = onSelectItem,
                modifier = Modifier.weight(1f),
                footer = footer,
                anchor = state.anchors[selectedCategory],
                onVisibleItemsChanged = visibleItemsChanged,
                onAnchorChanged = anchorChanged,
                focusedItemId = focusedItemId,
                onItemFocusChanged = onItemFocusChanged,
            )
        }
    }
}

@Composable
private fun GalleryNotice(
    state: SharedContentGalleryUiState,
    onRetry: () -> Unit,
) {
    val notice = when (state.presentation.notice) {
        SharedContentPresentationNotice.None -> null
        SharedContentPresentationNotice.CheckingForUpdates ->
            stringResource(R.string.shared_content_checking_updates)
        SharedContentPresentationNotice.OfflineCached -> listOf(
            stringResource(R.string.shared_content_offline_title),
            stringResource(R.string.shared_content_offline_cached),
        ).joinToString("\n")
        SharedContentPresentationNotice.Stale -> listOf(
            stringResource(R.string.shared_content_stale_title),
            stringResource(R.string.shared_content_stale_description),
        ).joinToString("\n")
    } ?: return
    val retryAvailable = state.presentation.notice == SharedContentPresentationNotice.Stale &&
        state.presentation.manualRetry != SharedContentManualRetryState.Hidden
    SharedContentGalleryNotice(
        message = notice,
        modifier = Modifier.padding(
            horizontal = FishTheme.spacing.page,
            vertical = FishTheme.spacing.xs,
        ),
        actionLabel = stringResource(R.string.shared_content_try_again).takeIf {
            retryAvailable
        },
        onAction = onRetry.takeIf { retryAvailable },
        actionLoading = state.presentation.manualRetry == SharedContentManualRetryState.Busy,
    )
}
