package space.fishhub.android.feature.chat

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import coil3.compose.AsyncImage

@Composable
internal fun AttachmentPhotoImage(
    url: String,
    cacheKey: String,
    contentDescription: String?,
    contentScale: ContentScale,
    onError: () -> Unit,
    modifier: Modifier,
) {
    if (LocalInspectionMode.current) {
        Image(
            painter = painterResource(R.drawable.attachment_preview_sample),
            contentDescription = contentDescription,
            contentScale = contentScale,
            modifier = modifier,
        )
    } else {
        AsyncImage(
            model = attachmentImageRequest(url = url, cacheKey = cacheKey),
            contentDescription = contentDescription,
            contentScale = contentScale,
            onError = { onError() },
            modifier = modifier,
        )
    }
}
