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
internal fun PresenceVisibilityPage(
    selected: AccountSettingsPresenceVisibility,
    enabled: Boolean,
    onSelected: (AccountSettingsPresenceVisibility) -> Unit,
) {
    val choices = listOf(
        AccountSettingsPresenceVisibility.Automatic to R.string.presence_automatic_explanation,
        AccountSettingsPresenceVisibility.Away to R.string.presence_away_explanation,
        AccountSettingsPresenceVisibility.Busy to R.string.presence_busy_explanation,
        AccountSettingsPresenceVisibility.Invisible to R.string.presence_invisible_explanation,
    )
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        choices.forEach { (visibility, explanation) ->
            SettingsRow(
                label = visibility.label(),
                explanation = stringResource(explanation),
                selected = selected == visibility,
                enabled = enabled,
                role = Role.RadioButton,
                leadingIcon = visibility.icon(),
                onClick = { onSelected(visibility) },
            )
        }
    }
}
