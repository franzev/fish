package space.fishhub.android.feature.settings.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.feature.settings.R
import space.fishhub.android.feature.settings.logic.label
import space.fishhub.android.feature.settings.model.AccountSettingsMotion
import space.fishhub.android.feature.settings.model.AccountSettingsNotificationStatus
import space.fishhub.android.feature.settings.model.AccountSettingsPresence
import space.fishhub.android.feature.settings.model.AccountSettingsTheme

@Composable
internal fun AccountPage(
    displayName: String,
    presence: AccountSettingsPresence,
    notificationStatus: AccountSettingsNotificationStatus,
    appearance: AccountSettingsTheme,
    accessibility: AccountSettingsMotion,
    onNotifications: () -> Unit,
    onPrivacy: () -> Unit,
    onAppearance: () -> Unit,
    onAccessibility: () -> Unit,
    onResetPassword: () -> Unit,
    onSignOut: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(FishTheme.sizes.avatarMedium)
                .background(FishTheme.colors.avatar, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = displayName.firstOrNull()?.uppercase() ?: "?",
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.label,
            )
        }
        Spacer(Modifier.width(FishTheme.spacing.sm))
        Column {
            Text(displayName, color = FishTheme.colors.foreground, style = FishTheme.typography.label)
            Text(presence.label, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
        }
    }
    SettingsRow(
        label = stringResource(R.string.notifications),
        trailing = notificationStatus.label(),
        onClick = onNotifications,
    )
    SettingsRow(
        label = stringResource(R.string.privacy),
        explanation = stringResource(R.string.privacy_supporting_copy),
        onClick = onPrivacy,
    )
    SettingsRow(
        label = stringResource(R.string.appearance),
        trailing = appearance.label(),
        onClick = onAppearance,
    )
    SettingsRow(
        label = stringResource(R.string.accessibility),
        trailing = accessibility.label(),
        onClick = onAccessibility,
    )
    SettingsRow(
        label = stringResource(R.string.reset_password),
        explanation = stringResource(R.string.reset_password_supporting_copy),
        onClick = onResetPassword,
    )
    FishButton(
        label = stringResource(R.string.sign_out),
        onClick = onSignOut,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = FishTheme.spacing.lg),
        variant = FishButtonVariant.Ghost,
        enabled = !presence.updating,
    )
}
