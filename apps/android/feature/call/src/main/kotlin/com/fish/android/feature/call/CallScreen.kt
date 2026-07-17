@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.fish.android.feature.call

import android.view.View
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import com.fish.android.core.designsystem.FishIcons
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.core.designsystem.component.FishButton
import com.fish.android.core.designsystem.component.FishButtonVariant
import com.fish.android.core.designsystem.component.FishIconButton
import com.fish.android.core.designsystem.component.FishIconButtonVariant
import com.fish.android.core.designsystem.component.FishNotice
import com.fish.android.data.call.CallDirection
import com.fish.android.data.call.CallKind
import com.fish.android.data.call.CallMediaEngine
import com.fish.android.data.call.CallMediaState
import com.fish.android.data.call.CallVideoSource
import com.fish.android.data.call.VideoQualityPreference
import com.fish.android.feature.call.state.CallFailureReason
import com.fish.android.feature.call.state.CallLifecycleStatus
import com.fish.android.feature.call.state.CallSessionState

@Composable
fun CallScreen(
    call: CallSessionState,
    mediaState: CallMediaState,
    notice: String?,
    busy: Boolean,
    qualityPreference: VideoQualityPreference,
    audioEndpoints: List<CallAudioEndpoint>,
    mediaEngine: CallMediaEngine?,
    onAnswer: () -> Unit,
    onDecline: () -> Unit,
    onCancel: () -> Unit,
    onEnd: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onSelectAudioEndpoint: (String) -> Unit,
    onQualityPreference: (VideoQualityPreference) -> Unit,
    onOpenMessages: () -> Unit,
    onClear: () -> Unit,
    onOpenAppSettings: () -> Unit,
    pictureInPicture: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val inProgress = call.status in setOf(
        CallLifecycleStatus.Connecting,
        CallLifecycleStatus.Active,
        CallLifecycleStatus.Reconnecting,
    )
    val videoStage = call.kind == CallKind.Video && inProgress
    if (pictureInPicture && videoStage) {
        VideoStage(
            call = call,
            mediaState = mediaState,
            mediaEngine = mediaEngine,
            modifier = modifier.fillMaxSize(),
        )
        return
    }
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
    ) {
        if (videoStage) {
            VideoStage(
                call = call,
                mediaState = mediaState,
                mediaEngine = mediaEngine,
                modifier = Modifier.weight(1f),
            )
        } else {
            Spacer(Modifier.weight(1f))
        }
        CallPanel(
            call = call,
            mediaState = mediaState,
            notice = notice,
            busy = busy,
            qualityPreference = qualityPreference,
            audioEndpoints = audioEndpoints,
            videoStage = videoStage,
            onAnswer = onAnswer,
            onDecline = onDecline,
            onCancel = onCancel,
            onEnd = onEnd,
            onToggleMute = onToggleMute,
            onToggleCamera = onToggleCamera,
            onSwitchCamera = onSwitchCamera,
            onSelectAudioEndpoint = onSelectAudioEndpoint,
            onQualityPreference = onQualityPreference,
            onOpenMessages = onOpenMessages,
            onClear = onClear,
            onOpenAppSettings = onOpenAppSettings,
        )
        if (!videoStage) Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun CallPanel(
    call: CallSessionState,
    mediaState: CallMediaState,
    notice: String?,
    busy: Boolean,
    qualityPreference: VideoQualityPreference,
    audioEndpoints: List<CallAudioEndpoint>,
    videoStage: Boolean,
    onAnswer: () -> Unit,
    onDecline: () -> Unit,
    onCancel: () -> Unit,
    onEnd: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onSelectAudioEndpoint: (String) -> Unit,
    onQualityPreference: (VideoQualityPreference) -> Unit,
    onOpenMessages: () -> Unit,
    onClear: () -> Unit,
    onOpenAppSettings: () -> Unit,
) {
    val incoming = call.status == CallLifecycleStatus.Ringing &&
        call.direction == CallDirection.Incoming
    val outgoing = call.status == CallLifecycleStatus.Ringing &&
        call.direction == CallDirection.Outgoing
    val inProgress = call.status in setOf(
        CallLifecycleStatus.Connecting,
        CallLifecycleStatus.Active,
        CallLifecycleStatus.Reconnecting,
    )
    val terminal = call.status in setOf(
        CallLifecycleStatus.Ended,
        CallLifecycleStatus.Rejected,
        CallLifecycleStatus.Cancelled,
        CallLifecycleStatus.Missed,
        CallLifecycleStatus.Failed,
    )
    var settingsOpen by remember(call.callId) { mutableStateOf(false) }
    val copy = callCopy(call)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surface)
            .padding(if (incoming || outgoing) FishTheme.spacing.page else FishTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(
            if (incoming || outgoing) FishTheme.spacing.lg else FishTheme.spacing.md,
        ),
    ) {
        if (!videoStage) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (!incoming && !outgoing) {
                    Surface(
                        shape = RoundedCornerShape(FishTheme.radii.pill),
                        color = FishTheme.colors.surfaceAlt,
                    ) {
                        Box(
                            modifier = Modifier.padding(FishTheme.spacing.sm),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = if (call.kind == CallKind.Video) {
                                    FishIcons.Video
                                } else {
                                    FishIcons.Phone
                                },
                                contentDescription = null,
                                tint = FishTheme.colors.foreground,
                            )
                        }
                    }
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .semantics {
                            heading()
                            liveRegion = if (incoming) {
                                LiveRegionMode.Assertive
                            } else {
                                LiveRegionMode.Polite
                            }
                        },
                    verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
                ) {
                    Text(
                        text = copy.first,
                        color = FishTheme.colors.foreground,
                        style = if (incoming || outgoing) {
                            FishTheme.typography.heading
                        } else {
                            FishTheme.typography.label
                        },
                    )
                    Text(
                        text = copy.second,
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.body,
                    )
                }
            }
        }

        if (call.kind == CallKind.Audio && call.status in setOf(
                CallLifecycleStatus.Active,
                CallLifecycleStatus.Reconnecting,
            )
        ) {
            AudioActivity(call, mediaState)
        }

        if (notice != null) FishNotice(message = notice)
        if (call.failureReason == CallFailureReason.PermissionDenied) {
            FishNotice(message = stringResource(R.string.call_permission_notice))
            FishButton(
                label = stringResource(R.string.call_permission_settings),
                onClick = onOpenAppSettings,
                variant = FishButtonVariant.Secondary,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        when {
            incoming -> Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                FishButton(
                    label = stringResource(R.string.call_decline),
                    onClick = onDecline,
                    enabled = !busy,
                    loading = busy,
                    variant = FishButtonVariant.Secondary,
                    modifier = Modifier.weight(1f),
                )
                FishButton(
                    label = stringResource(R.string.call_answer),
                    onClick = onAnswer,
                    enabled = !busy,
                    loading = busy,
                    modifier = Modifier.weight(1f),
                )
            }
            outgoing -> FishButton(
                label = stringResource(R.string.call_cancel),
                onClick = onCancel,
                enabled = !busy,
                loading = busy,
                variant = FishButtonVariant.Secondary,
            )
            terminal -> FishButton(
                label = stringResource(R.string.call_back_to_messages),
                onClick = onClear,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (inProgress) {
            CallControls(
                call = call,
                busy = busy,
                settingsOpen = settingsOpen,
                onToggleMute = onToggleMute,
                onToggleCamera = onToggleCamera,
                onSwitchCamera = onSwitchCamera,
                onOpenMessages = onOpenMessages,
                onToggleSettings = { settingsOpen = !settingsOpen },
                onEnd = onEnd,
            )
            if (settingsOpen) {
                CallSettings(
                    call = call,
                    qualityPreference = qualityPreference,
                    audioEndpoints = audioEndpoints,
                    onSelectAudioEndpoint = onSelectAudioEndpoint,
                    onQualityPreference = onQualityPreference,
                )
            }
        }
    }
}

@Composable
private fun VideoStage(
    call: CallSessionState,
    mediaState: CallMediaState,
    mediaEngine: CallMediaEngine?,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surfaceAlt),
    ) {
        if (mediaState.remoteCameraEnabled && mediaEngine != null) {
            CallVideoView(
                mediaEngine = mediaEngine,
                source = CallVideoSource.Remote,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    imageVector = FishIcons.VideoOff,
                    contentDescription = null,
                    tint = FishTheme.colors.body,
                )
                Text(
                    text = stringResource(
                        R.string.call_camera_is_off,
                        call.counterpartName ?: stringResource(R.string.call_partner_default),
                    ),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.body,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(FishTheme.spacing.md),
                )
            }
        }
        if (call.cameraEnabled && mediaEngine != null) {
            CallVideoView(
                mediaEngine = mediaEngine,
                source = CallVideoSource.Local,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(FishTheme.spacing.sm)
                    .fillMaxWidth(0.28f)
                    .aspectRatio(0.75f)
                    .clip(RoundedCornerShape(FishTheme.radii.card))
                    .border(
                        FishTheme.spacing.threeXs,
                        FishTheme.colors.borderStrong,
                        RoundedCornerShape(FishTheme.radii.card),
                    ),
            )
        }
        if (mediaState.remoteMuted) {
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(FishTheme.spacing.sm),
                shape = RoundedCornerShape(FishTheme.radii.pill),
                color = FishTheme.colors.background,
            ) {
                Row(
                    modifier = Modifier.padding(
                        horizontal = FishTheme.spacing.sm,
                        vertical = FishTheme.spacing.xs,
                    ),
                    horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = FishIcons.MicrophoneOff,
                        contentDescription = null,
                        tint = FishTheme.colors.body,
                    )
                    Text(
                        text = stringResource(
                            R.string.call_partner_is_muted,
                            call.counterpartName ?: stringResource(R.string.call_partner_default),
                        ),
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.caption,
                    )
                }
            }
        }
    }
}

