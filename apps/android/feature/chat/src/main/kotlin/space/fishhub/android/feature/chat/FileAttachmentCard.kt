package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import java.text.DecimalFormat

@Composable
internal fun FileAttachmentCard(
    attachment: AttachmentUiModel,
    author: String,
    timeLabel: String,
    onClick: () -> Unit,
    onShare: () -> Unit,
) {
    val type = attachment.mimeType.toFileTypeLabel()
    val detail = listOfNotNull(type, attachment.byteSize?.let(::formatFileSize)).joinToString(" · ")
    val spoken = stringResource(
        R.string.file_attachment_accessibility,
        author,
        attachment.name,
        detail,
        timeLabel,
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = FishTheme.sizes.touchTarget)
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.surfaceAlt),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .clickable(
                    enabled = attachment.available,
                    role = Role.Button,
                    onClickLabel = stringResource(R.string.open_file),
                    onClick = onClick,
                )
                .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm)
                .semantics {
                    contentDescription = spoken
                    role = Role.Button
                },
        ) {
            Text(
                text = attachment.name,
                color = FishTheme.colors.foreground,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = FishTheme.typography.label,
            )
            if (detail.isNotBlank()) {
                Text(
                    text = detail,
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.caption,
                )
            }
        }
        FishIconButton(
            icon = FishIcons.Share,
            contentDescription = stringResource(R.string.share_file),
            onClick = onShare,
            enabled = attachment.available,
            modifier = Modifier.padding(end = FishTheme.spacing.twoXs),
        )
    }
}

private fun String?.toFileTypeLabel(): String? = when (this) {
    "application/pdf" -> "PDF"
    "text/plain" -> "Text"
    "text/csv" -> "CSV"
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> "Word"
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> "Excel"
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" -> "PowerPoint"
    else -> null
}

private fun formatFileSize(bytes: Long): String {
    if (bytes < 1024L) return "$bytes B"
    val kib = bytes / 1024.0
    if (kib < 1024.0) return "${DecimalFormat("0.#").format(kib)} KB"
    return "${DecimalFormat("0.#").format(kib / 1024.0)} MB"
}
