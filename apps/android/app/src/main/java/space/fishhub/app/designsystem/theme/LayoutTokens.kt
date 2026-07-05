package space.fishhub.app.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class SpacingTokens(
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 16.dp,
    val lg: Dp = 24.dp,
    val xl: Dp = 32.dp,
    val xxl: Dp = 48.dp,
    val page: Dp = 64.dp,
)

@Immutable
data class RadiusTokens(
    val control: Dp = 12.dp,
    val card: Dp = 16.dp,
    val pill: Dp = 999.dp,
)

@Immutable
data class SizeTokens(
    val control: Dp = 56.dp,
    val icon: Dp = 20.dp,
    val progress: Dp = 18.dp,
    val helper: Dp = 22.dp,
    val content: Dp = 440.dp,
)

@Immutable
data class StrokeTokens(
    val hairline: Dp = 1.dp,
    val focus: Dp = 2.dp,
    val icon: Dp = 1.5.dp,
    val progress: Dp = 2.dp,
)

@Immutable
data class ElevationTokens(
    val none: Dp = 0.dp,
)

@Immutable
data class OpacityTokens(
    val hidden: Float = 0f,
    val full: Float = 1f,
    val disabledContainer: Float = 0.5f,
    val disabledContent: Float = 0.65f,
    val progressTrack: Float = 0.25f,
)
