package com.fish.android.core.designsystem.component

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.shape.RoundedCornerShape
import com.fish.android.core.designsystem.FishTheme

@Composable
fun FishTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    supportingText: String? = null,
    errorMessage: String? = null,
    enabled: Boolean = true,
    singleLine: Boolean = true,
    minLines: Int = 1,
    maxLines: Int = if (singleLine) 1 else 6,
    keyboardOptions: KeyboardOptions = KeyboardOptions(
        capitalization = KeyboardCapitalization.Sentences,
        imeAction = if (singleLine) ImeAction.Next else ImeAction.Default,
    ),
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    shape: Shape = RoundedCornerShape(FishTheme.radii.control),
) {
    val colors = FishTheme.colors
    Column(modifier = modifier) {
        Text(
            text = label,
            modifier = Modifier.padding(bottom = FishTheme.spacing.xs),
            color = colors.foreground,
            style = FishTheme.typography.label,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .fishFocusBorder(shape),
            enabled = enabled,
            textStyle = FishTheme.typography.body.copy(color = colors.foreground),
            placeholder = placeholder?.let {
                { Text(it, color = colors.muted, style = FishTheme.typography.body) }
            },
            supportingText = null,
            isError = errorMessage != null,
            singleLine = singleLine,
            minLines = minLines,
            maxLines = maxLines,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            shape = shape,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = colors.surfaceAlt,
                unfocusedContainerColor = colors.surfaceAlt,
                disabledContainerColor = colors.surfaceAlt,
                errorContainerColor = colors.surfaceAlt,
                focusedTextColor = colors.foreground,
                unfocusedTextColor = colors.foreground,
                cursorColor = colors.primary,
                focusedBorderColor = colors.foreground,
                unfocusedBorderColor = colors.border,
                errorBorderColor = colors.notice,
                focusedPlaceholderColor = colors.muted,
                unfocusedPlaceholderColor = colors.muted,
            ),
        )
        val message = errorMessage ?: supportingText
        if (message != null) {
            Text(
                text = message,
                modifier = Modifier.padding(top = FishTheme.spacing.xs),
                color = if (errorMessage != null) colors.notice else colors.body,
                style = FishTheme.typography.caption,
            )
        }
    }
}
