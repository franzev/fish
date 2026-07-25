package space.fishhub.android.feature.call.views

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.feature.call.R
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun CallActivityPanel(call: CallSessionState, media: CallMediaState) {
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
