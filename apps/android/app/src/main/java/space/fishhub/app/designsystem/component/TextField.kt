package space.fishhub.app.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.VisualTransformation
import space.fishhub.app.designsystem.preview.ThemePreview
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalSpacingTokens
import space.fishhub.app.designsystem.theme.LocalStrokeTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens
import space.fishhub.app.designsystem.theme.Theme

@Composable
fun TextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    hint: String? = null,
    notice: String? = null,
    error: String? = null,
    enabled: Boolean = true,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val size = LocalSizeTokens.current
    val space = LocalSpacingTokens.current
    val stroke = LocalStrokeTokens.current
    val type = LocalTypeTokens.current
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val message = error ?: notice ?: hint
    val messageColor = when {
        error != null -> colors.error
        notice != null -> colors.notice
        else -> colors.muted
    }
    val borderColor = when {
        error != null -> colors.error
        notice != null -> colors.borderStrong
        isFocused -> colors.primary
        else -> colors.border
    }
    val borderWidth = if (error != null) stroke.focus else stroke.hairline

    androidx.compose.foundation.layout.Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            color = colors.foreground,
            style = type.label,
            modifier = Modifier.padding(bottom = space.sm),
        )
        BasicTextField(
            value = value,
            onValueChange = { next -> onValueChange(next.replace("\n", "")) },
            enabled = enabled,
            singleLine = true,
            textStyle = type.body.copy(color = colors.foreground),
            cursorBrush = SolidColor(colors.foreground),
            visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions,
            interactionSource = interactionSource,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = size.control)
                .border(
                    BorderStroke(borderWidth, borderColor),
                    RoundedCornerShape(radius.control),
                ),
            decorationBox = { innerTextField ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = size.control)
                        .padding(horizontal = space.md),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty() && placeholder.isNotEmpty()) {
                        Text(
                            text = placeholder,
                            color = colors.muted,
                            style = type.body,
                        )
                    }
                    innerTextField()
                }
            },
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = space.xs)
                .heightIn(min = size.helper),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (message != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(space.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (error != null || notice != null) {
                        MessageDot(
                            label = if (error != null) "!" else "i",
                            color = messageColor,
                        )
                    }
                    Text(
                        text = message,
                        color = messageColor,
                        style = type.caption,
                    )
                }
            }
        }
    }
}

@Composable
private fun MessageDot(label: String, color: androidx.compose.ui.graphics.Color) {
    val radius = LocalRadiusTokens.current
    val size = LocalSizeTokens.current
    val stroke = LocalStrokeTokens.current

    Box(
        modifier = Modifier
            .size(size.icon)
            .border(BorderStroke(stroke.icon, color), RoundedCornerShape(radius.pill)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = color,
            style = LocalTypeTokens.current.caption,
        )
    }
}

@ThemePreview
@Composable
private fun TextFieldPreview() {
    Theme {
        val colors = LocalColorTokens.current
        val space = LocalSpacingTokens.current

        Surface(color = colors.bg, contentColor = colors.body) {
            Column(
                modifier = Modifier.padding(space.lg),
                verticalArrangement = Arrangement.spacedBy(space.sm),
            ) {
                TextField(
                    label = "Email",
                    value = "you@work.com",
                    onValueChange = {},
                    hint = "Use the email your coach invited.",
                )
                TextField(
                    label = "Password",
                    value = "",
                    onValueChange = {},
                    placeholder = "Password",
                    notice = "That email and password don't match. Try again?",
                )
                TextField(
                    label = "New password",
                    value = "samepassword",
                    onValueChange = {},
                    error = "That's the same password as before. Pick a new one.",
                )
            }
        }
    }
}
