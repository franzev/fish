package space.fishhub.android.feature.call.views

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.feature.call.R
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun CallControls(
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
