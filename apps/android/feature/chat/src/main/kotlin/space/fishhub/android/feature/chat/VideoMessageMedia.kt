package space.fishhub.android.feature.chat

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.compose.PlayerSurface
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import androidx.compose.runtime.LaunchedEffect

@OptIn(UnstableApi::class)
@Composable
fun VideoMessageMedia(
    attachment: AttachmentUiModel,
    author: String,
    timeLabel: String,
    playing: Boolean,
    onTogglePlayback: () -> Unit,
    onPlaybackError: () -> Unit = {},
    onFileClick: () -> Unit = {},
    onFileShare: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val source = attachment.displayUrl
    var failed by remember(source) { mutableStateOf(source == null) }
    val context = LocalContext.current
    val player = if (playing && source != null && !failed) {
        remember(source) {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(source.toMediaUri()))
                addListener(object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        failed = true
                        onPlaybackError()
                    }
                })
                prepare()
            }
        }
    } else {
        null
    }
    LaunchedEffect(player, playing) {
        if (playing) player?.play() else player?.pause()
    }
    player?.let { activePlayer ->
        DisposableEffect(activePlayer) {
            onDispose { activePlayer.release() }
        }
        LifecycleEventEffect(Lifecycle.Event.ON_STOP) { activePlayer.pause() }
    }
    if (failed) {
        FileAttachmentCard(
            attachment = attachment,
            author = author,
            timeLabel = timeLabel,
            onClick = onFileClick,
            onShare = onFileShare,
        )
        return
    }
    val ratio = ((attachment.width ?: 16).toFloat() / (attachment.height ?: 9).toFloat())
        .coerceIn(0.6f, 1.8f)
    val spoken = stringResource(R.string.video_attachment_accessibility, author, attachment.name, timeLabel)
    Box(
        modifier = modifier
            .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
            .aspectRatio(ratio)
            .clip(RoundedCornerShape(FishTheme.radii.chat))
            .background(FishTheme.colors.surfaceAlt)
            .semantics { contentDescription = spoken },
        contentAlignment = Alignment.Center,
    ) {
        if (player != null) PlayerSurface(player = player, modifier = Modifier.fillMaxSize())
        FishIconButton(
            icon = if (playing) FishIcons.Pause else FishIcons.Play,
            contentDescription = stringResource(
                if (playing) R.string.pause_video else R.string.play_video,
            ),
            onClick = onTogglePlayback,
            enabled = attachment.available,
            variant = if (playing) FishIconButtonVariant.Filled else FishIconButtonVariant.Quiet,
            size = FishTheme.sizes.primaryControl,
        )
    }
}
