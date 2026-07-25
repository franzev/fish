package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun MessageAttachmentGroup(
    attachments: List<AttachmentUiModel>,
    author: String,
    timeLabel: String,
    onPhotoClick: (String) -> Unit,
    onFileClick: (String) -> Unit,
    onFileShare: (String) -> Unit = {},
    onPhotoLoadError: (String) -> Unit,
    playingVoiceId: String? = null,
    onToggleVoice: (String) -> Unit = {},
    onAttachmentLoadError: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(FishTheme.layout.messageMaxWidthFraction),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
    ) {
        attachmentRuns(attachments).forEach { run ->
            when (run) {
                is AttachmentRun.Photos -> PhotoRun(
                    photos = run.items,
                    author = author,
                    timeLabel = timeLabel,
                    onClick = onPhotoClick,
                    onLoadError = onPhotoLoadError,
                )
                is AttachmentRun.Item -> when (run.item.kind) {
                    AttachmentUiKind.Voice -> VoiceMessageMedia(
                        attachment = run.item,
                        author = author,
                        timeLabel = timeLabel,
                        playing = run.item.id == playingVoiceId,
                        onTogglePlayback = { onToggleVoice(run.item.id) },
                        onPlaybackError = { onAttachmentLoadError(run.item.id) },
                    )
                    AttachmentUiKind.Video -> VideoMessageMedia(
                        attachment = run.item,
                        author = author,
                        timeLabel = timeLabel,
                        playing = run.item.id == playingVoiceId,
                        onTogglePlayback = { onToggleVoice(run.item.id) },
                        onPlaybackError = { onAttachmentLoadError(run.item.id) },
                        onFileClick = { onFileClick(run.item.id) },
                        onFileShare = { onFileShare(run.item.id) },
                    )
                    AttachmentUiKind.File -> FileAttachmentCard(
                        attachment = run.item,
                        author = author,
                        timeLabel = timeLabel,
                        onClick = { onFileClick(run.item.id) },
                        onShare = { onFileShare(run.item.id) },
                    )
                    AttachmentUiKind.Unavailable -> UnavailableAttachmentCard(
                        attachment = run.item,
                        author = author,
                        timeLabel = timeLabel,
                    )
                    AttachmentUiKind.Photo -> Unit
                }
            }
        }
    }
}

@Composable
private fun PhotoRun(
    photos: List<AttachmentUiModel>,
    author: String,
    timeLabel: String,
    onClick: (String) -> Unit,
    onLoadError: (String) -> Unit,
) {
    val gap = FishTheme.spacing.twoXs
    when (photos.size) {
        1 -> {
            val photo = photos.single()
            val ratio = ((photo.width ?: 4).toFloat() / (photo.height ?: 3).toFloat())
                .coerceIn(MinPhotoAspect, MaxPhotoAspect)
            PhotoCell(photo, author, timeLabel, onClick, onLoadError, Modifier.aspectRatio(ratio))
        }
        2 -> Row(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f),
            horizontalArrangement = Arrangement.spacedBy(gap),
        ) {
            photos.forEach { photo ->
                PhotoCell(
                    photo,
                    author,
                    timeLabel,
                    onClick,
                    onLoadError,
                    Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                )
            }
        }
        3 -> Row(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.45f),
            horizontalArrangement = Arrangement.spacedBy(gap),
        ) {
            PhotoCell(
                photos[0], author, timeLabel, onClick, onLoadError,
                Modifier
                    .weight(1.7f)
                    .fillMaxHeight(),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(gap),
            ) {
                photos.drop(1).forEach { photo ->
                    PhotoCell(
                        photo, author, timeLabel, onClick, onLoadError,
                        Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                    )
                }
            }
        }
        4 -> PhotoGrid(
            photos = photos,
            author = author,
            timeLabel = timeLabel,
            onClick = onClick,
            onLoadError = onLoadError,
            modifier = Modifier.aspectRatio(1f),
        )
        else -> Row(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.15f),
            horizontalArrangement = Arrangement.spacedBy(gap),
        ) {
            PhotoCell(
                photos[0], author, timeLabel, onClick, onLoadError,
                Modifier
                    .weight(1.1f)
                    .fillMaxHeight(),
            )
            PhotoGrid(
                photos = photos.drop(1).take(4),
                author = author,
                timeLabel = timeLabel,
                onClick = onClick,
                onLoadError = onLoadError,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
            )
        }
    }
}

