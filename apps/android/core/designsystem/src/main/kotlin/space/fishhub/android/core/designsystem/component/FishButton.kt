package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme

enum class FishButtonVariant {
    Primary,
    Secondary,
    Ghost,
}

@Composable
fun FishButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: FishButtonVariant = FishButtonVariant.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingDescription: String = "Loading",
) {
    val colors = FishTheme.colors
    val shape = RoundedCornerShape(FishTheme.radii.control)
    val height = if (variant == FishButtonVariant.Primary) {
        FishTheme.sizes.primaryControl
    } else {
        FishTheme.sizes.touchTarget
    }
    val buttonColors = when (variant) {
        FishButtonVariant.Primary -> ButtonDefaults.buttonColors(
            containerColor = colors.primary,
            contentColor = colors.onPrimary,
            disabledContainerColor = colors.interactiveActive,
            disabledContentColor = colors.muted,
        )
        FishButtonVariant.Secondary -> ButtonDefaults.buttonColors(
            containerColor = colors.surfaceAlt,
            contentColor = colors.foreground,
            disabledContainerColor = colors.surfaceAlt,
            disabledContentColor = colors.muted,
        )
        FishButtonVariant.Ghost -> ButtonDefaults.buttonColors(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            contentColor = colors.body,
            disabledContainerColor = androidx.compose.ui.graphics.Color.Transparent,
            disabledContentColor = colors.muted,
        )
    }

    Button(
        onClick = onClick,
        modifier = modifier
            .defaultMinSize(minHeight = height)
            .fishFocusBorder(shape)
            .semantics {
                if (loading) stateDescription = loadingDescription
            },
        enabled = enabled && !loading,
        shape = shape,
        colors = buttonColors,
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = FishTheme.elevation.base,
            pressedElevation = FishTheme.elevation.base,
            focusedElevation = FishTheme.elevation.base,
            hoveredElevation = FishTheme.elevation.base,
            disabledElevation = FishTheme.elevation.base,
        ),
        contentPadding = PaddingValues(horizontal = FishTheme.spacing.md),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label,
                modifier = Modifier.alpha(if (loading) 0f else 1f),
                style = FishTheme.typography.label,
            )
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(FishTheme.sizes.iconGlyph),
                    color = when (variant) {
                        FishButtonVariant.Primary -> colors.onPrimary
                        else -> colors.foreground
                    },
                    strokeWidth = FishTheme.spacing.threeXs,
                )
            }
        }
    }
}
