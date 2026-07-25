package space.fishhub.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.core.designsystem.component.FishNotice

private enum class AccountSettingsPage {
    Account,
    Notifications,
    Privacy,
    BlockedPeople,
    PresenceVisibility,
    PresenceDuration,
    Appearance,
    Accessibility,
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSettingsSheet(
    displayName: String,
    presence: AccountSettingsPresence,
    notificationStatus: AccountSettingsNotificationStatus = AccountSettingsNotificationStatus.Off,
    canRequestNotifications: Boolean = false,
    appearance: AccountSettingsTheme = AccountSettingsTheme.System,
    accessibility: AccountSettingsMotion = AccountSettingsMotion.System,
    canManageBlockedPeople: Boolean = false,
    notice: String? = null,
    onDismiss: () -> Unit,
    onSetPresence: (AccountSettingsPresenceVisibility, AccountSettingsPresenceDuration) -> Unit,
    onClearPresenceNotice: () -> Unit,
    onOpenNotifications: () -> Unit = {},
    onAllowNotifications: () -> Unit = {},
    blockedPeopleState: AccountSettingsBlockedPeopleState = AccountSettingsBlockedPeopleState.Hidden,
    onLoadBlockedPeople: () -> Unit = {},
    onUnblockBlockedPerson: (String) -> Unit = {},
    onOpenPrivacyPolicy: () -> Unit = {},
    onAppearanceSelected: (AccountSettingsTheme) -> Unit = {},
    onAccessibilitySelected: (AccountSettingsMotion) -> Unit = {},
    onResetPassword: () -> Unit = {},
    onClearNotice: () -> Unit = {},
    onSignOut: () -> Unit,
) {
    var page by remember { mutableStateOf(AccountSettingsPage.Account) }
    var pendingVisibility by remember { mutableStateOf<AccountSettingsPresenceVisibility?>(null) }

    fun goBack() {
        onClearPresenceNotice()
        onClearNotice()
        page = when (page) {
            AccountSettingsPage.PresenceDuration -> AccountSettingsPage.PresenceVisibility
            AccountSettingsPage.PresenceVisibility -> AccountSettingsPage.Privacy
            AccountSettingsPage.BlockedPeople -> AccountSettingsPage.Privacy
            else -> AccountSettingsPage.Account
        }
    }

    LaunchedEffect(page) {
        if (page == AccountSettingsPage.BlockedPeople) onLoadBlockedPeople()
    }

    FishModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = FishTheme.sizes.chatContentMax)
                .verticalScroll(rememberScrollState())
                .padding(
                    start = FishTheme.spacing.page,
                    end = FishTheme.spacing.page,
                    bottom = FishTheme.spacing.lg,
                ),
        ) {
            AccountSettingsHeader(
                title = when (page) {
                    AccountSettingsPage.Account -> stringResource(R.string.account_settings)
                    AccountSettingsPage.Notifications -> stringResource(R.string.notifications)
                    AccountSettingsPage.Privacy -> stringResource(R.string.privacy)
                    AccountSettingsPage.BlockedPeople -> stringResource(R.string.blocked_people)
                    AccountSettingsPage.PresenceVisibility -> stringResource(R.string.presence_visibility)
                    AccountSettingsPage.PresenceDuration -> stringResource(R.string.presence_duration_title)
                    AccountSettingsPage.Appearance -> stringResource(R.string.appearance)
                    AccountSettingsPage.Accessibility -> stringResource(R.string.accessibility)
                },
                showBack = page != AccountSettingsPage.Account,
                onBack = ::goBack,
                onClose = onDismiss,
            )
            if (presence.updating) {
                Text(
                    text = stringResource(R.string.presence_updating),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = FishTheme.spacing.sm)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                    color = FishTheme.colors.notice,
                    style = FishTheme.typography.ui,
                )
            }
            if (presence.reconnecting) {
                FishNotice(
                    message = stringResource(R.string.presence_reconnecting),
                    modifier = Modifier.padding(bottom = FishTheme.spacing.md),
                )
            }
            notice?.let { message ->
                FishNotice(
                    message = message,
                    modifier = Modifier
                        .padding(bottom = FishTheme.spacing.md)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            presence.notice?.let { message ->
                FishNotice(
                    message = message,
                    modifier = Modifier
                        .padding(bottom = FishTheme.spacing.md)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            when (page) {
                AccountSettingsPage.Account -> AccountPage(
                    displayName = displayName,
                    presence = presence,
                    notificationStatus = notificationStatus,
                    appearance = appearance,
                    accessibility = accessibility,
                    onNotifications = { page = AccountSettingsPage.Notifications },
                    onPrivacy = { page = AccountSettingsPage.Privacy },
                    onAppearance = { page = AccountSettingsPage.Appearance },
                    onAccessibility = { page = AccountSettingsPage.Accessibility },
                    onResetPassword = onResetPassword,
                    onSignOut = onSignOut,
                )
                AccountSettingsPage.Notifications -> NotificationsPage(
                    status = notificationStatus,
                    canRequest = canRequestNotifications,
                    onAllow = onAllowNotifications,
                    onOpenSettings = onOpenNotifications,
                )
                AccountSettingsPage.Privacy -> PrivacyPage(
                    canManageBlockedPeople = canManageBlockedPeople,
                    onPresence = { page = AccountSettingsPage.PresenceVisibility },
                    onBlockedPeople = {
                        onClearNotice()
                        page = AccountSettingsPage.BlockedPeople
                    },
                    onPrivacyPolicy = onOpenPrivacyPolicy,
                    onNotifications = { page = AccountSettingsPage.Notifications },
                )
                AccountSettingsPage.BlockedPeople -> BlockedPeoplePage(
                    state = blockedPeopleState,
                    onRetry = onLoadBlockedPeople,
                    onUnblock = onUnblockBlockedPerson,
                )
                AccountSettingsPage.PresenceVisibility -> PresenceVisibilityPage(
                    selected = presence.visibility,
                    enabled = !presence.updating,
                    onSelected = { visibility ->
                        onClearPresenceNotice()
                        if (visibility == AccountSettingsPresenceVisibility.Automatic) {
                            onSetPresence(visibility, AccountSettingsPresenceDuration.Forever)
                        } else {
                            pendingVisibility = visibility
                            page = AccountSettingsPage.PresenceDuration
                        }
                    },
                )
                AccountSettingsPage.PresenceDuration -> PresenceDurationPage(
                    enabled = !presence.updating,
                    onSelected = { duration ->
                        pendingVisibility?.let { onSetPresence(it, duration) }
                    },
                )
                AccountSettingsPage.Appearance -> AppearancePage(
                    selected = appearance,
                    onSelected = onAppearanceSelected,
                )
                AccountSettingsPage.Accessibility -> AccessibilityPage(
                    selected = accessibility,
                    onSelected = onAccessibilitySelected,
                )
            }
        }
    }
}

@Composable
private fun PresenceDurationPage(
    enabled: Boolean,
    onSelected: (AccountSettingsPresenceDuration) -> Unit,
) {
    val choices = listOf(
        AccountSettingsPresenceDuration.FifteenMinutes to R.string.presence_duration_fifteen_minutes,
        AccountSettingsPresenceDuration.OneHour to R.string.presence_duration_one_hour,
        AccountSettingsPresenceDuration.EightHours to R.string.presence_duration_eight_hours,
        AccountSettingsPresenceDuration.OneDay to R.string.presence_duration_one_day,
        AccountSettingsPresenceDuration.ThreeDays to R.string.presence_duration_three_days,
        AccountSettingsPresenceDuration.Forever to R.string.presence_duration_forever,
    )
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        choices.forEach { (duration, label) ->
            SettingsRow(
                label = stringResource(label),
                enabled = enabled,
                onClick = { onSelected(duration) },
            )
        }
    }
}
