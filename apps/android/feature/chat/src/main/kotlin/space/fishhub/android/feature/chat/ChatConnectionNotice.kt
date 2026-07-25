package space.fishhub.android.feature.chat

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishNoticeTone

@Composable
fun ChatConnectionNotice(state: ChatConnectionUiState, modifier: Modifier = Modifier) {
    when (state) {
        ChatConnectionUiState.Connected -> Unit
        ChatConnectionUiState.Connecting -> FishNotice(
            message = stringResource(R.string.connecting),
            modifier = modifier,
        )
        ChatConnectionUiState.Reconnecting -> FishNotice(
            message = stringResource(R.string.reconnecting),
            modifier = modifier,
        )
        ChatConnectionUiState.Offline -> FishNotice(
            message = stringResource(R.string.offline),
            modifier = modifier,
            tone = FishNoticeTone.Warning,
        )
    }
}
