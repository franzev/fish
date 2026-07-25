package space.fishhub.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import space.fishhub.android.core.designsystem.FishTheme

@Composable
internal fun AppearancePage(
    selected: AccountSettingsTheme,
    onSelected: (AccountSettingsTheme) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        AccountSettingsTheme.entries.forEach { theme ->
            SettingsRow(
                label = theme.label(),
                selected = selected == theme,
                role = Role.RadioButton,
                onClick = { onSelected(theme) },
            )
        }
    }
}
