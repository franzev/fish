package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import coil3.compose.AsyncImage
import space.fishhub.android.feature.chat.R

@Composable
internal fun AttachmentDraftPhoto(
    model: Any,
    contentDescription: String,
    modifier: Modifier,
    contentScale: ContentScale,
) {
    if (LocalInspectionMode.current) {
        Image(
            painter = painterResource(R.drawable.attachment_preview_sample),
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = contentScale,
        )
    } else {
        AsyncImage(
            model = model,
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = contentScale,
        )
    }
}
