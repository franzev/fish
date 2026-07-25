package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.feature.chat.R

@Composable
fun SharedContentGalleryEmpty(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    retryAllowed: Boolean = false,
    retryBusy: Boolean = false,
    onRetry: (() -> Unit)? = null,
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        FishEmptyState(
            title = title,
            description = description,
            action = if (retryAllowed && onRetry != null) {
                {
                    FishButton(
                        label = stringResource(R.string.shared_content_try_again),
                        onClick = onRetry,
                        variant = FishButtonVariant.Ghost,
                        loading = retryBusy,
                        loadingDescription = stringResource(R.string.shared_content_loading),
                    )
                }
            } else {
                null
            },
        )
    }
}
