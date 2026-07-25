package space.fishhub.android.feature.chat.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.logic.attachmentRemoveDescription
import space.fishhub.android.feature.chat.logic.toAttachmentImageModel
import space.fishhub.android.feature.chat.model.LocalAttachmentUiModel
import space.fishhub.android.feature.chat.views.AttachmentDraftPhoto
import space.fishhub.android.feature.chat.views.AttachmentFileSummary

@Composable
fun AttachmentPreviewScreen(
    attachments: List<LocalAttachmentUiModel>,
    importing: Boolean,
    notice: String?,
    onRemove: (String) -> Unit,
    onAddToMessage: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onDismiss)
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(FishTheme.spacing.page),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FishIconButton(
                icon = FishIcons.Close,
                contentDescription = stringResource(R.string.close_attachment_preview),
                onClick = onDismiss,
                size = FishTheme.sizes.touchTarget,
            )
            Text(
                text = stringResource(R.string.attachment_preview_title),
                modifier = Modifier
                    .weight(1f)
                    .padding(start = FishTheme.spacing.sm),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.heading,
            )
        }
        Text(
            text = stringResource(R.string.attachment_preview_description),
            modifier = Modifier.padding(top = FishTheme.spacing.xs),
            color = FishTheme.colors.body,
            style = FishTheme.typography.ui,
        )
        if (importing) {
            Row(
                modifier = Modifier.padding(top = FishTheme.spacing.lg),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(FishTheme.sizes.iconGlyph),
                    color = FishTheme.colors.foreground,
                    strokeWidth = FishTheme.spacing.threeXs,
                )
                Text(
                    text = stringResource(R.string.preparing_attachments),
                    modifier = Modifier.padding(start = FishTheme.spacing.sm),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.ui,
                )
            }
        }
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(top = FishTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            items(attachments, key = { it.id }) { attachment ->
                AttachmentPreviewItem(attachment = attachment, onRemove = onRemove)
            }
        }
        if (notice != null) {
            FishNotice(
                message = notice,
                modifier = Modifier.padding(bottom = FishTheme.spacing.sm),
            )
        }
        FishButton(
            label = stringResource(R.string.add_to_message),
            onClick = onAddToMessage,
            modifier = Modifier.fillMaxWidth(),
            enabled = attachments.isNotEmpty() && !importing,
            loading = importing,
            loadingDescription = stringResource(R.string.preparing_attachments),
        )
    }
}

@Composable
private fun AttachmentPreviewItem(
    attachment: LocalAttachmentUiModel,
    onRemove: (String) -> Unit,
) {
    val removeDescription = attachmentRemoveDescription(attachment)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(FishTheme.radii.card))
            .background(FishTheme.colors.surface)
            .padding(FishTheme.spacing.sm),
    ) {
        if (attachment.isPhoto) {
            AttachmentDraftPhoto(
                model = attachment.localPath.toAttachmentImageModel(),
                contentDescription = stringResource(
                    R.string.preview_photo_position,
                    attachment.position + 1,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = FishTheme.sizes.conversationRail)
                    .aspectRatio(
                        (attachment.width ?: 1).toFloat() /
                            (attachment.height ?: 1).coerceAtLeast(1).toFloat(),
                        matchHeightConstraintsFirst = false,
                    )
                    .clip(RoundedCornerShape(FishTheme.radii.control)),
                contentScale = ContentScale.Fit,
            )
        } else {
            AttachmentFileSummary(attachment)
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = FishTheme.spacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.attachment_position, attachment.position + 1),
                modifier = Modifier.weight(1f),
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
            )
            FishButton(
                label = stringResource(R.string.remove_attachment),
                onClick = { onRemove(attachment.id) },
                variant = FishButtonVariant.Ghost,
                modifier = Modifier.semantics {
                    contentDescription = removeDescription
                },
            )
        }
    }
}
