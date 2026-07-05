package space.fishhub.app.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button as MaterialButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalElevationTokens
import space.fishhub.app.designsystem.theme.LocalOpacityTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalSpacingTokens
import space.fishhub.app.designsystem.theme.LocalStrokeTokens

enum class ButtonVariant {
    Primary,
    Secondary,
    Ghost,
}

@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
    fullWidth: Boolean = false,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = LocalColorTokens.current
    val elevation = LocalElevationTokens.current
    val opacity = LocalOpacityTokens.current
    val radius = LocalRadiusTokens.current
    val size = LocalSizeTokens.current
    val space = LocalSpacingTokens.current
    val stroke = LocalStrokeTokens.current
    val containerColor = when (variant) {
        ButtonVariant.Primary -> colors.primary
        ButtonVariant.Secondary -> colors.surface
        ButtonVariant.Ghost -> colors.bg
    }
    val contentColor = when (variant) {
        ButtonVariant.Primary -> colors.onPrimary
        ButtonVariant.Secondary -> colors.foreground
        ButtonVariant.Ghost -> colors.muted
    }
    val border = when (variant) {
        ButtonVariant.Secondary -> BorderStroke(stroke.hairline, colors.border)
        else -> BorderStroke(stroke.hairline, androidx.compose.ui.graphics.Color.Transparent)
    }
    val widthModifier = if (fullWidth) Modifier.fillMaxWidth() else Modifier
    val semanticsModifier = if (loading) {
        Modifier.semantics { stateDescription = "Loading" }
    } else {
        Modifier
    }
    val contentAlpha = if (loading) opacity.hidden else opacity.full

    if (variant == ButtonVariant.Ghost) {
        val interactionSource = remember { MutableInteractionSource() }
        CompositionLocalProvider(LocalContentColor provides contentColor) {
            Box(
                modifier = modifier
                    .then(widthModifier)
                    .then(semanticsModifier)
                    .heightIn(min = size.control)
                    .clickable(
                        interactionSource = interactionSource,
                        indication = null,
                        enabled = enabled && !loading,
                        role = Role.Button,
                        onClick = onClick,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    modifier = Modifier
                        .alpha(contentAlpha)
                        .padding(horizontal = space.lg),
                    content = content,
                )
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(size.progress),
                        color = contentColor,
                        strokeWidth = stroke.progress,
                        trackColor = contentColor.copy(alpha = opacity.progressTrack),
                    )
                }
            }
        }
        return
    }

    MaterialButton(
        onClick = {
            if (!loading) onClick()
        },
        enabled = enabled,
        modifier = modifier
            .then(widthModifier)
            .then(semanticsModifier)
            .heightIn(min = size.control),
        shape = RoundedCornerShape(radius.control),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            disabledContainerColor = containerColor.copy(alpha = opacity.disabledContainer),
            disabledContentColor = contentColor.copy(alpha = opacity.disabledContent),
        ),
        border = border,
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = elevation.none,
            pressedElevation = elevation.none,
        ),
        contentPadding = PaddingValues(horizontal = space.lg),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Row(
                modifier = Modifier.alpha(contentAlpha),
                content = content,
            )
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(size.progress),
                    color = contentColor,
                    strokeWidth = stroke.progress,
                    trackColor = contentColor.copy(alpha = opacity.progressTrack),
                )
            }
        }
    }
}

@Composable
fun ButtonText(text: String) {
    androidx.compose.material3.Text(
        text = text,
        style = MaterialTheme.typography.bodyLarge,
    )
}