@Composable
private fun CallVideoView(
    mediaEngine: CallMediaEngine,
    source: CallVideoSource,
    modifier: Modifier,
) {
    AndroidView(
        factory = { mediaEngine.createVideoView(it, source) },
        modifier = modifier,
        onRelease = { view: View -> mediaEngine.releaseVideoView(view) },
    )
}

@Composable
private fun AudioActivity(call: CallSessionState, media: CallMediaState) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.threeXs),
    ) {
        ActivityCell(
            label = stringResource(R.string.call_your_activity),
            status = when {
                call.muted -> stringResource(R.string.call_muted)
                media.localSpeaking -> stringResource(R.string.call_voice_detected)
                else -> stringResource(R.string.call_listening)
            },
            icon = if (call.muted) FishIcons.MicrophoneOff else FishIcons.Microphone,
            speaking = media.localSpeaking && !call.muted,
            modifier = Modifier.weight(1f),
        )
        ActivityCell(
            label = call.counterpartName ?: stringResource(R.string.call_partner_default),
            status = when {
                media.remoteMuted -> stringResource(R.string.call_muted)
                media.remoteSpeaking -> stringResource(R.string.call_speaking)
                else -> stringResource(R.string.call_listening)
            },
            icon = if (media.remoteMuted) FishIcons.MicrophoneOff else FishIcons.Microphone,
            speaking = media.remoteSpeaking && !media.remoteMuted,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ActivityCell(
    label: String,
    status: String,
    icon: ImageVector,
    speaking: Boolean,
    modifier: Modifier,
) {
    Row(
        modifier = modifier
            .background(
                FishTheme.colors.surfaceAlt,
                RoundedCornerShape(FishTheme.radii.control),
            )
            .padding(FishTheme.spacing.sm),
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (speaking) FishTheme.colors.success else FishTheme.colors.muted,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = status,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun CallControls(
    call: CallSessionState,
    busy: Boolean,
    settingsOpen: Boolean,
    onToggleMute: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onOpenMessages: () -> Unit,
    onToggleSettings: () -> Unit,
    onEnd: () -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(
            FishTheme.spacing.xs,
            Alignment.CenterHorizontally,
        ),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        maxItemsInEachRow = 6,
    ) {
        FishIconButton(
            icon = if (call.muted) FishIcons.MicrophoneOff else FishIcons.Microphone,
            contentDescription = stringResource(if (call.muted) R.string.call_unmute else R.string.call_mute),
            onClick = onToggleMute,
            selected = call.muted,
        )
        if (call.kind == CallKind.Video) {
            FishIconButton(
                icon = if (call.cameraEnabled) FishIcons.Video else FishIcons.VideoOff,
                contentDescription = stringResource(
                    if (call.cameraEnabled) R.string.call_camera_off else R.string.call_camera_on,
                ),
                onClick = onToggleCamera,
                selected = !call.cameraEnabled,
            )
            if (call.cameraEnabled) {
                FishIconButton(
                    icon = FishIcons.SwitchCamera,
                    contentDescription = stringResource(R.string.call_switch_camera),
                    onClick = onSwitchCamera,
                )
            }
        }
        FishIconButton(
            icon = FishIcons.Messages,
            contentDescription = stringResource(R.string.call_messages),
            onClick = onOpenMessages,
        )
        FishIconButton(
            icon = FishIcons.Settings,
            contentDescription = stringResource(R.string.call_settings),
            onClick = onToggleSettings,
            selected = settingsOpen,
        )
        FishIconButton(
            icon = FishIcons.PhoneOff,
            contentDescription = stringResource(R.string.call_end),
            onClick = onEnd,
            enabled = !busy,
            variant = FishIconButtonVariant.Critical,
        )
    }
}

@Composable
private fun CallSettings(
    call: CallSessionState,
    qualityPreference: VideoQualityPreference,
    audioEndpoints: List<CallAudioEndpoint>,
    onSelectAudioEndpoint: (String) -> Unit,
    onQualityPreference: (VideoQualityPreference) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                FishTheme.colors.surfaceAlt,
                RoundedCornerShape(FishTheme.radii.control),
            )
            .padding(FishTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
    ) {
        if (audioEndpoints.isNotEmpty()) {
            Text(
                text = stringResource(R.string.call_audio_route),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.label,
            )
            audioEndpoints.forEach { endpoint ->
                FishButton(
                    label = endpoint.label,
                    onClick = { onSelectAudioEndpoint(endpoint.id) },
                    variant = FishButtonVariant.Secondary,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !endpoint.selected,
                )
            }
        }
        if (call.kind == CallKind.Video) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .toggleable(
                        value = qualityPreference == VideoQualityPreference.DataSaver,
                        role = Role.Switch,
                        onValueChange = { enabled ->
                            onQualityPreference(
                                if (enabled) VideoQualityPreference.DataSaver
                                else VideoQualityPreference.Auto,
                            )
                        },
                    ),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.call_use_less_data),
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.body,
                    )
                    Text(
                        text = stringResource(R.string.call_use_less_data_description),
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.caption,
                    )
                }
                Switch(
                    checked = qualityPreference == VideoQualityPreference.DataSaver,
                    onCheckedChange = null,
                )
            }
        }
    }
}

