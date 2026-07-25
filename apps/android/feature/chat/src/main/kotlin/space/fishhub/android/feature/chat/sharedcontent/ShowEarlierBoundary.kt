package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.feature.chat.R

@Composable
fun ShowEarlierBoundary(
    state: SharedContentEarlierState,
    onShowEarlier: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.lg),
        contentAlignment = Alignment.Center,
    ) {
        when (state) {
            SharedContentEarlierState.Hidden -> Unit
            SharedContentEarlierState.Ready -> FishButton(
                label = stringResource(R.string.shared_content_show_earlier),
                onClick = onShowEarlier,
                variant = FishButtonVariant.Ghost,
            )
            SharedContentEarlierState.Loading -> FishButton(
                label = stringResource(R.string.shared_content_show_earlier),
                onClick = onShowEarlier,
                variant = FishButtonVariant.Ghost,
                loading = true,
                loadingDescription = stringResource(R.string.shared_content_loading_earlier),
            )
            SharedContentEarlierState.Failed -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                Text(
                    text = stringResource(R.string.shared_content_earlier_failed),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.caption,
                )
                FishButton(
                    label = stringResource(R.string.shared_content_try_again),
                    onClick = onShowEarlier,
                    variant = FishButtonVariant.Ghost,
                )
            }
            SharedContentEarlierState.Offline -> Text(
                text = stringResource(R.string.shared_content_connect_for_more),
                color = FishTheme.colors.body,
                style = FishTheme.typography.caption,
            )
        }
    }
}
