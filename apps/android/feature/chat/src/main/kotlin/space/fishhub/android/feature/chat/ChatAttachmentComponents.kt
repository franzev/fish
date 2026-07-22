package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import java.text.DecimalFormat

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
private fun AttachmentPhotoImage(
    url: String,
    cacheKey: String,
    contentDescription: String?,
    contentScale: ContentScale,
    onError: () -> Unit,
    modifier: Modifier,
) {
    if (LocalInspectionMode.current) {
        Image(
            painter = painterResource(R.drawable.attachment_preview_sample),
            contentDescription = contentDescription,
            contentScale = contentScale,
            modifier = modifier,
        )
    } else {
        AsyncImage(
            model = attachmentImageRequest(url = url, cacheKey = cacheKey),
            contentDescription = contentDescription,
            contentScale = contentScale,
            onError = { onError() },
            modifier = modifier,
        )
    }
}

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

@Composable
fun AttachmentPhotoViewer(
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
        AttachmentPhotoViewerContent(
            attachment = attachment,
            onDismiss = onDismiss,
            onLoadError = onLoadError,
        )
    }
}

@Composable
internal fun AttachmentPhotoViewerContent(
    attachment: AttachmentUiModel,
    onDismiss: () -> Unit,
    onLoadError: (String) -> Unit,
) {
    var scale by remember(attachment.id) { mutableFloatStateOf(1f) }
    val viewerDescription = stringResource(R.string.photo_viewer_accessibility, attachment.name)
    val unavailableDescription = stringResource(
        R.string.photo_viewer_unavailable_accessibility,
        attachment.name,
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
        contentAlignment = Alignment.Center,
    ) {
        if (attachment.displayUrl == null) {
            Text(
                text = stringResource(R.string.photo_unavailable),
                modifier = Modifier.semantics {
                    contentDescription = unavailableDescription
                },
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        } else {
            AttachmentPhotoImage(
                url = attachment.displayUrl,
                cacheKey = "${attachment.id}:display:${attachment.contentVersion}",
                contentDescription = viewerDescription,
                contentScale = ContentScale.Fit,
                onError = { onLoadError(attachment.id) },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(FishTheme.spacing.page)
                    .pointerInput(attachment.id) {
                        detectTransformGestures { _, _, zoom, _ ->
                            scale = (scale * zoom).coerceIn(1f, MaxViewerScale)
                        }
                    }
                    .graphicsLayer(scaleX = scale, scaleY = scale),
            )
        }
        FishIconButton(
            icon = FishIcons.Close,
            contentDescription = stringResource(R.string.close_photo_viewer),
            onClick = onDismiss,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .statusBarsPadding()
                .padding(FishTheme.spacing.sm),
            size = FishTheme.sizes.touchTarget,
        )
    }
}

@Composable
private fun attachmentImageRequest(url: String, cacheKey: String): ImageRequest =
    ImageRequest.Builder(LocalContext.current)
        .data(url)
        .memoryCacheKey(cacheKey)
        .diskCacheKey(cacheKey)
        .build()

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

private const val MinPhotoAspect = 0.6f
private const val MaxPhotoAspect = 1.8f
private const val MaxViewerScale = 4f
