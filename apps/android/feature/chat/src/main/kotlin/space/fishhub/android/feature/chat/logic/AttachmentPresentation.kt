package space.fishhub.android.feature.chat.logic

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import coil3.request.ImageRequest

@Composable
internal fun attachmentImageRequest(url: String, cacheKey: String): ImageRequest =
    ImageRequest.Builder(LocalContext.current)
        .data(url)
        .memoryCacheKey(cacheKey)
        .diskCacheKey(cacheKey)
        .build()
