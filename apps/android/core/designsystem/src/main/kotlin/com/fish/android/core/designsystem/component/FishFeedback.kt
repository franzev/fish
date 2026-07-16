package com.fish.android.core.designsystem.component

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.fish.android.core.designsystem.FishIcons
import com.fish.android.core.designsystem.FishTheme

@Composable
fun FishNotice(
    message: String,
    modifier: Modifier = Modifier,
    tone: FishNoticeTone = FishNoticeTone.Neutral,
) {
    val color = when (tone) {
        FishNoticeTone.Neutral -> FishTheme.colors.notice
        FishNoticeTone.Error -> FishTheme.colors.notice
        FishNoticeTone.Warning -> FishTheme.colors.warning
        FishNoticeTone.Success -> FishTheme.colors.success
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                color = FishTheme.colors.surfaceAlt,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .border(
                width = FishTheme.spacing.threeXs,
                color = color,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .padding(FishTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (tone == FishNoticeTone.Success) FishIcons.Check else FishIcons.AlertCircle,
            contentDescription = null,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            tint = color,
        )
        Text(
            text = message,
            modifier = Modifier.padding(start = FishTheme.spacing.sm),
            color = FishTheme.colors.body,
            style = FishTheme.typography.ui,
        )
    }
}

enum class FishNoticeTone { Neutral, Error, Warning, Success }

@Composable
fun FishProgress(
    progress: Float,
    contentDescription: String,
    modifier: Modifier = Modifier,
) {
    val value = progress.coerceIn(0f, 1f)
    LinearProgressIndicator(
        progress = { value },
        modifier = modifier
            .fillMaxWidth()
            .height(FishTheme.spacing.sm)
            .semantics {
                this.contentDescription = contentDescription
                progressBarRangeInfo = ProgressBarRangeInfo(value, 0f..1f)
            },
        color = FishTheme.colors.primary,
        trackColor = FishTheme.colors.surfaceAlt,
        strokeCap = androidx.compose.ui.graphics.StrokeCap.Round,
        gapSize = FishTheme.spacing.threeXs,
        drawStopIndicator = {},
    )
}

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
