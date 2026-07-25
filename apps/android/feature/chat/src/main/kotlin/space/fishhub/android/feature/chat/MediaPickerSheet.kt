package space.fishhub.android.feature.chat

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediaPickerSheet(
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
