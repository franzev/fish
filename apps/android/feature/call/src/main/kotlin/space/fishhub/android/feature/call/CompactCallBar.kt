package space.fishhub.android.feature.call

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishIconButton
import space.fishhub.android.core.designsystem.component.FishIconButtonVariant
import space.fishhub.android.feature.call.state.CallSessionState

@Composable
internal fun CompactCallBar(
    call: CallSessionState,
    busy: Boolean,
    onReturn: () -> Unit,
    onEnd: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .navigationBarsPadding()
            .padding(FishTheme.spacing.page),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Surface(
            color = FishTheme.colors.surface,
            shape = RoundedCornerShape(FishTheme.radii.card),
            border = androidx.compose.foundation.BorderStroke(
                FishTheme.spacing.threeXs,
                FishTheme.colors.divider,
            ),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(FishTheme.spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = call.counterpartName ?: stringResource(R.string.call_partner_default),
                        color = FishTheme.colors.foreground,
                        style = FishTheme.typography.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = callCopy(call).first,
                        color = FishTheme.colors.body,
                        style = FishTheme.typography.caption,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                FishButton(
                    label = stringResource(R.string.call_return),
                    onClick = onReturn,
                    variant = FishButtonVariant.Secondary,
                )
                FishIconButton(
                    icon = FishIcons.PhoneOff,
                    contentDescription = stringResource(R.string.call_end),
                    onClick = onEnd,
                    enabled = !busy,
                    variant = FishIconButtonVariant.Critical,
                )
            }
        }
    }
}
