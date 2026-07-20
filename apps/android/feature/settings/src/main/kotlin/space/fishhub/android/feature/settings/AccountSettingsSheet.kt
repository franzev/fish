package space.fishhub.android.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
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
private fun AccountSettingsHeader(
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

@Composable
private fun AccountPage(
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

@Composable
private fun NotificationsPage(
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

@Composable
private fun PrivacyPage(
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

@Composable
private fun BlockedPeoplePage(
    state: AccountSettingsBlockedPeopleState,
    onRetry: () -> Unit,
    onUnblock: (String) -> Unit,
) {
    when (state) {
        AccountSettingsBlockedPeopleState.Hidden,
        AccountSettingsBlockedPeopleState.Loading,
        -> Text(
            text = stringResource(R.string.blocked_people_loading),
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = FishTheme.spacing.md),
        )
        is AccountSettingsBlockedPeopleState.Failed -> Column(
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            FishNotice(message = state.message)
            FishButton(
                label = stringResource(R.string.try_again),
                onClick = onRetry,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        is AccountSettingsBlockedPeopleState.Loaded -> {
            state.notice?.let { message ->
                FishNotice(
                    message = message,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = FishTheme.spacing.md)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            if (state.people.isEmpty()) {
                Text(
                    text = stringResource(R.string.blocked_people_empty),
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.body,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = FishTheme.spacing.md),
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
                    state.people.forEach { person ->
                        SettingsRow(
                            label = person.displayName,
                            explanation = person.username?.let { "@$it" },
                            trailing = if (person.userId in state.busyIds) {
                                stringResource(R.string.unblocking)
                            } else {
                                stringResource(R.string.unblock)
                            },
                            enabled = person.userId !in state.busyIds,
                            onClick = { onUnblock(person.userId) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PresenceVisibilityPage(
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

@Composable
private fun AppearancePage(
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

@Composable
private fun AccessibilityPage(
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

@Composable
private fun SettingsRow(
    label: String,
    modifier: Modifier = Modifier,
    explanation: String? = null,
    trailing: String? = null,
    selected: Boolean = false,
    enabled: Boolean = true,
    role: Role = Role.Button,
    leadingIcon: ImageVector? = null,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(FishTheme.radii.control)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
            .background(
                if (selected) FishTheme.colors.selected else FishTheme.colors.surfaceAlt,
                shape,
            )
            .clickable(enabled = enabled, role = role, onClick = onClick)
            .semantics {
                this.selected = selected
                contentDescription = listOfNotNull(label, explanation, trailing).joinToString(", ")
            }
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.let {
            Icon(
                imageVector = it,
                contentDescription = null,
                tint = FishTheme.colors.body,
                modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            )
            Spacer(Modifier.width(FishTheme.spacing.sm))
        }
        Column(Modifier.weight(1f)) {
            Text(label, color = FishTheme.colors.foreground, style = FishTheme.typography.label)
            explanation?.let {
                Text(it, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
            }
        }
        trailing?.let {
            Text(it, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
        }
        if (selected) {
            Icon(
                imageVector = FishIcons.Check,
                contentDescription = null,
                tint = FishTheme.colors.foreground,
                modifier = Modifier
                    .padding(start = FishTheme.spacing.sm)
                    .size(FishTheme.sizes.iconGlyph),
            )
        }
    }
}

@Composable
private fun AccountSettingsNotificationStatus.label(): String = when (this) {
    AccountSettingsNotificationStatus.On -> stringResource(R.string.notifications_on)
    AccountSettingsNotificationStatus.Off -> stringResource(R.string.notifications_off)
}

@Composable
private fun AccountSettingsTheme.label(): String = when (this) {
    AccountSettingsTheme.System -> stringResource(R.string.system)
    AccountSettingsTheme.Light -> stringResource(R.string.light)
    AccountSettingsTheme.Dark -> stringResource(R.string.dark)
}

@Composable
private fun AccountSettingsMotion.label(): String = when (this) {
    AccountSettingsMotion.System -> stringResource(R.string.system)
    AccountSettingsMotion.ReduceMotion -> stringResource(R.string.reduce_motion)
}

@Composable
private fun AccountSettingsPresenceVisibility.label(): String = when (this) {
    AccountSettingsPresenceVisibility.Automatic -> stringResource(R.string.presence_automatic)
    AccountSettingsPresenceVisibility.Away -> stringResource(R.string.presence_away)
    AccountSettingsPresenceVisibility.Busy -> stringResource(R.string.presence_busy)
    AccountSettingsPresenceVisibility.Invisible -> stringResource(R.string.presence_invisible)
}

private fun AccountSettingsPresenceVisibility.icon(): ImageVector = when (this) {
    AccountSettingsPresenceVisibility.Automatic -> FishIcons.CircleFilled
    AccountSettingsPresenceVisibility.Away -> FishIcons.Clock
    AccountSettingsPresenceVisibility.Busy -> FishIcons.CircleMinus
    AccountSettingsPresenceVisibility.Invisible -> FishIcons.EyeOff
}

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
                accessibility = AccountSettingsMotion.System,
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
