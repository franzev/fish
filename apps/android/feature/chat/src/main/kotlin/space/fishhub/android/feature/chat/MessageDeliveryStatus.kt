package space.fishhub.android.feature.chat

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun MessageDeliveryStatus(
    status: MessageDeliveryUiState,
    modifier: Modifier = Modifier,
) {
    Text(
        text = status.localizedLabel(),
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (status == MessageDeliveryUiState.Failed) {
            FishTheme.colors.notice
        } else {
            FishTheme.colors.muted
        },
        style = FishTheme.typography.caption,
    )
}

@Composable
private fun MessageDeliveryUiState.localizedLabel(): String = stringResource(
    when (this) {
        MessageDeliveryUiState.Sending -> R.string.status_sending
        MessageDeliveryUiState.Sent -> R.string.status_sent
        MessageDeliveryUiState.Delivered -> R.string.status_delivered
        MessageDeliveryUiState.Read -> R.string.status_read
        MessageDeliveryUiState.Failed -> R.string.status_failed
    },
)
