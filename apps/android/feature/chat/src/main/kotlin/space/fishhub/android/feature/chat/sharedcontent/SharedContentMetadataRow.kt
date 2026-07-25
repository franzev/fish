package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.focusable
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.R

@Composable
fun SharedContentMetadataRow(
    item: SharedContentGalleryItem,
    onSelectItem: ((String) -> Unit)?,
    restoreFocus: Boolean = false,
    onFocusChanged: ((String, Boolean) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    require(item !is SharedContentGalleryItem.Media)
    val focusRequester = remember(item.itemId) { FocusRequester() }
    LaunchedEffect(restoreFocus, item.itemId) {
        if (restoreFocus) focusRequester.requestFocusWhenReady()
    }
    val enabled = item.selectionEnabled && onSelectItem != null
    val accessibilityText = LocalDensity.current.fontScale >= AccessibilityFontScale
    val titleMaxLines = if (accessibilityText) Int.MAX_VALUE else 2
    val titleOverflow = if (accessibilityText) TextOverflow.Clip else TextOverflow.Ellipsis
    Row(
        modifier = modifier
            .fillMaxWidth()
            .focusRequester(focusRequester)
            .onFocusChanged { onFocusChanged?.invoke(item.itemId, it.isFocused) }
            .focusable()
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
