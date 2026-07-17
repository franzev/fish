package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.foundation.shape.RoundedCornerShape
import space.fishhub.android.core.designsystem.FishTheme

enum class FishSurfaceRole { Canvas, Surface, Subtle, Selected }

@Composable
fun FishSurface(
    modifier: Modifier = Modifier,
    role: FishSurfaceRole = FishSurfaceRole.Surface,
    shape: Shape = RoundedCornerShape(FishTheme.radii.card),
    content: @Composable () -> Unit,
) {
    val color = when (role) {
        FishSurfaceRole.Canvas -> FishTheme.colors.background
        FishSurfaceRole.Surface -> FishTheme.colors.surface
        FishSurfaceRole.Subtle -> FishTheme.colors.surfaceAlt
        FishSurfaceRole.Selected -> FishTheme.colors.selected
    }
    Box(modifier = modifier.background(color, shape), content = { content() })
}

@Composable
fun FishDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier = modifier, color = FishTheme.colors.divider)
}
