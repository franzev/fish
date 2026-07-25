package space.fishhub.android.feature.chat.sharedcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.feature.chat.R

@Composable
fun SharedContentGalleryNotice(
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    actionLoading: Boolean = false,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
    ) {
        FishNotice(message = message)
        if (actionLabel != null && onAction != null) {
            FishButton(
                label = actionLabel,
                onClick = onAction,
                variant = FishButtonVariant.Ghost,
                loading = actionLoading,
                loadingDescription = stringResource(R.string.shared_content_loading),
            )
        }
    }
}
