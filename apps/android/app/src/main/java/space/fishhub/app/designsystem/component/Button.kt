package space.fishhub.app.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button as MaterialButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens

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
    fullWidth: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val size = LocalSizeTokens.current
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
        ButtonVariant.Secondary -> BorderStroke(1.dp, colors.border)
        else -> BorderStroke(1.dp, androidx.compose.ui.graphics.Color.Transparent)
    }
    val widthModifier = if (fullWidth) Modifier.fillMaxWidth() else Modifier
    val semanticsModifier = if (loading) {
        Modifier.semantics { stateDescription = "Loading" }
    } else {
        Modifier
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
        shape = androidx.compose.foundation.shape.RoundedCornerShape(radius.control),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            disabledContainerColor = containerColor.copy(alpha = 0.5f),
            disabledContentColor = contentColor.copy(alpha = 0.65f),
        ),
        border = border,
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 0.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            androidx.compose.foundation.layout.Row(
                modifier = Modifier.alpha(if (loading) 0f else 1f),
                content = content,
            )
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = contentColor,
                    strokeWidth = 2.dp,
                    trackColor = contentColor.copy(alpha = 0.25f),
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
