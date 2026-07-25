package space.fishhub.android.feature.call.views

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.call.CallMediaEngine
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.CallVideoSource
import space.fishhub.android.feature.call.R
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun CallVideoStage(
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
