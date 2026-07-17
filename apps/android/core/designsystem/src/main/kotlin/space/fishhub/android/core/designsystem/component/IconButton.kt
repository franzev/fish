package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import space.fishhub.android.core.designsystem.FishTheme

enum class FishIconButtonVariant { Quiet, Filled, Critical }

@Composable
fun FishIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    selected: Boolean = false,
    variant: FishIconButtonVariant = FishIconButtonVariant.Quiet,
    size: Dp = FishTheme.sizes.touchTarget,
) {
    val shape = RoundedCornerShape(FishTheme.radii.control)
    val colors = when (variant) {
        FishIconButtonVariant.Filled -> IconButtonDefaults.filledIconButtonColors(
            containerColor = FishTheme.colors.primary,
            contentColor = FishTheme.colors.onPrimary,
            disabledContainerColor = FishTheme.colors.interactiveActive,
            disabledContentColor = FishTheme.colors.muted,
        )
        FishIconButtonVariant.Quiet -> IconButtonDefaults.iconButtonColors(
            containerColor = if (selected) FishTheme.colors.selected else Color.Transparent,
            contentColor = FishTheme.colors.body,
            disabledContentColor = FishTheme.colors.muted,
        )
        FishIconButtonVariant.Critical -> IconButtonDefaults.filledIconButtonColors(
            containerColor = FishTheme.colors.error,
            contentColor = FishTheme.colors.onPrimary,
            disabledContainerColor = FishTheme.colors.interactiveActive,
            disabledContentColor = FishTheme.colors.muted,
        )
    }
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(size)
            .fishFocusBorder(shape),
        enabled = enabled,
        colors = colors,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
        )
    }
}
