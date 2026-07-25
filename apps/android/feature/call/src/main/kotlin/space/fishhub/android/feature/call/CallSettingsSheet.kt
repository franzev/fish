package space.fishhub.android.feature.call

import androidx.compose.foundation.background
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun CallSettingsSheet(
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
