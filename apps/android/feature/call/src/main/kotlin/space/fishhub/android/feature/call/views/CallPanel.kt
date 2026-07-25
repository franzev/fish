package space.fishhub.android.feature.call.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.CallAudioEndpoint
import space.fishhub.android.feature.call.R
import space.fishhub.android.feature.call.logic.callCopy
import space.fishhub.android.feature.call.state.CallFailureReason
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun CallPanel(
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
            CallActivityPanel(call, mediaState)
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
                CallSettingsSheet(
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
