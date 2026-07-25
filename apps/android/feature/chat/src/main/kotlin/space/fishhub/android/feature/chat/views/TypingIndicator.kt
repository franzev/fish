package space.fishhub.android.feature.chat.views

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.R

@Composable
fun TypingIndicator(name: String, modifier: Modifier = Modifier) {
    val typingLabel = stringResource(R.string.typing, name)
    val duration = FishTheme.motion.typingMs
    val alpha = if (duration == 0) {
        0.7f
    } else {
        val transition = rememberInfiniteTransition(label = "typing")
        val animated by transition.animateFloat(
            initialValue = 0.45f,
            targetValue = 0.9f,
            animationSpec = infiniteRepeatable(
                animation = tween(duration),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "typing opacity",
        )
        animated
    }
    Row(
        modifier = modifier
            .semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = typingLabel
            }
            .padding(vertical = FishTheme.spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = typingLabel,
            color = FishTheme.colors.muted,
            style = FishTheme.typography.caption,
        )
        Row(
            modifier = Modifier
                .padding(start = FishTheme.spacing.nudge)
                .alpha(alpha),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
        ) {
            repeat(3) {
                Box(
                    Modifier
                        .size(FishTheme.spacing.twoXs)
                        .background(FishTheme.colors.muted, RoundedCornerShape(FishTheme.radii.pill)),
                )
            }
        }
    }
}
