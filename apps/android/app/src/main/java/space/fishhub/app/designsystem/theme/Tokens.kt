package space.fishhub.app.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Immutable
data class ColorTokens(
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val border: Color,
    val borderStrong: Color,
    val primary: Color,
    val primaryPress: Color,
    val onPrimary: Color,
    val foreground: Color,
    val body: Color,
    val muted: Color,
    val notice: Color,
    val error: Color,
    val warning: Color,
    val success: Color,
)

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
    val content: Dp = 440.dp,
)

@Immutable
data class TypeTokens(
    val display: TextStyle = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 32.sp,
        lineHeight = 37.sp,
    ),
    val heading: TextStyle = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 24.sp,
    ),
    val body: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 17.sp,
        lineHeight = 26.sp,
    ),
    val label: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    val caption: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
)

val lightColors = ColorTokens(
    bg = Color(0xFFF8F8F8),
    surface = Color(0xFFFFFFFF),
    surface2 = Color(0xFFEBEBEB),
    border = Color(0xFF8C8C8C),
    borderStrong = Color(0xFF717171),
    primary = Color(0xFF0B0B0B),
    primaryPress = Color(0xFF222222),
    onPrimary = Color(0xFFF8F8F8),
    foreground = Color(0xFF0B0B0B),
    body = Color(0xFF333333),
    muted = Color(0xFF636363),
    notice = Color(0xFF484848),
    error = Color(0xFF932A33),
    warning = Color(0xFF6E4300),
    success = Color(0xFF005725),
)

val darkColors = ColorTokens(
    bg = Color(0xFF0B0B0B),
    surface = Color(0xFF161616),
    surface2 = Color(0xFF242424),
    border = Color(0xFF717171),
    borderStrong = Color(0xFF8F8F8F),
    primary = Color(0xFFF8F8F8),
    primaryPress = Color(0xFFDEDEDE),
    onPrimary = Color(0xFF0B0B0B),
    foreground = Color(0xFFF5F5F5),
    body = Color(0xFFD7D7D7),
    muted = Color(0xFF989898),
    notice = Color(0xFFBEBEBE),
    error = Color(0xFFF69A9A),
    warning = Color(0xFFE0AE57),
    success = Color(0xFF73C385),
)

val LocalColorTokens = staticCompositionLocalOf { lightColors }
val LocalSpacingTokens = staticCompositionLocalOf { SpacingTokens() }
val LocalRadiusTokens = staticCompositionLocalOf { RadiusTokens() }
val LocalSizeTokens = staticCompositionLocalOf { SizeTokens() }
val LocalTypeTokens = staticCompositionLocalOf { TypeTokens() }
