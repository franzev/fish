package space.fishhub.android.feature.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import androidx.emoji2.emojipicker.EmojiPickerView
import androidx.emoji2.emojipicker.RecentEmojiProvider
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.fishFocusBorder

/** Shared browse/search surface used by both message reactions and the composer. */
@Composable
internal fun EmojiPickerContent(
    query: String,
    results: List<EmojiCatalogEntry>,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (query.isBlank()) {
        val background = FishTheme.colors.surface.toArgb()
        AndroidView(
            factory = { context ->
                EmojiPickerView(context).apply {
                    setRecentEmojiProvider(NoRecentEmojiProvider)
                    setBackgroundColor(background)
                }
            },
            update = { view ->
                view.setBackgroundColor(background)
                view.setOnEmojiPickedListener { item -> onSelect(item.emoji) }
            },
            modifier = modifier.fillMaxSize(),
        )
    } else if (results.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .padding(FishTheme.spacing.page),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = stringResource(R.string.no_emoji_results),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        }
    } else {
        LazyVerticalGrid(
            columns = GridCells.Fixed(6),
            modifier = modifier.fillMaxSize(),
            contentPadding = PaddingValues(FishTheme.spacing.page),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
        ) {
            items(results, key = EmojiCatalogEntry::slug) { entry ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(FishTheme.radii.control))
                        .fishFocusBorder(RoundedCornerShape(FishTheme.radii.control))
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

private object NoRecentEmojiProvider : RecentEmojiProvider {
    override fun recordSelection(emoji: String) = Unit
    override suspend fun getRecentEmojiList(): List<String> = emptyList()
}
