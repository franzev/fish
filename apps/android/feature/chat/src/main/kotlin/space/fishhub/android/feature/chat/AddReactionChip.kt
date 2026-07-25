package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme

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
