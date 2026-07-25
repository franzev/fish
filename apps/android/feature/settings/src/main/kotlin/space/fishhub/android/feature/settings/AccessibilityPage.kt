package space.fishhub.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import space.fishhub.android.core.designsystem.FishTheme

@Composable
internal fun AccessibilityPage(
    selected: AccountSettingsMotion,
    onSelected: (AccountSettingsMotion) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        SettingsRow(
            label = stringResource(R.string.system),
            explanation = stringResource(R.string.system_motion_description),
            selected = selected == AccountSettingsMotion.System,
            role = Role.RadioButton,
            onClick = { onSelected(AccountSettingsMotion.System) },
        )
        SettingsRow(
            label = stringResource(R.string.reduce_motion),
            selected = selected == AccountSettingsMotion.ReduceMotion,
            role = Role.RadioButton,
            onClick = { onSelected(AccountSettingsMotion.ReduceMotion) },
        )
    }
}
