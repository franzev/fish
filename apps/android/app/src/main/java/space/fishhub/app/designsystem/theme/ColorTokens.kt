package space.fishhub.app.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

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
    warning = Color(0xFF6B4400),
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
