package space.fishhub.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton

@Composable
internal fun NotificationsPage(
    status: AccountSettingsNotificationStatus,
    canRequest: Boolean,
    onAllow: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md)) {
        Text(
            text = if (status == AccountSettingsNotificationStatus.On) {
                stringResource(R.string.notifications_available)
            } else {
                stringResource(R.string.notifications_unavailable)
            },
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
        )
        Text(
            text = stringResource(R.string.notification_permission_description),
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
        )
        Text(
            text = stringResource(R.string.call_notification_description),
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
        )
        FishButton(
            label = if (canRequest) stringResource(R.string.allow_notifications)
            else stringResource(R.string.open_notification_settings),
            onClick = if (canRequest) onAllow else onOpenSettings,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
