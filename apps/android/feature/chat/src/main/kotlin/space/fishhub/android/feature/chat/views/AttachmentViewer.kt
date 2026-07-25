package space.fishhub.android.feature.chat.views

import androidx.compose.runtime.Composable
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import space.fishhub.android.feature.chat.model.AttachmentUiModel

/**
 * Full-screen photo viewer. Opens on the photo the viewer tapped and pages
 * across the rest of that message's photos, matching FishKit's viewer.
 */
@Composable
fun AttachmentViewer(
    images: List<AttachmentUiModel>,
    initialIndex: Int,
    onDismiss: () -> Unit,
    onLoadError: (String) -> Unit,
) {
    if (images.isEmpty()) return
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        AttachmentViewerContent(
            images = images,
            initialIndex = initialIndex,
            onDismiss = onDismiss,
            onLoadError = onLoadError,
        )
    }
}
