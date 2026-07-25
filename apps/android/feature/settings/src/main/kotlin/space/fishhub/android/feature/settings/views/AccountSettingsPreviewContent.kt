package space.fishhub.android.feature.settings.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.settings.R
import space.fishhub.android.feature.settings.logic.label
import space.fishhub.android.feature.settings.model.AccountSettingsBlockedPeopleState
import space.fishhub.android.feature.settings.model.AccountSettingsBlockedPerson
import space.fishhub.android.feature.settings.model.AccountSettingsMotion
import space.fishhub.android.feature.settings.model.AccountSettingsNotificationStatus
import space.fishhub.android.feature.settings.model.AccountSettingsPresence
import space.fishhub.android.feature.settings.model.AccountSettingsPresenceStatus
import space.fishhub.android.feature.settings.model.AccountSettingsPresenceVisibility
import space.fishhub.android.feature.settings.model.AccountSettingsTheme

@Composable
internal fun AccountSettingsPreviewContent(
    page: String = "account",
    displayName: String = "Franz",
    presence: AccountSettingsPresence = AccountSettingsPresence(
        status = AccountSettingsPresenceStatus.Away,
        label = "Away",
        visibility = AccountSettingsPresenceVisibility.Away,
        reconnecting = page == "account",
    ),
) {
    val title = when (page) {
        "notifications" -> stringResource(R.string.notifications)
        "privacy" -> stringResource(R.string.privacy)
        "blocked" -> stringResource(R.string.blocked_people)
        "presence" -> stringResource(R.string.presence_visibility)
        "appearance" -> stringResource(R.string.appearance)
        "accessibility" -> stringResource(R.string.accessibility)
        else -> stringResource(R.string.account_settings)
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surface)
            .padding(FishTheme.spacing.page),
    ) {
        AccountSettingsHeader(title, showBack = page != "account", onBack = {}, onClose = {})
        when (page) {
            "notifications" -> NotificationsPage(AccountSettingsNotificationStatus.Off, false, {}, {})
            "privacy" -> PrivacyPage(false, {}, {}, {}, {})
            "blocked" -> BlockedPeoplePage(
                AccountSettingsBlockedPeopleState.Loaded(
                    people = listOf(AccountSettingsBlockedPerson("blocked-1", "Sam", "sam")),
                ),
                {},
                {},
            )
            "presence" -> PresenceVisibilityPage(presence.visibility, true, {})
            "appearance" -> AppearancePage(AccountSettingsTheme.System, {})
            "accessibility" -> AccessibilityPage(AccountSettingsMotion.System, {})
            else -> AccountPage(
                displayName = displayName,
                presence = presence,
                notificationStatus = AccountSettingsNotificationStatus.Off,
                appearance = AccountSettingsTheme.System,
                motion = AccountSettingsMotion.System,
                onNotifications = {},
                onPrivacy = {},
                onAppearance = {},
                onAccessibility = {},
                onResetPassword = {},
                onSignOut = {},
            )
        }
    }
}
