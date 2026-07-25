package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
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
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun StickerMessageMedia(
    sticker: StickerUiModel,
    author: String,
    timeLabel: String,
    modifier: Modifier = Modifier,
) {
    val spoken = "$author. ${sticker.description}. $timeLabel"
    if (!sticker.available) {
        Box(
            modifier = modifier
                .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
                .heightIn(min = FishTheme.spacing.fourXl)
                .clip(RoundedCornerShape(FishTheme.radii.control))
                .background(FishTheme.colors.surfaceAlt)
                .semantics { contentDescription = spoken },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = stringResource(R.string.sticker_unavailable),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        }
        return
    }
    AsyncImage(
        model = "file:///android_asset/${sticker.assetPath}",
        contentDescription = spoken,
        contentScale = ContentScale.Fit,
        modifier = modifier
            .size(FishTheme.spacing.fourXl),
    )
}