@Composable
internal fun CompactCallBar(
    call: CallSessionState,
    busy: Boolean,
    onReturn: () -> Unit,
    onEnd: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .navigationBarsPadding()
            .padding(FishTheme.spacing.page),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Surface(
            color = FishTheme.colors.surface,
            shape = RoundedCornerShape(FishTheme.radii.card),
            border = androidx.compose.foundation.BorderStroke(
                FishTheme.spacing.threeXs,
                FishTheme.colors.divider,
            ),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(FishTheme.spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = call.counterpartName ?: stringResource(R.string.call_partner_default),
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = callCopy(call).first,
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.caption,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                FishButton(
                    label = stringResource(R.string.call_return),
                    onClick = onReturn,
                    variant = FishButtonVariant.Secondary,
                )
                FishIconButton(
                    icon = FishIcons.PhoneOff,
                    contentDescription = stringResource(R.string.call_end),
                    onClick = onEnd,
                    enabled = !busy,
                    variant = FishIconButtonVariant.Critical,
                )
            }
        }
    }
}

@Composable
private fun callCopy(call: CallSessionState): Pair<String, String> {
    val name = call.counterpartName ?: stringResource(R.string.call_partner_default)
    return when (call.status) {
        CallLifecycleStatus.RequestingPermission -> stringResource(R.string.call_preparing, name) to
            stringResource(R.string.call_preparing_status)
        CallLifecycleStatus.Ringing -> if (call.direction == CallDirection.Incoming) {
            stringResource(R.string.call_incoming, name) to stringResource(
                if (call.kind == CallKind.Video) R.string.call_incoming_video_status
                else R.string.call_incoming_audio_status,
            )
        } else {
            stringResource(R.string.call_outgoing, name) to stringResource(
                if (call.kind == CallKind.Video) R.string.call_outgoing_video_status
                else R.string.call_outgoing_audio_status,
            )
        }
        CallLifecycleStatus.Connecting -> stringResource(R.string.call_connecting, name) to
            stringResource(R.string.call_connecting_status)
        CallLifecycleStatus.Reconnecting -> stringResource(R.string.call_reconnecting, name) to
            stringResource(R.string.call_reconnecting_status)
        CallLifecycleStatus.Active -> stringResource(R.string.call_active, name) to stringResource(
            if (call.muted) R.string.call_microphone_muted else R.string.call_microphone_on,
        )
        CallLifecycleStatus.Missed -> if (call.direction == CallDirection.Outgoing) {
            stringResource(R.string.call_no_answer) to
                stringResource(R.string.call_no_answer_status, name)
        } else {
            stringResource(R.string.call_missed) to
                stringResource(R.string.call_missed_status, name)
        }
        CallLifecycleStatus.Rejected -> stringResource(R.string.call_declined) to
            stringResource(R.string.call_messages_available)
        CallLifecycleStatus.Cancelled -> stringResource(R.string.call_cancelled) to
            stringResource(R.string.call_messages_available)
        CallLifecycleStatus.Failed -> stringResource(R.string.call_failed) to
            stringResource(R.string.call_messages_available)
        else -> stringResource(R.string.call_ended) to
            stringResource(R.string.call_messages_available)
    }
}
