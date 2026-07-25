package space.fishhub.android.feature.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishIcons

@Composable
internal fun AccountSettingsNotificationStatus.label(): String = when (this) {
    AccountSettingsNotificationStatus.On -> stringResource(R.string.notifications_on)
    AccountSettingsNotificationStatus.Off -> stringResource(R.string.notifications_off)
}

@Composable
internal fun AccountSettingsTheme.label(): String = when (this) {
    AccountSettingsTheme.System -> stringResource(R.string.system)
    AccountSettingsTheme.Light -> stringResource(R.string.light)
    AccountSettingsTheme.Dark -> stringResource(R.string.dark)
}

@Composable
internal fun AccountSettingsMotion.label(): String = when (this) {
    AccountSettingsMotion.System -> stringResource(R.string.system)
    AccountSettingsMotion.ReduceMotion -> stringResource(R.string.reduce_motion)
}

@Composable
internal fun AccountSettingsPresenceVisibility.label(): String = when (this) {
    AccountSettingsPresenceVisibility.Automatic -> stringResource(R.string.presence_automatic)
    AccountSettingsPresenceVisibility.Away -> stringResource(R.string.presence_away)
    AccountSettingsPresenceVisibility.Busy -> stringResource(R.string.presence_busy)
    AccountSettingsPresenceVisibility.Invisible -> stringResource(R.string.presence_invisible)
}

internal fun AccountSettingsPresenceVisibility.icon(): ImageVector = when (this) {
    AccountSettingsPresenceVisibility.Automatic -> FishIcons.CircleFilled
    AccountSettingsPresenceVisibility.Away -> FishIcons.Clock
    AccountSettingsPresenceVisibility.Busy -> FishIcons.CircleMinus
    AccountSettingsPresenceVisibility.Invisible -> FishIcons.EyeOff
}
