package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import java.time.Instant
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.chat.ConversationMute
import space.fishhub.android.data.chat.ConversationQuietPeriod
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.logic.ConversationQuietCopy
import space.fishhub.android.feature.chat.logic.ConversationQuietValue

/**
 * One row carrying a conversation's notification state, expanding in place
 * rather than opening another destination: quiet is a small preference, not a
 * screen. The row holds no state of its own so every combination can be
 * rendered and compared directly.
 */
@Composable
fun ConversationQuietRow(
    mute: ConversationMute,
    optionsShown: Boolean,
    onToggleOptions: () -> Unit,
    onSelect: (ConversationQuietPeriod?) -> Unit,
    modifier: Modifier = Modifier,
    now: Instant = Instant.now(),
) {
    val label = stringResource(R.string.notifications)
    val value = when (val state = ConversationQuietCopy.value(mute, now)) {
        ConversationQuietValue.On -> stringResource(R.string.notifications_on)
        ConversationQuietValue.UntilTurnedBackOn ->
            stringResource(R.string.quiet_until_turned_back_on)
        is ConversationQuietValue.Until -> stringResource(R.string.quiet_until, state.moment)
    }
    val quiet = mute.isQuietAt(now)

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = FishTheme.colors.surface,
                    shape = RoundedCornerShape(FishTheme.radii.control),
                )
                .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
                .clickable(role = Role.Button, onClick = onToggleOptions)
                .padding(horizontal = FishTheme.spacing.md)
                .semantics {
                    contentDescription = label
                    stateDescription = value
                },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
        ) {
            Icon(
                // The glyph tracks the state so a quiet conversation never
                // carries a sound-is-on icon.
                imageVector = if (quiet) FishIcons.Moon else FishIcons.Speaker,
                contentDescription = null,
                modifier = Modifier.size(FishTheme.sizes.iconGlyph),
                tint = FishTheme.colors.body,
            )
            Text(
                text = label,
                modifier = Modifier.weight(1f),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.ui,
            )
            Text(
                text = value,
                color = FishTheme.colors.body,
                style = FishTheme.typography.caption,
                textAlign = TextAlign.End,
            )
        }
        if (optionsShown) {
            // Only offered while something is silenced, so the way back is
            // never a no-op sitting above the quiet periods.
            if (quiet) {
                QuietOption(stringResource(R.string.turn_on_notifications), null, onSelect)
            }
            ConversationQuietPeriod.entries.forEach { period ->
                QuietOption(stringResource(period.labelRes), period, onSelect)
            }
        }
    }
}

@Composable
private fun QuietOption(
    label: String,
    period: ConversationQuietPeriod?,
    onSelect: (ConversationQuietPeriod?) -> Unit,
) {
    Text(
        text = label,
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = FishTheme.colors.surfaceAlt,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
            .clickable(role = Role.Button) { onSelect(period) }
            .padding(
                horizontal = FishTheme.spacing.md,
                vertical = FishTheme.spacing.sm,
            ),
        color = FishTheme.colors.foreground,
        style = FishTheme.typography.ui,
    )
}

private val ConversationQuietPeriod.labelRes: Int
    get() = when (this) {
        ConversationQuietPeriod.OneHour -> R.string.quiet_for_one_hour
        ConversationQuietPeriod.EightHours -> R.string.quiet_for_eight_hours
        ConversationQuietPeriod.OneDay -> R.string.quiet_for_one_day
        ConversationQuietPeriod.UntilTurnedBackOn -> R.string.quiet_until_i_turn_it_back_on
    }
