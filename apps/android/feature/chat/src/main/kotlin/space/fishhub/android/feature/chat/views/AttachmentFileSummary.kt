package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.logic.AttachmentIcon
import space.fishhub.android.feature.chat.logic.formatDraftFileSize
import space.fishhub.android.feature.chat.model.LocalAttachmentUiModel

@Composable
internal fun AttachmentFileSummary(attachment: LocalAttachmentUiModel) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Image(
            imageVector = AttachmentIcon,
            contentDescription = null,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
        )
        Text(
            text = attachment.name,
            modifier = Modifier.padding(top = FishTheme.spacing.xs),
            color = FishTheme.colors.foreground,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            style = FishTheme.typography.label,
        )
        Text(
            text = formatDraftFileSize(attachment.byteSize),
            modifier = Modifier.padding(top = FishTheme.spacing.twoXs),
            color = FishTheme.colors.muted,
            style = FishTheme.typography.caption,
        )
    }
}
