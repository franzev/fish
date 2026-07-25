package space.fishhub.android.core.designsystem.component

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.Dp
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishSkeleton(
    modifier: Modifier = Modifier,
    width: Dp? = null,
) {
    val duration = FishTheme.motion.skeletonMs
    val animatedAlpha = if (duration == 0) {
        0.65f
    } else {
        val transition = rememberInfiniteTransition(label = "skeleton")
        val alpha by transition.animateFloat(
            initialValue = 0.45f,
            targetValue = 0.8f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = duration),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "skeleton opacity",
        )
        alpha
    }
    val sizedModifier = if (width != null) modifier.size(width, FishTheme.spacing.sm) else {
        modifier.fillMaxWidth().height(FishTheme.spacing.sm)
    }
    Box(
        modifier = sizedModifier
            .alpha(animatedAlpha)
            .background(
                color = FishTheme.colors.selected,
                shape = RoundedCornerShape(FishTheme.radii.pill),
            ),
    )
}
