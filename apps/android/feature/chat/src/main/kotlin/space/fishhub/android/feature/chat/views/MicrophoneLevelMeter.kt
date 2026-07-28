package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import space.fishhub.android.core.designsystem.FishTheme

/**
 * Three quiet level bars mirroring iOS `MicrophoneLevelMeter`: bar height
 * follows the smoothed microphone level, success tint while voice is active,
 * muted otherwise. Decorative — meaning always lives in the accompanying
 * status text, so this is hidden from the accessibility tree.
 */
@Composable
fun MicrophoneLevelMeter(
    level: Float,
    modifier: Modifier = Modifier,
    active: Boolean = level.coerceIn(0f, 1f) >= 0.15f,
) {
    val safeLevel = level.coerceIn(0f, 1f)
    val barMaxHeights = listOf(FishTheme.spacing.xs, FishTheme.spacing.sm, FishTheme.spacing.md)
    val barScales = listOf(
        0.2f + safeLevel * 0.8f,
        0.15f + safeLevel * 0.85f,
        0.1f + safeLevel * 0.9f,
    )
    val color = if (active) FishTheme.colors.success else FishTheme.colors.muted
    Row(
        modifier = modifier.clearAndSetSemantics {},
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.threeXs),
    ) {
        barMaxHeights.forEachIndexed { index, maxHeight ->
            val barHeight: Dp = maxHeight * barScales[index]
            Box(
                modifier = Modifier
                    .width(FishTheme.spacing.twoXs)
                    .height(barHeight)
                    .background(color, RoundedCornerShape(FishTheme.radii.pill)),
            )
        }
    }
}

@Preview(name = "Microphone level meter light", showBackground = true)
@Composable
private fun MicrophoneLevelMeterLightPreview() {
    FishTheme(darkTheme = false) {
        Row(
            modifier = Modifier
                .background(FishTheme.colors.surface)
                .padding(FishTheme.spacing.page),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.lg),
        ) {
            MicrophoneLevelMeter(level = 0f)
            MicrophoneLevelMeter(level = 0.4f)
            MicrophoneLevelMeter(level = 1f)
        }
    }
}

@Preview(name = "Microphone level meter dark", showBackground = true)
@Composable
private fun MicrophoneLevelMeterDarkPreview() {
    FishTheme(darkTheme = true) {
        Row(
            modifier = Modifier
                .background(FishTheme.colors.surface)
                .padding(FishTheme.spacing.page),
            horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.lg),
        ) {
            MicrophoneLevelMeter(level = 0f)
            MicrophoneLevelMeter(level = 0.4f)
            MicrophoneLevelMeter(level = 1f)
        }
    }
}
