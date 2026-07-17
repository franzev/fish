package space.fishhub.android.feature.presence

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.data.presence.PresenceDuration
import space.fishhub.android.data.presence.PresenceConnectionState
import space.fishhub.android.data.presence.PresencePreference

private enum class AccountSheetPage { Account, Status, Duration }

private data class StatusChoice(
    val preference: PresencePreference,
    val label: String,
    val explanation: String,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PresenceAccountSheet(
    displayName: String,
    state: PresenceUiState,
    onDismiss: () -> Unit,
    onSetPreference: (PresencePreference, PresenceDuration) -> Unit,
    onSignOut: () -> Unit,
    onClearNotice: () -> Unit,
) {
    var page by remember { mutableStateOf(AccountSheetPage.Account) }
    var pendingPreference by remember { mutableStateOf<PresencePreference?>(null) }
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
            SheetHeader(
                title = when (page) {
                    AccountSheetPage.Account -> stringResource(R.string.presence_account)
                    AccountSheetPage.Status -> stringResource(R.string.presence_status)
                    AccountSheetPage.Duration -> stringResource(R.string.presence_duration_title)
                },
                showBack = page != AccountSheetPage.Account,
                onBack = {
                    onClearNotice()
                    page = when (page) {
                        AccountSheetPage.Duration -> AccountSheetPage.Status
                        else -> AccountSheetPage.Account
                    }
                },
                onClose = onDismiss,
            )
            if (state.updating) {
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
            if (state.connection == PresenceConnectionState.Connecting ||
                state.connection == PresenceConnectionState.Disconnected
            ) {
                FishNotice(
                    message = stringResource(R.string.presence_reconnecting),
                    modifier = Modifier.padding(bottom = FishTheme.spacing.md),
                )
            }
            state.notice?.let { message ->
                FishNotice(
                    message = message,
                    modifier = Modifier
                        .padding(bottom = FishTheme.spacing.md)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            when (page) {
                AccountSheetPage.Account -> AccountPage(
                    displayName = displayName,
                    presence = state.own,
                    updating = state.updating,
                    onStatus = { page = AccountSheetPage.Status },
                    onSignOut = onSignOut,
                )
                AccountSheetPage.Status -> StatusPage(
                    selectedPreference = state.ownPreference,
                    enabled = !state.updating,
                    onSelected = { preference ->
                        onClearNotice()
                        if (preference == PresencePreference.Automatic) {
                            onSetPreference(preference, PresenceDuration.Forever)
                        } else {
                            pendingPreference = preference
                            page = AccountSheetPage.Duration
                        }
                    },
                )
                AccountSheetPage.Duration -> DurationPage(
                    enabled = !state.updating,
                    onSelected = { duration ->
                        pendingPreference?.let { onSetPreference(it, duration) }
                    },
                )
            }
        }
    }
}

@Composable
private fun SheetHeader(
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
        if (showBack) {
            FishIconButton(FishIcons.ArrowBack, "Back", onClick = onBack)
        }
        Text(
            text = title,
            modifier = Modifier
                .weight(1f)
                .padding(start = if (showBack) FishTheme.spacing.xs else FishTheme.spacing.twoXs),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.heading,
        )
        FishIconButton(FishIcons.Close, "Close", onClick = onClose)
    }
}

@Composable
private fun AccountPage(
    displayName: String,
    presence: PresencePresentation,
    updating: Boolean,
    onStatus: () -> Unit,
    onSignOut: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PresenceAvatar(
            name = displayName,
            presence = presence,
            size = FishTheme.sizes.avatarMedium,
        )
        Spacer(Modifier.width(FishTheme.spacing.sm))
        Column {
            Text(displayName, color = FishTheme.colors.foreground, style = FishTheme.typography.label)
            Text(presence.label, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
        }
    }
    SheetRow(
        label = stringResource(R.string.presence_status),
        explanation = presence.label,
        enabled = !updating,
        onClick = onStatus,
    ) {
        PresenceIndicator(
            status = presence.status,
            label = presence.label,
            decorative = true,
            modifier = Modifier.size(FishTheme.sizes.presenceIndicatorSmall),
        )
    }
    FishButton(
        label = stringResource(R.string.presence_sign_out),
        onClick = onSignOut,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = FishTheme.spacing.lg),
        variant = FishButtonVariant.Ghost,
        enabled = !updating,
    )
}

