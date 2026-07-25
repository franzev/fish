package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import coil3.compose.AsyncImage
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton

@Composable
fun ComposerMediaPreview(
    media: ComposerMediaUiModel,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sticker = (media as? ComposerMediaUiModel.Sticker)?.value
    val gif = (media as? ComposerMediaUiModel.Gif)?.value
    val description = when {
        sticker != null -> stringResource(R.string.selected_sticker, sticker.phrase)
        gif != null -> stringResource(R.string.selected_gif, gif.description)
        else -> ""
    }
    Row(
        modifier = modifier
            .semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(
            model = sticker?.assetPath?.let { "file:///android_asset/$it" } ?: gif?.posterUrl,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .size(FishTheme.spacing.fourXl)
                .clip(RoundedCornerShape(FishTheme.radii.control))
                .background(FishTheme.colors.surfaceAlt),
        )
        FishIconButton(
            icon = FishIcons.Close,
            contentDescription = stringResource(
                if (sticker != null) R.string.remove_selected_sticker else R.string.remove_selected_gif,
            ),
            onClick = onRemove,
            size = FishTheme.sizes.touchTarget,
        )
    }
}
