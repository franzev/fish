package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishProgress
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableLongStateOf

@Composable
fun MessageVoicePlayer(
    attachment: AttachmentUiModel,
    author: String,
    timeLabel: String,
    playing: Boolean,
    onTogglePlayback: () -> Unit,
    onPlaybackError: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val source = attachment.displayUrl
    if (source == null) {
        Box(
            modifier = modifier
                .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
                .clip(RoundedCornerShape(FishTheme.radii.chat))
                .background(FishTheme.colors.surfaceAlt)
                .padding(FishTheme.spacing.md),
        ) {
            Text(
                text = stringResource(R.string.voice_message),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        }
        return
    }
    var durationMs by remember(source) { mutableLongStateOf(0L) }
    var positionMs by remember(source) { mutableLongStateOf(0L) }
    var endedNotified by remember(source) { mutableStateOf(false) }
    val context = LocalContext.current
    var speed by remember(context) {
        mutableStateOf(VoicePlaybackSpeed.persisted(context))
    }
    var menuExpanded by remember(source) { mutableStateOf(false) }
    val player = if (playing) {
        remember(source) {
            ExoPlayer.Builder(context).build().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                        .build(),
                    true,
                )
                setMediaItem(MediaItem.fromUri(source.toMediaUri()))
                addListener(object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        onPlaybackError()
                    }
                })
                prepare()
            }
        }
    } else {
        null
    }
    LaunchedEffect(player) {
        if (player == null) return@LaunchedEffect
        while (isActive) {
            durationMs = player.duration.takeIf { it > 0 } ?: durationMs
            positionMs = player.currentPosition.coerceAtLeast(0L)
            if (player.playbackState == Player.STATE_ENDED && !endedNotified) {
                endedNotified = true
                onTogglePlayback()
            }
            delay(250)
        }
    }
    LaunchedEffect(player, playing) {
        if (playing) {
            endedNotified = false
            if (player?.playbackState == Player.STATE_ENDED) player.seekTo(0)
            player?.play()
        } else {
            player?.pause()
        }
    }
    LaunchedEffect(player, speed) {
        player?.setPlaybackSpeed(speed.multiplier)
    }
    player?.let { activePlayer ->
        DisposableEffect(activePlayer) {
            onDispose { activePlayer.release() }
        }
        LifecycleEventEffect(Lifecycle.Event.ON_STOP) { activePlayer.pause() }
    }
    val durationLabel = if (durationMs > 0) formatVoiceDuration(durationMs) else "--:--"
    val spoken = stringResource(
        R.string.voice_message_accessibility,
        author,
        durationLabel,
        timeLabel,
    )
    val playbackSpeedDescription = stringResource(R.string.voice_playback_speed)
    Column(
        modifier = modifier
            .fillMaxWidth(FishTheme.layout.messageMaxWidthFraction)
            .clip(RoundedCornerShape(FishTheme.radii.chat))
            .background(FishTheme.colors.surfaceAlt)
            .padding(horizontal = FishTheme.spacing.sm, vertical = FishTheme.spacing.xs)
            .semantics { contentDescription = spoken },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FishIconButton(
                icon = if (playing) FishIcons.Pause else FishIcons.Play,
                contentDescription = stringResource(
                    if (playing) R.string.pause_voice_message else R.string.play_voice_message,
                ),
                onClick = onTogglePlayback,
                enabled = attachment.available,
                variant = if (playing) FishIconButtonVariant.Filled else FishIconButtonVariant.Quiet,
                size = FishTheme.sizes.touchTarget,
            )
            Text(
                text = if (playing || durationMs > 0) {
                    "${formatVoiceDuration(positionMs)} / $durationLabel"
                } else {
                    stringResource(R.string.voice_message)
                },
                modifier = Modifier.weight(1f),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.label,
            )
            Box {
                FishButton(
                    label = speed.label,
                    onClick = { menuExpanded = true },
                    variant = FishButtonVariant.Ghost,
                    modifier = Modifier
                        .heightIn(min = FishTheme.sizes.touchTarget)
                        .semantics {
                            contentDescription = playbackSpeedDescription
                            stateDescription = speed.accessibilityLabel
                        },
                )
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    VoicePlaybackSpeed.entries.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = {
                                speed = option
                                VoicePlaybackSpeed.persist(context, option)
                                menuExpanded = false
                            },
                            leadingIcon = if (option == speed) {
                                { androidx.compose.material3.Icon(FishIcons.Check, contentDescription = null) }
                            } else null,
                        )
                    }
                }
            }
        }
        if (durationMs > 0) {
            FishProgress(
                progress = positionMs.toFloat() / durationMs.toFloat(),
                contentDescription = spoken,
                modifier = Modifier.padding(horizontal = FishTheme.spacing.xs),
            )
        }
    }
}

private fun formatVoiceDuration(milliseconds: Long): String {
    val totalSeconds = (milliseconds / 1_000L).coerceAtLeast(0L)
    return "%02d:%02d".format(totalSeconds / 60L, totalSeconds % 60L)
}
