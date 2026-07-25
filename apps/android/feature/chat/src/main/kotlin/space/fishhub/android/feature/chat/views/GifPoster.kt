package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import coil3.compose.AsyncImage
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.R

/**
 * A GIF still with the shared failure state. Both the transcript player and the
 * picker grid load posters, and both need to say so when one does not arrive —
 * FishKit gets this from a single `GifMedia`, so keep one path here too.
 */
@Composable
internal fun GifPoster(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    var failed by remember(url) { mutableStateOf(false) }
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        if (url == null || failed) {
            Text(
                text = stringResource(R.string.gif_unavailable_media),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        } else {
            AsyncImage(
                model = url,
                contentDescription = contentDescription,
                contentScale = contentScale,
                onError = { failed = true },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
