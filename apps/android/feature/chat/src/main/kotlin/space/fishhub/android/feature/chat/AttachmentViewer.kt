package space.fishhub.android.feature.chat

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@Composable
fun AttachmentViewer(
    attachment: AttachmentUiModel,
    onDismiss: () -> Unit,
    onLoadError: (String) -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        AttachmentViewerContent(
            attachment = attachment,
            onDismiss = onDismiss,
            onLoadError = onLoadError,
        )
    }
}
