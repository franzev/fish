package space.fishhub.android.feature.settings.views

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.settings.R
import space.fishhub.android.feature.settings.logic.label

@Composable
internal fun PrivacyPage(
    canManageBlockedPeople: Boolean,
    onPresence: () -> Unit,
    onBlockedPeople: () -> Unit,
    onPrivacyPolicy: () -> Unit,
    onNotifications: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        SettingsRow(label = stringResource(R.string.presence_visibility), onClick = onPresence)
        if (canManageBlockedPeople) {
            SettingsRow(label = stringResource(R.string.blocked_people), onClick = onBlockedPeople)
        }
        SettingsRow(label = stringResource(R.string.privacy_policy), onClick = onPrivacyPolicy)
        SettingsRow(
            label = stringResource(R.string.notifications),
            explanation = stringResource(R.string.notification_permission_description),
            onClick = onNotifications,
        )
    }
}
