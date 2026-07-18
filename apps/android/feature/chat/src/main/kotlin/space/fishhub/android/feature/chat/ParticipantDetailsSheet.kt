package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import coil3.compose.rememberAsyncImagePainter
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
    onRemoveFriend: () -> Unit,
    onBlock: () -> Unit,
) {
    var confirmation by remember(participant.id) { mutableStateOf<SafetyConfirmation?>(null) }
    val avatarPainter = participant.avatarUrl?.let { rememberAsyncImagePainter(it) }
    FishModalBottomSheet(onDismissRequest = onDismiss) {
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
