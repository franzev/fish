package space.fishhub.android.feature.chat

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import coil3.compose.AsyncImage
import java.io.File
import java.util.Locale
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.core.designsystem.component.FishNotice

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AttachmentSourceSheet(
    remainingSlots: Int,
    cameraAvailable: Boolean,
    onChoosePhotos: () -> Unit,
    onTakePhoto: () -> Unit,
    onChooseFile: () -> Unit,
    onDismiss: () -> Unit,
) {
    FishModalBottomSheet(onDismissRequest = onDismiss) {
        AttachmentSourceContent(
            remainingSlots = remainingSlots,
            cameraAvailable = cameraAvailable,
            onChoosePhotos = onChoosePhotos,
            onTakePhoto = onTakePhoto,
            onChooseFile = onChooseFile,
            onDismiss = onDismiss,
            modifier = Modifier.navigationBarsPadding(),
        )
    }
}

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

@Composable
fun ComposerAttachmentQueue(
    attachments: List<LocalAttachmentUiModel>,
    onRemove: (String) -> Unit,
    onRetry: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (attachments.isEmpty()) return
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val fontScale = LocalDensity.current.fontScale
        val cardWidth = when {
            fontScale > DefaultFontScale -> maxWidth
            maxWidth >= FishTheme.layout.twoPaneBreakpoint -> FishTheme.sizes.conversationRail
            else -> (maxWidth - FishTheme.spacing.xl).coerceAtLeast(FishTheme.sizes.touchTarget)
        }
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        ) {
            items(attachments, key = { it.id }) { attachment ->
                val status = attachmentStatusLabel(attachment.transferState)
                val failure = attachment.failureReason?.let { attachmentFailureLabel(it) }
                val summary = if (failure == null) {
                    stringResource(R.string.attachment_queue_accessibility, attachment.name, status)
                } else {
                    stringResource(
                        R.string.attachment_queue_failure_accessibility,
                        attachment.name,
                        status,
                        failure,
                    )
                }
                val retryDescription = stringResource(
                    R.string.retry_attachment_accessibility,
                    attachment.name,
                )
                val removeDescription = attachmentRemoveDescription(attachment)
                Column(
                    modifier = Modifier
                        .width(cardWidth)
                        .clip(RoundedCornerShape(FishTheme.radii.control))
                        .background(FishTheme.colors.surface)
                        .padding(FishTheme.spacing.sm),
                ) {
                    Column(
                        modifier = Modifier.clearAndSetSemantics {
                            contentDescription = summary
                            if (attachment.transferState == AttachmentTransferUiState.Uploading) {
                                progressBarRangeInfo = ProgressBarRangeInfo(
                                    attachment.progressFraction,
                                    0f..1f,
                                )
                            }
                        },
                    ) {
                        if (attachment.isPhoto) {
                            AttachmentDraftPhoto(
                                model = (attachment.thumbnailPath ?: attachment.localPath)
                                    .toAttachmentImageModel(),
                                contentDescription = stringResource(
                                    R.string.attached_photo_position,
                                    attachment.position + 1,
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(FishTheme.sizes.avatarLarge)
                                    .clip(RoundedCornerShape(FishTheme.radii.chatInner)),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            AttachmentFileSummary(attachment)
                        }
                        Text(
                            text = status,
                            modifier = Modifier.padding(top = FishTheme.spacing.xs),
                            color = if (attachment.transferState == AttachmentTransferUiState.Failed) {
                                FishTheme.colors.notice
                            } else {
                                FishTheme.colors.body
                            },
                            style = FishTheme.typography.caption,
                        )
                        AttachmentTransferProgress(attachment)
                        if (failure != null) {
                            Text(
                                text = failure,
                                modifier = Modifier.padding(top = FishTheme.spacing.xs),
                                color = FishTheme.colors.notice,
                                style = FishTheme.typography.caption,
                            )
                        }
                    }
                    if (attachment.retryable) {
                        FishButton(
                            label = stringResource(R.string.try_attachment_again),
                            onClick = { onRetry(attachment.id) },
                            variant = FishButtonVariant.Ghost,
                            modifier = Modifier
                                .fillMaxWidth()
                                .semantics { contentDescription = retryDescription },
                        )
                    }
                    FishButton(
                        label = stringResource(R.string.remove_attachment),
                        onClick = { onRemove(attachment.id) },
                        variant = FishButtonVariant.Ghost,
                        modifier = Modifier
                            .fillMaxWidth()
                            .semantics { contentDescription = removeDescription },
                    )
                }
            }
        }
    }
}

