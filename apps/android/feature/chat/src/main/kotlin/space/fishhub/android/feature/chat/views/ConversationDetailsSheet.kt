package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import coil3.compose.rememberAsyncImagePainter
import kotlinx.coroutines.flow.first
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.data.chat.ConversationMute
import space.fishhub.android.data.chat.ConversationQuietPeriod
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.model.ParticipantUiModel
import space.fishhub.android.feature.presence.PresenceAvatar
import space.fishhub.android.feature.presence.PresencePresentation

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationDetailsSheet(
    participant: ParticipantUiModel,
    presence: PresencePresentation,
    onDismiss: () -> Unit,
    onOpenSharedContent: () -> Unit = {},
    onRemoveFriend: () -> Unit,
    onBlock: () -> Unit,
    onReport: () -> Unit,
    mute: ConversationMute = ConversationMute.On,
    onSetQuiet: (ConversationQuietPeriod?) -> Unit = {},
    sharedContentModifier: Modifier = Modifier,
    requestSharedContentFocus: Boolean = false,
) {
    var confirmation by remember(participant.id) { mutableStateOf<SafetyConfirmation?>(null) }
    var quietOptionsShown by remember(participant.id) { mutableStateOf(false) }
    val avatarPainter = participant.avatarUrl?.let { rememberAsyncImagePainter(it) }
    val sharedContentFocus = remember(participant.id) { FocusRequester() }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    LaunchedEffect(Unit) {
        if (requestSharedContentFocus) {
            snapshotFlow { sheetState.currentValue }
                .first { it == SheetValue.Expanded }
            withFrameNanos { }
            sharedContentFocus.requestFocus()
        }
    }
    FishModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(FishTheme.colors.surface)
                .padding(FishTheme.spacing.page),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(R.string.participant_details),
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.heading,
                )
                FishIconButton(
                    icon = FishIcons.Close,
                    contentDescription = stringResource(R.string.close_participant_details),
                    onClick = onDismiss,
                )
            }
            PresenceAvatar(
                name = participant.displayName,
                presence = presence,
                image = avatarPainter,
                size = FishTheme.sizes.avatarLarge,
            )
            Text(
                text = participant.displayName,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.heading,
            )
            participant.username?.let { username ->
                Text(
                    text = "@$username",
                    color = FishTheme.colors.muted,
                    style = FishTheme.typography.ui,
                )
            }
            Text(
                text = presence.label,
                color = FishTheme.colors.body,
                style = FishTheme.typography.ui,
            )
            Text(
                text = participant.contextLabel,
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
            )
            Row(
                modifier = Modifier
                    .then(sharedContentModifier)
                    .focusRequester(sharedContentFocus)
                    .focusable()
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
                    .clickable(
                        role = Role.Button,
                        onClick = onOpenSharedContent,
                    )
                    .padding(horizontal = FishTheme.spacing.md),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
            ) {
                Icon(
                    imageVector = FishIcons.Gallery,
                    contentDescription = null,
                    modifier = Modifier.size(FishTheme.sizes.iconGlyph),
                    tint = FishTheme.colors.foreground,
                )
                Text(
                    text = stringResource(R.string.shared_content),
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.ui,
                )
                Spacer(modifier = Modifier.size(FishTheme.spacing.twoXs))
                Text(
                    text = if (
                        androidx.compose.ui.platform.LocalLayoutDirection.current ==
                        androidx.compose.ui.unit.LayoutDirection.Ltr
                    ) {
                        "›"
                    } else {
                        "‹"
                    },
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.heading,
                )
            }
            ConversationQuietRow(
                mute = mute,
                optionsShown = quietOptionsShown,
                onToggleOptions = { quietOptionsShown = !quietOptionsShown },
                onSelect = { period ->
                    quietOptionsShown = false
                    onSetQuiet(period)
                },
            )
            if (participant.friendSafetyAvailable) {
                ConversationSafetySection(
                    displayName = participant.displayName,
                    confirmation = confirmation,
                    onConfirmationChange = { confirmation = it },
                    onRemoveFriend = {
                        onDismiss()
                        onRemoveFriend()
                    },
                    onBlock = {
                        onDismiss()
                        onBlock()
                    },
                    onReport = {
                        onDismiss()
                        onReport()
                    },
                )
            }
        }
    }
}
