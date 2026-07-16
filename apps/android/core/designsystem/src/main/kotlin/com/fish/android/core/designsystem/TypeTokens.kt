package com.fish.android.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.fish.android.core.designsystem.tokens.GeneratedType

private val Lexend = FontFamily(
    Font(R.font.lexend_variable, weight = FontWeight.Normal),
    Font(R.font.lexend_variable, weight = FontWeight.Medium),
    Font(R.font.lexend_variable, weight = FontWeight.SemiBold),
    Font(R.font.lexend_variable, weight = FontWeight.Bold),
)

private val Fraunces = FontFamily(
    Font(R.font.fraunces_variable, weight = FontWeight.Normal),
    Font(R.font.fraunces_variable, weight = FontWeight.SemiBold),
    Font(R.font.fraunces_variable, weight = FontWeight.Bold),
)

@Immutable
class TypeTokens internal constructor(
    val display: TextStyle,
    val heading: TextStyle,
    val body: TextStyle,
    val ui: TextStyle,
    val label: TextStyle,
    val caption: TextStyle,
)

internal val typeTokens = TypeTokens(
    display = TextStyle(
        fontFamily = Fraunces,
        fontWeight = FontWeight.SemiBold,
        fontSize = GeneratedType.DisplaySize,
        lineHeight = GeneratedType.DisplayLineHeight,
        letterSpacing = (-0.32).sp,
    ),
    heading = TextStyle(
        fontFamily = Fraunces,
        fontWeight = FontWeight.SemiBold,
        fontSize = GeneratedType.HeadingSize,
        lineHeight = GeneratedType.HeadingLineHeight,
        letterSpacing = (-0.2).sp,
    ),
    body = TextStyle(
        fontFamily = Lexend,
        fontWeight = FontWeight.Normal,
        fontSize = GeneratedType.BodySize,
        lineHeight = GeneratedType.BodyLineHeight,
    ),
    ui = TextStyle(
        fontFamily = Lexend,
        fontWeight = FontWeight.Normal,
        fontSize = GeneratedType.UiSize,
        lineHeight = GeneratedType.UiLineHeight,
    ),
    label = TextStyle(
        fontFamily = Lexend,
        fontWeight = FontWeight.Medium,
        fontSize = GeneratedType.LabelSize,
        lineHeight = GeneratedType.LabelLineHeight,
    ),
    caption = TextStyle(
        fontFamily = Lexend,
        fontWeight = FontWeight.Normal,
        fontSize = GeneratedType.CaptionSize,
        lineHeight = GeneratedType.CaptionLineHeight,
    ),
)