@Composable
private fun StatusPage(
    selectedPreference: PresencePreference,
    enabled: Boolean,
    onSelected: (PresencePreference) -> Unit,
) {
    val choices = listOf(
        StatusChoice(
            PresencePreference.Automatic,
            stringResource(R.string.presence_automatic),
            stringResource(R.string.presence_automatic_explanation),
        ),
        StatusChoice(
            PresencePreference.Away,
            stringResource(R.string.presence_away),
            stringResource(R.string.presence_away_explanation),
        ),
        StatusChoice(
            PresencePreference.Busy,
            stringResource(R.string.presence_busy),
            stringResource(R.string.presence_busy_explanation),
        ),
        StatusChoice(
            PresencePreference.Invisible,
            stringResource(R.string.presence_invisible),
            stringResource(R.string.presence_invisible_explanation),
        ),
    )
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        choices.forEach { choice ->
            PreferenceRow(
                choice = choice,
                selected = selectedPreference == choice.preference,
                enabled = enabled,
                onClick = { onSelected(choice.preference) },
            )
        }
    }
}

@Composable
private fun PreferenceRow(
    choice: StatusChoice,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val displayStatus = when (choice.preference) {
        PresencePreference.Automatic -> space.fishhub.android.data.presence.PresenceDisplayStatus.Online
        PresencePreference.Away -> space.fishhub.android.data.presence.PresenceDisplayStatus.Away
        PresencePreference.Busy -> space.fishhub.android.data.presence.PresenceDisplayStatus.Busy
        PresencePreference.Invisible -> space.fishhub.android.data.presence.PresenceDisplayStatus.Invisible
    }
    SheetRow(
        label = choice.label,
        explanation = choice.explanation,
        selected = selected,
        enabled = enabled,
        role = Role.RadioButton,
        onClick = onClick,
    ) {
        PresenceIndicator(
            status = displayStatus,
            label = choice.label,
            decorative = true,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
        )
    }
}

@Composable
private fun DurationPage(
    enabled: Boolean,
    onSelected: (PresenceDuration) -> Unit,
) {
    val choices = listOf(
        PresenceDuration.FifteenMinutes to stringResource(R.string.presence_duration_fifteen_minutes),
        PresenceDuration.OneHour to stringResource(R.string.presence_duration_one_hour),
        PresenceDuration.EightHours to stringResource(R.string.presence_duration_eight_hours),
        PresenceDuration.OneDay to stringResource(R.string.presence_duration_one_day),
        PresenceDuration.ThreeDays to stringResource(R.string.presence_duration_three_days),
        PresenceDuration.Forever to stringResource(R.string.presence_duration_forever),
    )
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        choices.forEach { (duration, label) ->
            SheetRow(label = label, enabled = enabled, onClick = { onSelected(duration) })
        }
    }
}

@Composable
private fun SheetRow(
    label: String,
    modifier: Modifier = Modifier,
    explanation: String? = null,
    selected: Boolean = false,
    enabled: Boolean = true,
    role: Role = Role.Button,
    onClick: () -> Unit,
    leading: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(FishTheme.radii.control)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.primaryControl)
            .background(
                if (selected) FishTheme.colors.selected else FishTheme.colors.surfaceAlt,
                shape,
            )
            .clickable(enabled = enabled, role = role, onClick = onClick)
            .semantics {
                this.selected = selected
                contentDescription = listOfNotNull(label, explanation).joinToString(", ")
            }
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        if (leading != null) Spacer(Modifier.width(FishTheme.spacing.sm))
        Column(Modifier.weight(1f)) {
            Text(label, color = FishTheme.colors.foreground, style = FishTheme.typography.label)
            explanation?.let {
                Text(it, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
            }
        }
        if (selected) {
            Icon(
                imageVector = FishIcons.Check,
                contentDescription = null,
                tint = FishTheme.colors.foreground,
                modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            )
        }
    }
}

@Composable
internal fun PresenceAccountSheetPreviewContent(
    page: String,
    state: PresenceUiState,
    displayName: String = "Franz",
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FishTheme.colors.surface)
            .padding(FishTheme.spacing.page),
    ) {
        SheetHeader(
            title = when (page) {
                "status" -> stringResource(R.string.presence_status)
                "duration" -> stringResource(R.string.presence_duration_title)
                else -> stringResource(R.string.presence_account)
            },
            showBack = page != "account",
            onBack = {},
            onClose = {},
        )
        if (state.connection == PresenceConnectionState.Connecting ||
            state.connection == PresenceConnectionState.Disconnected
        ) {
            FishNotice(
                message = stringResource(R.string.presence_reconnecting),
                modifier = Modifier.padding(bottom = FishTheme.spacing.md),
            )
        }
        when (page) {
            "status" -> StatusPage(state.ownPreference, !state.updating, {})
            "duration" -> DurationPage(!state.updating, {})
            else -> AccountPage(displayName, state.own, state.updating, {}, {})
        }
    }
}
