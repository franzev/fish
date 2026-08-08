package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.feature.chat.R

internal enum class SafetyConfirmation { Remove, Block, Report }

/** Extracted so screenshot tests can render every safety state without the sheet. */
@Composable
internal fun ConversationSafetySection(
    displayName: String,
    confirmation: SafetyConfirmation?,
    onConfirmationChange: (SafetyConfirmation?) -> Unit,
    onRemoveFriend: () -> Unit,
    onBlock: () -> Unit,
    onReport: () -> Unit,
) {
    when (confirmation) {
        null -> {
            FishButton(
                label = stringResource(R.string.unfriend),
                onClick = { onConfirmationChange(SafetyConfirmation.Remove) },
                modifier = Modifier.fillMaxWidth(),
                variant = FishButtonVariant.Secondary,
            )
            FishButton(
                label = stringResource(R.string.block_participant, displayName),
                onClick = { onConfirmationChange(SafetyConfirmation.Block) },
                modifier = Modifier.fillMaxWidth(),
                variant = FishButtonVariant.Ghost,
            )
            FishButton(
                label = stringResource(R.string.report_participant, displayName),
                onClick = { onConfirmationChange(SafetyConfirmation.Report) },
                modifier = Modifier.fillMaxWidth(),
                variant = FishButtonVariant.Ghost,
            )
        }
        SafetyConfirmation.Remove -> SafetyConfirmationContent(
            message = stringResource(R.string.unfriend_confirmation, displayName),
            confirmLabel = stringResource(R.string.unfriend),
            onConfirm = onRemoveFriend,
            onBack = { onConfirmationChange(null) },
        )
        SafetyConfirmation.Block -> SafetyConfirmationContent(
            message = stringResource(R.string.block_confirmation, displayName),
            confirmLabel = stringResource(R.string.block),
            onConfirm = onBlock,
            onBack = { onConfirmationChange(null) },
        )
        SafetyConfirmation.Report -> SafetyConfirmationContent(
            message = stringResource(R.string.report_confirmation, displayName),
            confirmLabel = stringResource(R.string.report),
            onConfirm = onReport,
            onBack = { onConfirmationChange(null) },
        )
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
