package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.selected
import space.fishhub.android.core.designsystem.FishTheme

@Composable
internal fun ReactionPill(
    reaction: ReactionUiModel,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ReactionPillTarget(
        description = description,
        selected = reaction.byMe,
        enabled = enabled,
        onClick = onClick,
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(FishTheme.radii.pill))
                .background(
                    if (reaction.byMe) FishTheme.colors.interactiveActive
                    else FishTheme.colors.surfaceAlt,
                )
                .padding(
                    horizontal = FishTheme.spacing.xs,
                    vertical = FishTheme.spacing.twoXs,
                ),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = reaction.emoji, style = FishTheme.typography.ui)
            Text(
                text = reaction.count.toString(),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.label,
            )
        }
    }
}
