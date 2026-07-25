package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription

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
