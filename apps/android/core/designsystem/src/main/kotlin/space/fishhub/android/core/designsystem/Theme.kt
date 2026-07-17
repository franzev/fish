package space.fishhub.android.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

private val LocalColorTokens = staticCompositionLocalOf<ColorTokens> {
    error("FishTheme is missing")
}
private val LocalSpacingTokens = staticCompositionLocalOf { SpacingTokens() }
private val LocalRadiusTokens = staticCompositionLocalOf { RadiusTokens() }
private val LocalSizeTokens = staticCompositionLocalOf { SizeTokens() }
private val LocalLayoutTokens = staticCompositionLocalOf { LayoutTokens() }
private val LocalElevationTokens = staticCompositionLocalOf { ElevationTokens() }
private val LocalMotionTokens = staticCompositionLocalOf { MotionTokens.create(false) }
private val LocalTypeTokens = staticCompositionLocalOf { typeTokens }

object FishTheme {
    val colors: ColorTokens
        @Composable @ReadOnlyComposable get() = LocalColorTokens.current
    val spacing: SpacingTokens
        @Composable @ReadOnlyComposable get() = LocalSpacingTokens.current
    val radii: RadiusTokens
        @Composable @ReadOnlyComposable get() = LocalRadiusTokens.current
    val sizes: SizeTokens
        @Composable @ReadOnlyComposable get() = LocalSizeTokens.current
    val layout: LayoutTokens
        @Composable @ReadOnlyComposable get() = LocalLayoutTokens.current
    val elevation: ElevationTokens
        @Composable @ReadOnlyComposable get() = LocalElevationTokens.current
    val motion: MotionTokens
        @Composable @ReadOnlyComposable get() = LocalMotionTokens.current
    val typography: TypeTokens
        @Composable @ReadOnlyComposable get() = LocalTypeTokens.current
}

@Composable
fun FishTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    reducedMotion: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors = colorTokens(darkTheme)
    val radii = RadiusTokens()
    val materialColors = if (darkTheme) {
        darkColorScheme(
            primary = colors.primary,
            onPrimary = colors.onPrimary,
            background = colors.background,
            onBackground = colors.foreground,
            surface = colors.surface,
            onSurface = colors.foreground,
            surfaceVariant = colors.surfaceAlt,
            onSurfaceVariant = colors.body,
            outline = colors.border,
            outlineVariant = colors.divider,
            error = colors.error,
            scrim = colors.scrim,
        )
    } else {
        lightColorScheme(
            primary = colors.primary,
            onPrimary = colors.onPrimary,
            background = colors.background,
            onBackground = colors.foreground,
            surface = colors.surface,
            onSurface = colors.foreground,
            surfaceVariant = colors.surfaceAlt,
            onSurfaceVariant = colors.body,
            outline = colors.border,
            outlineVariant = colors.divider,
            error = colors.error,
            scrim = colors.scrim,
        )
    }
    val materialTypography = Typography(
        displayLarge = typeTokens.display,
        headlineMedium = typeTokens.heading,
        bodyLarge = typeTokens.body,
        bodyMedium = typeTokens.ui,
        labelLarge = typeTokens.label,
        bodySmall = typeTokens.caption,
    )
    val materialShapes = Shapes(
        extraSmall = RoundedCornerShape(radii.chatInner),
        small = RoundedCornerShape(radii.control),
        medium = RoundedCornerShape(radii.card),
        large = RoundedCornerShape(radii.card),
        extraLarge = RoundedCornerShape(radii.card),
    )

    CompositionLocalProvider(
        LocalColorTokens provides colors,
        LocalSpacingTokens provides SpacingTokens(),
        LocalRadiusTokens provides radii,
        LocalSizeTokens provides SizeTokens(),
        LocalLayoutTokens provides LayoutTokens(),
        LocalElevationTokens provides ElevationTokens(),
        LocalMotionTokens provides MotionTokens.create(reducedMotion),
        LocalTypeTokens provides typeTokens,
    ) {
        MaterialTheme(
            colorScheme = materialColors,
            typography = materialTypography,
            shapes = materialShapes,
            content = content,
        )
    }
}
