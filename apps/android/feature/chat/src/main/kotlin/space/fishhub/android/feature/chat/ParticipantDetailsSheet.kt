package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
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
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishModalBottomSheet
import space.fishhub.android.feature.presence.PresenceAvatar
import space.fishhub.android.feature.presence.PresencePresentation

private enum class SafetyConfirmation { Remove, Block }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParticipantDetailsSheet(
    participant: ParticipantUiModel,
    presence: PresencePresentation,
    onDismiss: () -> Unit,
    onOpenSharedContent: () -> Unit = {},
    onRemoveFriend: () -> Unit,
    onBlock: () -> Unit,
    sharedContentModifier: Modifier = Modifier,
    requestSharedContentFocus: Boolean = false,
) {
    var confirmation by remember(participant.id) { mutableStateOf<SafetyConfirmation?>(null) }
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
            if (participant.friendSafetyAvailable) {
                when (confirmation) {
                    null -> {
                        FishButton(
                            label = stringResource(R.string.unfriend),
                            onClick = { confirmation = SafetyConfirmation.Remove },
                            modifier = Modifier.fillMaxWidth(),
                            variant = FishButtonVariant.Secondary,
                        )
                        FishButton(
                            label = stringResource(R.string.block_participant, participant.displayName),
                            onClick = { confirmation = SafetyConfirmation.Block },
                            modifier = Modifier.fillMaxWidth(),
                            variant = FishButtonVariant.Ghost,
                        )
                    }
                    SafetyConfirmation.Remove -> SafetyConfirmationContent(
                        message = stringResource(
                            R.string.unfriend_confirmation,
                            participant.displayName,
                        ),
                        confirmLabel = stringResource(R.string.unfriend),
                        onConfirm = {
                            onDismiss()
                            onRemoveFriend()
                        },
                        onBack = { confirmation = null },
                    )
                    SafetyConfirmation.Block -> SafetyConfirmationContent(
                        message = stringResource(
                            R.string.block_confirmation,
                            participant.displayName,
                        ),
                        confirmLabel = stringResource(R.string.block),
                        onConfirm = {
                            onDismiss()
                            onBlock()
                        },
                        onBack = { confirmation = null },
                    )
                }
            }
        }
    }
}

@Composable
private fun SafetyConfirmationContent(
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onBack: () -> Unit,
) {
    Text(
        text = message,
        modifier = Modifier.fillMaxWidth(),
        color = FishTheme.colors.body,
        style = FishTheme.typography.body,
    )
    FishButton(
        label = confirmLabel,
        onClick = onConfirm,
        modifier = Modifier.fillMaxWidth(),
        variant = FishButtonVariant.Secondary,
    )
    FishButton(
        label = stringResource(R.string.back),
        onClick = onBack,
        modifier = Modifier.fillMaxWidth(),
        variant = FishButtonVariant.Ghost,
    )
}
