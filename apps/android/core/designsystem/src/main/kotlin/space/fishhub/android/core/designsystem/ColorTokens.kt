package space.fishhub.android.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import space.fishhub.android.core.designsystem.tokens.GeneratedColors

@Immutable
class ColorTokens internal constructor(
    val background: Color,
    val surface: Color,
    val surfaceAlt: Color,
    val interactiveHover: Color,
    val interactiveActive: Color,
    val avatar: Color,
    val selected: Color,
    val border: Color,
    val borderStrong: Color,
    val divider: Color,
    val primary: Color,
    val primaryPressed: Color,
    val onPrimary: Color,
    val foreground: Color,
    val body: Color,
    val muted: Color,
    val notice: Color,
    val error: Color,
    val warning: Color,
    val success: Color,
    val presenceOnline: Color,
    val presenceIdle: Color,
    val presenceAway: Color,
    val presenceBusy: Color,
    val presenceOffline: Color,
    val scrim: Color,
)

internal fun colorTokens(darkTheme: Boolean): ColorTokens {
    fun space.fishhub.android.core.designsystem.tokens.GeneratedColorToken.resolve(): Color =
        if (darkTheme) dark else light

    return ColorTokens(
        background = GeneratedColors.Background.resolve(),
        surface = GeneratedColors.Surface.resolve(),
        surfaceAlt = GeneratedColors.SurfaceAlt.resolve(),
        interactiveHover = GeneratedColors.InteractiveHover.resolve(),
        interactiveActive = GeneratedColors.InteractiveActive.resolve(),
        avatar = GeneratedColors.Avatar.resolve(),
        selected = GeneratedColors.Selected.resolve(),
        border = GeneratedColors.Border.resolve(),
        borderStrong = GeneratedColors.BorderStrong.resolve(),
        divider = GeneratedColors.Divider.resolve(),
        primary = GeneratedColors.Primary.resolve(),
        primaryPressed = GeneratedColors.PrimaryPressed.resolve(),
        onPrimary = GeneratedColors.OnPrimary.resolve(),
        foreground = GeneratedColors.Foreground.resolve(),
        body = GeneratedColors.Body.resolve(),
        muted = GeneratedColors.Muted.resolve(),
        notice = GeneratedColors.Notice.resolve(),
        error = GeneratedColors.Error.resolve(),
        warning = GeneratedColors.Warning.resolve(),
        success = GeneratedColors.Success.resolve(),
        presenceOnline = GeneratedColors.PresenceOnline.resolve(),
        presenceIdle = GeneratedColors.PresenceIdle.resolve(),
        presenceAway = GeneratedColors.PresenceAway.resolve(),
        presenceBusy = GeneratedColors.PresenceBusy.resolve(),
        presenceOffline = GeneratedColors.PresenceOffline.resolve(),
        scrim = GeneratedColors.Scrim.resolve(),
    )
}
