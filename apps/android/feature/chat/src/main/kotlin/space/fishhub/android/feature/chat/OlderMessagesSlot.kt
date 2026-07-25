package space.fishhub.android.feature.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishSkeleton

@Composable
fun OlderMessagesSlot(
    state: OlderMessagesUiState,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(FishTheme.sizes.paginationSlot),
        contentAlignment = Alignment.Center,
    ) {
        when (state) {
            OlderMessagesUiState.Idle -> Unit
            OlderMessagesUiState.Loading -> Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                FishSkeleton()
                FishSkeleton(width = FishTheme.sizes.conversationRail)
            }
            OlderMessagesUiState.Failed -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
            ) {
                Text(
                    text = stringResource(R.string.earlier_failed),
                    color = FishTheme.colors.body,
                    textAlign = TextAlign.Center,
                    style = FishTheme.typography.caption,
                )
                FishButton(
                    label = stringResource(R.string.retry_earlier),
                    onClick = onRetry,
                    variant = FishButtonVariant.Secondary,
                )
            }
        }
    }
}
