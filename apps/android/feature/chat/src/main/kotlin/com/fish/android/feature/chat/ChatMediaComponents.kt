package com.fish.android.feature.chat

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.compose.PlayerSurface
import coil3.compose.AsyncImage
import com.fish.android.core.designsystem.FishIcons
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.core.designsystem.component.FishIconButton

@Composable
fun ComposerMediaPreview(
    media: ComposerMediaUiModel,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sticker = (media as? ComposerMediaUiModel.Sticker)?.value
    val gif = (media as? ComposerMediaUiModel.Gif)?.value
    val description = when {
        sticker != null -> stringResource(R.string.selected_sticker, sticker.phrase)
        gif != null -> stringResource(R.string.selected_gif, gif.description)
        else -> ""
    }
    Row(
        modifier = modifier
            .semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(
            model = sticker?.assetPath?.let { "file:///android_asset/$it" } ?: gif?.posterUrl,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .size(FishTheme.spacing.fourXl)
                .clip(RoundedCornerShape(FishTheme.radii.control))
                .background(FishTheme.colors.surfaceAlt),
        )
        FishIconButton(
            icon = FishIcons.Close,
            contentDescription = stringResource(
                if (sticker != null) R.string.remove_selected_sticker else R.string.remove_selected_gif,
            ),
            onClick = onRemove,
            size = FishTheme.sizes.touchTarget,
        )
    }
}

@Composable
fun StickerMessageMedia(
    sticker: StickerUiModel,
    author: String,
    timeLabel: String,
    modifier: Modifier = Modifier,
) {
    val spoken = "$author. ${sticker.description}. $timeLabel"
    if (!sticker.available) {
        Box(
            modifier = modifier
                .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
                .heightIn(min = FishTheme.spacing.fourXl)
                .clip(RoundedCornerShape(FishTheme.radii.control))
                .background(FishTheme.colors.surfaceAlt)
                .semantics { contentDescription = spoken },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = stringResource(R.string.sticker_unavailable),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        }
        return
    }
    AsyncImage(
        model = "file:///android_asset/${sticker.assetPath}",
        contentDescription = spoken,
        contentScale = ContentScale.Fit,
        modifier = modifier
            .size(FishTheme.spacing.fourXl),
    )
}

@OptIn(UnstableApi::class)
@Composable
fun GifMessageMedia(
    gif: GifUiModel,
    author: String,
    timeLabel: String,
    playing: Boolean,
    onTogglePlayback: () -> Unit,
    onReport: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    var posterFailed by remember(gif.posterUrl) { mutableStateOf(false) }
    val uriHandler = LocalUriHandler.current
    val spoken = "$author. ${gif.description}. $timeLabel"
    val aspectRatio = (gif.width.toFloat() / gif.height.toFloat()).coerceIn(0.6f, 1.8f)
    Column(
        modifier = modifier.fillMaxWidth(FishTheme.layout.messageMaxWidthFraction),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(aspectRatio)
                .clip(RoundedCornerShape(FishTheme.radii.chat))
                .background(FishTheme.colors.surfaceAlt)
                .semantics { contentDescription = spoken },
        ) {
            if (playing) {
                TranscriptGifPlayer(gif = gif, modifier = Modifier.fillMaxSize())
            } else {
                if (posterFailed) {
                    Text(
                        text = stringResource(R.string.gif_unavailable_media),
                        modifier = Modifier.align(Alignment.Center),
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.body,
                    )
                } else {
                    AsyncImage(
                        model = gif.posterUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        onError = { posterFailed = true },
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
            FishIconButton(
                icon = if (playing) FishIcons.Pause else FishIcons.Play,
                contentDescription = stringResource(
                    if (playing) R.string.pause_gif else R.string.play_gif,
                ),
                onClick = onTogglePlayback,
                modifier = Modifier.align(Alignment.Center),
                size = FishTheme.sizes.primaryControl,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.via_klipy),
                modifier = Modifier
                    .weight(1f)
                    .padding(start = FishTheme.spacing.xs)
                    .clickable { uriHandler.openUri(gif.sourceUrl) }
                    .semantics { contentDescription = "Via KLIPY" },
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
            )
            Box {
                FishIconButton(
                    icon = FishIcons.MoreVertical,
                    contentDescription = stringResource(R.string.report_gif),
                    onClick = { menuExpanded = true },
                    size = FishTheme.sizes.touchTarget,
                )
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.report_gif)) },
                        onClick = {
                            menuExpanded = false
                            onReport()
                        },
                    )
                }
            }
        }
    }
}

@Composable
fun GifUnavailableMedia(modifier: Modifier = Modifier) {
    val unavailable = stringResource(R.string.gif_unavailable_media)
    Box(
        modifier = modifier
            .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
            .heightIn(min = FishTheme.spacing.fourXl)
            .clip(RoundedCornerShape(FishTheme.radii.control))
            .background(FishTheme.colors.surfaceAlt)
            .semantics { contentDescription = unavailable },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = unavailable,
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
        )
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun TranscriptGifPlayer(gif: GifUiModel, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val player = remember(gif.mediaUrl) {
        ExoPlayer.Builder(context).build().apply {
            volume = 0f
            repeatMode = Player.REPEAT_MODE_ONE
            setMediaItem(MediaItem.fromUri(gif.mediaUrl))
            prepare()
            playWhenReady = true
        }
    }
    DisposableEffect(player) {
        onDispose { player.release() }
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { player.pause() }
    PlayerSurface(player = player, modifier = modifier)
}