private fun String.toAttachmentImageModel(): Any =
    if (startsWith(AndroidAssetScheme)) this else File(this)

@Composable
private fun AttachmentDraftPhoto(
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

private const val AndroidAssetScheme = "file:///android_asset/"

@Composable
private fun AttachmentTransferProgress(attachment: LocalAttachmentUiModel) {
    val modifier = Modifier
        .fillMaxWidth()
        .padding(top = FishTheme.spacing.xs)
        .height(FishTheme.spacing.sm)
        .clip(RoundedCornerShape(FishTheme.radii.pill))
    when (attachment.transferState) {
        AttachmentTransferUiState.Uploading -> LinearProgressIndicator(
            progress = { attachment.progressFraction },
            modifier = modifier,
            color = FishTheme.colors.primary,
            trackColor = FishTheme.colors.surfaceAlt,
        )
        AttachmentTransferUiState.Preparing,
        AttachmentTransferUiState.Checking,
        -> LinearProgressIndicator(
            modifier = modifier,
            color = FishTheme.colors.primary,
            trackColor = FishTheme.colors.surfaceAlt,
        )
        else -> Unit
    }
}

@Composable
private fun attachmentStatusLabel(state: AttachmentTransferUiState): String = stringResource(
    when (state) {
        AttachmentTransferUiState.Preparing -> R.string.attachment_status_preparing
        AttachmentTransferUiState.Uploading -> R.string.attachment_status_uploading
        AttachmentTransferUiState.Checking -> R.string.attachment_status_checking
        AttachmentTransferUiState.Waiting -> R.string.attachment_status_waiting
        AttachmentTransferUiState.Failed -> R.string.attachment_status_failed
        AttachmentTransferUiState.Ready -> R.string.attachment_status_ready
    },
)

@Composable
private fun attachmentFailureLabel(reason: AttachmentFailureUiReason): String = stringResource(
    when (reason) {
        AttachmentFailureUiReason.SafetyCheckFailed -> R.string.attachment_failure_safety_check
        AttachmentFailureUiReason.LocalCopyUnavailable -> R.string.attachment_failure_local_copy
        AttachmentFailureUiReason.SignInRequired -> R.string.attachment_failure_sign_in
        AttachmentFailureUiReason.RetryLimitReached -> R.string.attachment_failure_retry_limit
        AttachmentFailureUiReason.NeedsAttention -> R.string.attachment_failure_attention
    },
)

@Composable
private fun attachmentRemoveDescription(attachment: LocalAttachmentUiModel): String = if (attachment.isPhoto) {
    stringResource(R.string.remove_photo_accessibility, attachment.position + 1)
} else {
    stringResource(R.string.remove_file_accessibility, attachment.name)
}

@Composable
private fun AttachmentFileSummary(attachment: LocalAttachmentUiModel) {
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

internal val AttachmentIcon = FishIcons.Attachment

private fun formatDraftFileSize(bytes: Long): String = when {
    bytes < 1_024 -> "$bytes B"
    bytes < 1_024 * 1_024 -> String.format(Locale.getDefault(), "%.1f KB", bytes / 1_024.0)
    else -> String.format(Locale.getDefault(), "%.1f MB", bytes / (1_024.0 * 1_024.0))
}

private const val DefaultFontScale = 1f
