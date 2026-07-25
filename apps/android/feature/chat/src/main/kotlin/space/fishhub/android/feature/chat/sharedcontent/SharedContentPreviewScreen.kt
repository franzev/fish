package space.fishhub.android.feature.chat.sharedcontent

import android.graphics.BitmapFactory
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.feature.chat.R
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

enum class SharedContentNativeAction {
    Share,
    Save,
    Download,
    Open,
}

sealed interface SharedContentNativeActionResult {
    data object Started : SharedContentNativeActionResult
    data object Unavailable : SharedContentNativeActionResult
    data class Failed(val message: String) : SharedContentNativeActionResult
}

data class SharedContentPreviewItem(
    val itemId: String,
    val conversationId: String,
    val sourceMessageId: String?,
    val kind: String,
    val category: String,
    val title: String,
    val description: String?,
    val originalName: String?,
    val mimeType: String?,
    val byteSize: Long?,
    val width: Int?,
    val height: Int?,
    val durationMs: Long?,
    val linkUrl: String?,
    val attachmentId: String?,
    val senderName: String,
    val sourceDateLabel: String,
    val contentVersion: String,
    val canDelete: Boolean,
    val canExport: Boolean,
) {
    private val hasVerifiedAttachmentMetadata: Boolean
        get() = !attachmentId.isNullOrBlank() &&
            !mimeType.isNullOrBlank() &&
            byteSize != null && byteSize > 0

    val canTransfer: Boolean
        get() = canExport && kind !in setOf("gif", "sticker") &&
            (hasVerifiedAttachmentMetadata || linkUrl.isSafeSharedContentLink())

    val canShowDelete: Boolean
        get() = canDelete && sourceMessageId?.isNotBlank() == true

    val canOpen: Boolean
        get() = if (kind == "link") {
            linkUrl.isSafeSharedContentLink()
        } else {
            kind in setOf("video", "document", "voice") && hasVerifiedAttachmentMetadata
        }

    val thumbnailHandle: SharedContentThumbnailHandle
        get() = SharedContentThumbnailHandle(itemId, contentVersion)
}

fun SharedContentAcceptedItem.toPreviewItem(
    senderName: String = senderId.ifBlank { "Sender unavailable" },
    locale: java.util.Locale = java.util.Locale.getDefault(),
    zone: java.time.ZoneId = java.time.ZoneId.systemDefault(),
): SharedContentPreviewItem = SharedContentPreviewItem(
    itemId = itemId,
    conversationId = conversationId,
    sourceMessageId = sourceMessageId,
    kind = kind,
    category = category,
    title = when (kind) {
        "document" -> originalName ?: "File"
        "link" -> linkTitle ?: linkHostname ?: "Link"
        "voice" -> "Voice message"
        else -> mediaTitle ?: originalName ?: kind.replaceFirstChar(Char::uppercase)
    },
    description = mediaDescription,
    originalName = originalName,
    mimeType = mimeType,
    byteSize = byteSize,
    width = width,
    height = height,
    durationMs = durationMs,
    linkUrl = linkUrl,
    attachmentId = attachmentId,
    senderName = senderName.ifBlank { "Sender unavailable" },
    sourceDateLabel = sourceDateLabel(sourceCreatedAt, locale, zone),
    contentVersion = contentVersion,
    canDelete = canDelete,
    canExport = canExport,
)

private fun sourceDateLabel(
    value: String,
    locale: java.util.Locale,
    zone: java.time.ZoneId,
): String = runCatching {
    java.time.format.DateTimeFormatter
        .ofLocalizedDateTime(java.time.format.FormatStyle.MEDIUM)
        .withLocale(locale)
        .withZone(zone)
        .format(java.time.Instant.parse(value))
}.getOrDefault("Date unavailable")

private fun String?.isSafeSharedContentLink(): Boolean = this?.let { value ->
    runCatching {
        val uri = java.net.URI(value)
        uri.host?.isNotBlank() == true && uri.scheme.lowercase() in setOf("http", "https")
    }.getOrDefault(false)
} == true

