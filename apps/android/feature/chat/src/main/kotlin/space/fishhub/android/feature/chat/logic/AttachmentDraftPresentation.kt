package space.fishhub.android.feature.chat.logic

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import java.io.File
import java.util.Locale
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.model.LocalAttachmentUiModel

internal fun String.toAttachmentImageModel(): Any =
    if (startsWith(AndroidAssetScheme)) this else File(this)

internal const val AndroidAssetScheme = "file:///android_asset/"

@Composable
internal fun attachmentRemoveDescription(attachment: LocalAttachmentUiModel): String = if (attachment.isPhoto) {
    stringResource(R.string.remove_photo_accessibility, attachment.position + 1)
} else {
    stringResource(R.string.remove_file_accessibility, attachment.name)
}

internal val AttachmentIcon = FishIcons.Attachment

internal fun formatDraftFileSize(bytes: Long): String = when {
    bytes < 1_024 -> "$bytes B"
    bytes < 1_024 * 1_024 -> String.format(Locale.getDefault(), "%.1f KB", bytes / 1_024.0)
    else -> String.format(Locale.getDefault(), "%.1f MB", bytes / (1_024.0 * 1_024.0))
}
