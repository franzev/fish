package space.fishhub.app.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens

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
    val borderWidth = if (error != null) 2.dp else 1.dp

    androidx.compose.foundation.layout.Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            color = colors.foreground,
            style = type.label,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
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
                        .padding(horizontal = 16.dp),
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
                .padding(top = 4.dp)
                .heightIn(min = 22.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (message != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
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
    Box(
        modifier = Modifier
            .size(20.dp)
            .border(BorderStroke(1.5.dp, color), RoundedCornerShape(999.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = color,
            style = LocalTypeTokens.current.caption,
        )
    }
}
