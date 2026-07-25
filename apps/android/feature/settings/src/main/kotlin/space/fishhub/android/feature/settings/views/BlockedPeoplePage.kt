package space.fishhub.android.feature.settings.views

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.feature.settings.R
import space.fishhub.android.feature.settings.logic.label
import space.fishhub.android.feature.settings.model.AccountSettingsBlockedPeopleState

@Composable
internal fun BlockedPeoplePage(
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