/** Full-screen preview. Media is deliberately paused until the user asks to open it. */
@Composable
fun SharedContentPreviewScreen(
    item: SharedContentPreviewItem,
    onBack: () -> Unit,
    onOpenSource: (String) -> Unit,
    onNativeAction: suspend (SharedContentNativeAction) -> SharedContentNativeActionResult,
    onDelete: (String) -> Unit,
    thumbnailLoader: (suspend (SharedContentThumbnailHandle) -> ByteArray?)? = null,
    modifier: Modifier = Modifier,
) {
    var thumbnail by remember(item.itemId, item.contentVersion) { mutableStateOf<ByteArray?>(null) }
    var loadingThumbnail by remember(item.itemId, item.contentVersion) { mutableStateOf(false) }
    var failedThumbnail by remember(item.itemId, item.contentVersion) { mutableStateOf(false) }
    var confirmDelete by remember(item.itemId) { mutableStateOf(false) }
    var retryNonce by remember(item.itemId, item.contentVersion) { mutableStateOf(0) }
    var actionInFlight by remember(item.itemId, item.contentVersion) {
        mutableStateOf<SharedContentNativeAction?>(null)
    }
    var actionFailure by remember(item.itemId, item.contentVersion) { mutableStateOf<String?>(null) }
    val actionScope = rememberCoroutineScope()
    val defaultActionFailure = stringResource(R.string.shared_content_unavailable_description)

    BackHandler(onBack = onBack)
    LaunchedEffect(item.itemId, item.contentVersion, thumbnailLoader, retryNonce) {
        if (thumbnailLoader == null || !isSharedContentThumbnailPreviewKind(item.kind)) {
            return@LaunchedEffect
        }
        loadingThumbnail = true
        failedThumbnail = false
        thumbnail = thumbnailLoader(item.thumbnailHandle)
        failedThumbnail = thumbnail == null
        loadingThumbnail = false
    }

    fun requestNativeAction(action: SharedContentNativeAction) {
        if (actionInFlight != null) return
        actionFailure = null
        actionInFlight = action
        actionScope.launch {
            val result = try {
                onNativeAction(action)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Throwable) {
                SharedContentNativeActionResult.Failed(defaultActionFailure)
            }
            actionInFlight = null
            actionFailure = when (result) {
                SharedContentNativeActionResult.Started -> null
                SharedContentNativeActionResult.Unavailable -> defaultActionFailure
                is SharedContentNativeActionResult.Failed ->
                    result.message.ifBlank { defaultActionFailure }
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
    ) {
        FishTopBar(
            title = item.title,
            subtitle = "${item.senderName} · ${item.sourceDateLabel}",
            showBack = true,
            onBack = onBack,
        )
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(FishTheme.spacing.page),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            PreviewBody(
                item = item,
                thumbnail = thumbnail,
                loading = loadingThumbnail,
                failed = failedThumbnail,
                onRetry = {
                    retryNonce += 1
                },
            )
            if (item.description != null) {
                Text(item.description, color = FishTheme.colors.body, style = FishTheme.typography.body)
            }
            if (failedThumbnail) {
                FishNotice(
                    title = "This preview is unavailable right now. Try again.",
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            actionFailure?.let { message ->
                FishNotice(
                    title = message,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (item.canTransfer && item.kind == "link") {
                FishButton(
                    label = "Share",
                    onClick = { requestNativeAction(SharedContentNativeAction.Share) },
                    modifier = Modifier.fillMaxWidth(),
                    variant = FishButtonVariant.Primary,
                    enabled = actionInFlight == null,
                    loading = actionInFlight == SharedContentNativeAction.Share,
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                ) {
                    if (item.canTransfer) {
                        FishButton(
                            label = "Share",
                            onClick = { requestNativeAction(SharedContentNativeAction.Share) },
                            modifier = Modifier.weight(1f),
                            variant = FishButtonVariant.Primary,
                            enabled = actionInFlight == null,
                            loading = actionInFlight == SharedContentNativeAction.Share,
                        )
                        FishButton(
                            label = "Save",
                            onClick = { requestNativeAction(SharedContentNativeAction.Save) },
                            modifier = Modifier.weight(1f),
                            variant = FishButtonVariant.Secondary,
                            enabled = actionInFlight == null,
                            loading = actionInFlight == SharedContentNativeAction.Save,
                        )
                        FishButton(
                            label = "Download",
                            onClick = { requestNativeAction(SharedContentNativeAction.Download) },
                            modifier = Modifier.weight(1f),
                            variant = FishButtonVariant.Secondary,
                            enabled = actionInFlight == null,
                            loading = actionInFlight == SharedContentNativeAction.Download,
                        )
                    } else if (item.kind in setOf("gif", "sticker")) {
                        Text(
                            text = "Export is unavailable for this item yet.",
                            color = FishTheme.colors.muted,
                            style = FishTheme.typography.caption,
                        )
                    }
                }
            }
            if (item.canOpen) {
                FishButton(
                    label = if (item.kind == "video") "Play video" else "Open",
                    onClick = { requestNativeAction(SharedContentNativeAction.Open) },
                    modifier = Modifier.fillMaxWidth(),
                    variant = FishButtonVariant.Secondary,
                    enabled = actionInFlight == null,
                    loading = actionInFlight == SharedContentNativeAction.Open,
                )
            }
            FishButton(
                label = "Go to source message",
                onClick = { item.sourceMessageId?.let(onOpenSource) },
                modifier = Modifier.fillMaxWidth(),
                variant = FishButtonVariant.Ghost,
                enabled = item.sourceMessageId?.isNotBlank() == true,
            )
            if (item.canShowDelete) {
                FishButton(
                    label = "Delete message",
                    onClick = { confirmDelete = true },
                    modifier = Modifier.fillMaxWidth(),
                    variant = FishButtonVariant.Ghost,
                )
            }
        }
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete this message?") },
            text = { Text("This removes the whole source message and every item derived from it in shared content.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    item.sourceMessageId?.let(onDelete)
                }) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }
}

internal fun isSharedContentThumbnailPreviewKind(kind: String): Boolean =
    kind in setOf("photo", "video", "gif", "sticker")

@Composable
private fun PreviewBody(
    item: SharedContentPreviewItem,
    thumbnail: ByteArray?,
    loading: Boolean,
    failed: Boolean,
    onRetry: () -> Unit,
) {
    val image = remember(thumbnail) {
        thumbnail?.let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() }
    }
    if (image != null) {
        Image(
            bitmap = image,
            contentDescription = item.title,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(
                    min = FishTheme.sizes.sharedContentPreviewMin,
                    max = FishTheme.sizes.sharedContentPreviewMax,
                ),
            contentScale = ContentScale.Fit,
        )
    } else {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = FishTheme.sizes.sharedContentPreviewMin)
                .background(FishTheme.colors.surfaceAlt)
                .padding(FishTheme.spacing.lg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(item.title, color = FishTheme.colors.foreground, style = FishTheme.typography.heading)
            val detail = when (item.kind) {
                "document" -> listOfNotNull(item.mimeType, item.byteSize?.let(::formatBytes)).joinToString(" · ")
                "voice" -> item.durationMs?.let(::formatDuration) ?: "Duration unavailable"
                "link" -> item.linkUrl ?: item.title
                "video" -> "Video is paused until you choose Play video."
                else -> if (loading) "Loading preview…" else if (failed) "Preview unavailable" else "Preview"
            }
            Spacer(Modifier.size(FishTheme.spacing.xs))
            Text(detail, color = FishTheme.colors.body, style = FishTheme.typography.body)
            if (failed) {
                Spacer(Modifier.size(FishTheme.spacing.sm))
                FishButton("Try again", onRetry, variant = FishButtonVariant.Secondary)
            }
        }
    }
}

private fun formatBytes(value: Long): String = when {
    value >= 1_000_000 -> "%.1f MB".format(java.util.Locale.ROOT, value / 1_000_000.0)
    value >= 1_000 -> "%.1f KB".format(java.util.Locale.ROOT, value / 1_000.0)
    else -> "$value B"
}

private fun formatDuration(value: Long): String {
    val seconds = value / 1_000
    return "%d:%02d".format(seconds / 60, seconds % 60)
}
