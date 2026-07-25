package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant

@Composable
fun StagedAttachmentStrip(
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

private const val DefaultFontScale = 1f
