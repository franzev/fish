package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton

@Composable
internal fun AttachmentSourceContent(
    remainingSlots: Int,
    cameraAvailable: Boolean,
    onChoosePhotos: () -> Unit,
    onTakePhoto: () -> Unit,
    onChooseFile: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(FishTheme.spacing.page),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = stringResource(R.string.add_attachment_title),
                modifier = Modifier.weight(1f),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.heading,
            )
            FishIconButton(
                icon = FishIcons.Close,
                contentDescription = stringResource(R.string.close_attachment_options),
                onClick = onDismiss,
                size = FishTheme.sizes.touchTarget,
            )
        }
        Text(
            text = pluralStringResource(
                R.plurals.attachment_slots_remaining,
                remainingSlots,
                remainingSlots,
            ),
            modifier = Modifier.padding(top = FishTheme.spacing.xs),
            color = FishTheme.colors.body,
            style = FishTheme.typography.ui,
        )
        AttachmentSourceRow(
            label = stringResource(R.string.choose_photos),
            onClick = onChoosePhotos,
            modifier = Modifier.padding(top = FishTheme.spacing.md),
        )
        if (cameraAvailable) {
            AttachmentSourceRow(
                label = stringResource(R.string.take_photo),
                onClick = onTakePhoto,
                modifier = Modifier.padding(top = FishTheme.spacing.xs),
            )
        } else {
            Text(
                text = stringResource(R.string.camera_unavailable),
                modifier = Modifier.padding(
                    start = FishTheme.spacing.md,
                    top = FishTheme.spacing.sm,
                    bottom = FishTheme.spacing.xs,
                ),
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
            )
        }
        AttachmentSourceRow(
            label = stringResource(R.string.choose_file),
            onClick = onChooseFile,
            modifier = Modifier.padding(top = FishTheme.spacing.xs),
        )
    }
}

@Composable
private fun AttachmentSourceRow(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.surfaceAlt)
            .clickable(role = Role.Button, onClick = onClick)
            .heightIn(min = FishTheme.sizes.primaryControl)
            .padding(horizontal = FishTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = AttachmentIcon,
            contentDescription = null,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            tint = FishTheme.colors.body,
        )
        Text(
            text = label,
            modifier = Modifier.padding(start = FishTheme.spacing.sm),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.ui,
        )
    }
}