@Composable
private fun PhotoGrid(
    photos: List<AttachmentUiModel>,
    author: String,
    timeLabel: String,
    onClick: (String) -> Unit,
    onLoadError: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
    ) {
        photos.chunked(2).forEach { row ->
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
            ) {
                row.forEach { photo ->
                    PhotoCell(
                        photo, author, timeLabel, onClick, onLoadError,
                        Modifier
                            .weight(1f)
                            .fillMaxHeight(),
                    )
                }
            }
        }
    }
}

@Composable
private fun PhotoCell(
    photo: AttachmentUiModel,
    author: String,
    timeLabel: String,
    onClick: (String) -> Unit,
    onLoadError: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val description = stringResource(R.string.photo_attachment_accessibility, author, photo.name, timeLabel)
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(FishTheme.radii.chat))
            .background(FishTheme.colors.surfaceAlt)
            .clickable(
                enabled = photo.available,
                role = Role.Button,
                onClickLabel = stringResource(R.string.open_photo),
            ) { onClick(photo.id) }
            .semantics {
                contentDescription = description
                role = Role.Button
            },
        contentAlignment = Alignment.Center,
    ) {
        if (photo.thumbnailUrl == null) {
            Text(
                text = stringResource(R.string.photo_unavailable),
                modifier = Modifier.padding(FishTheme.spacing.sm),
                color = FishTheme.colors.body,
                style = FishTheme.typography.caption,
            )
        } else {
            AttachmentPhotoImage(
                url = photo.thumbnailUrl,
                cacheKey = "${photo.id}:thumbnail:${photo.contentVersion}",
                contentDescription = null,
                contentScale = ContentScale.Crop,
                onError = { onLoadError(photo.id) },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
private fun UnavailableAttachmentCard(
    attachment: AttachmentUiModel,
    author: String,
    timeLabel: String,
) {
    val label = stringResource(R.string.attachment_unavailable)
    val description = stringResource(
        R.string.attachment_unavailable_accessibility,
        author,
        attachment.name,
        label,
        timeLabel,
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = FishTheme.sizes.touchTarget)
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.surfaceAlt)
            .padding(FishTheme.spacing.md)
            .semantics {
                contentDescription = description
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(text = label, color = FishTheme.colors.body, style = FishTheme.typography.body)
    }
}

internal sealed interface AttachmentRun {
    data class Photos(val items: List<AttachmentUiModel>) : AttachmentRun
    data class Item(val item: AttachmentUiModel) : AttachmentRun
}

internal fun attachmentRuns(attachments: List<AttachmentUiModel>): List<AttachmentRun> {
    val ordered = attachments.sortedWith(compareBy(AttachmentUiModel::position, AttachmentUiModel::id))
    val result = mutableListOf<AttachmentRun>()
    var photos = mutableListOf<AttachmentUiModel>()
    fun flushPhotos() {
        if (photos.isNotEmpty()) result += AttachmentRun.Photos(photos.toList())
        photos = mutableListOf()
    }
    ordered.forEach { attachment ->
        if (attachment.kind == AttachmentUiKind.Photo && attachment.available) {
            photos += attachment
        } else {
            flushPhotos()
            result += AttachmentRun.Item(attachment)
        }
    }
    flushPhotos()
    return result
}

private const val MinPhotoAspect = 0.6f

private const val MaxPhotoAspect = 1.8f
