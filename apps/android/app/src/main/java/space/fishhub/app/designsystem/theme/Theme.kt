package space.fishhub.app.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape

@Composable
fun Theme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) darkColors else lightColors
    val type = TypeTokens()
    val radius = RadiusTokens()

    CompositionLocalProvider(
        LocalColorTokens provides colors,
        LocalSpacingTokens provides SpacingTokens(),
        LocalRadiusTokens provides radius,
        LocalSizeTokens provides SizeTokens(),
        LocalStrokeTokens provides StrokeTokens(),
        LocalElevationTokens provides ElevationTokens(),
        LocalOpacityTokens provides OpacityTokens(),
        LocalTypeTokens provides type,
    ) {
        MaterialTheme(
            colorScheme = materialColors(colors, darkTheme),
            typography = Typography(
                displayLarge = type.display,
                headlineSmall = type.heading,
                titleLarge = type.heading,
                bodyLarge = type.body,
                bodyMedium = type.body,
                labelLarge = type.label,
                labelMedium = type.caption,
            ),
            shapes = Shapes(
                small = RoundedCornerShape(radius.control),
                medium = RoundedCornerShape(radius.card),
                large = RoundedCornerShape(radius.card),
            ),
            content = content,
        )
    }
}

private fun materialColors(tokens: ColorTokens, darkTheme: Boolean): ColorScheme {
    return if (darkTheme) {
        darkColorScheme(
            primary = tokens.primary,
            onPrimary = tokens.onPrimary,
            secondary = tokens.foreground,
            onSecondary = tokens.bg,
            background = tokens.bg,
            onBackground = tokens.body,
            surface = tokens.surface,
            onSurface = tokens.foreground,
            surfaceVariant = tokens.surface2,
            onSurfaceVariant = tokens.body,
            outline = tokens.border,
            outlineVariant = tokens.borderStrong,
            error = tokens.error,
            onError = Color.Black,
        )
    } else {
        lightColorScheme(
            primary = tokens.primary,
            onPrimary = tokens.onPrimary,
            secondary = tokens.foreground,
            onSecondary = tokens.bg,
            background = tokens.bg,
            onBackground = tokens.body,
            surface = tokens.surface,
            onSurface = tokens.foreground,
            surfaceVariant = tokens.surface2,
            onSurfaceVariant = tokens.body,
            outline = tokens.border,
            outlineVariant = tokens.borderStrong,
            error = tokens.error,
            onError = Color.White,
        )
    }
}
