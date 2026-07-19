package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.fishFocusBorder

@Composable
internal fun ReactionChip(
    reaction: ReactionUiModel,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ReactionChipTarget(
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

@Composable
internal fun AddReactionChip(
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ReactionChipTarget(
        description = description,
        selected = false,
        enabled = enabled,
        onClick = onClick,
        modifier = modifier,
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(FishTheme.radii.pill))
                .background(FishTheme.colors.surfaceAlt)
                .padding(FishTheme.spacing.twoXs),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = FishIcons.AddMedia,
                contentDescription = null,
                tint = FishTheme.colors.body,
            )
        }
    }
}

@Composable
private fun ReactionChipTarget(
    description: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .defaultMinSize(
                minWidth = FishTheme.sizes.touchTarget,
                minHeight = FishTheme.sizes.touchTarget,
            )
            .fishFocusBorder(RoundedCornerShape(FishTheme.radii.pill))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = description
                this.selected = selected
                role = Role.Button
            },
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}
