package space.fishhub.android.feature.settings.views

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.feature.settings.R

@Composable
internal fun AccountSettingsHeader(
    title: String,
    showBack: Boolean,
    onBack: () -> Unit,
    onClose: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.primaryControl),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showBack) FishIconButton(FishIcons.ArrowBack, stringResource(R.string.back), onBack)
        Text(
            text = title,
            modifier = Modifier
                .weight(1f)
                .padding(start = if (showBack) FishTheme.spacing.xs else FishTheme.spacing.twoXs),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.heading,
        )
        FishIconButton(FishIcons.Close, stringResource(R.string.close), onClose)
    }
}
