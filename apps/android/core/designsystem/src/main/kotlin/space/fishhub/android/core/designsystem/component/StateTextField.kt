package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishStateTextField(
    state: TextFieldState,
    placeholder: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    inputTransformation: InputTransformation? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    lineLimits: TextFieldLineLimits = TextFieldLineLimits.Default,
) {
    val shape = RoundedCornerShape(FishTheme.radii.control)
    OutlinedTextField(
        state = state,
        modifier = modifier
            .heightIn(
                min = FishTheme.sizes.composerMin,
                max = FishTheme.sizes.composerMax,
            )
            .fishFocusBorder(shape),
        enabled = enabled,
        textStyle = FishTheme.typography.body.copy(color = FishTheme.colors.foreground),
        placeholder = {
            Text(
                text = placeholder,
                color = FishTheme.colors.muted,
                style = FishTheme.typography.body,
            )
        },
        inputTransformation = inputTransformation,
        keyboardOptions = keyboardOptions,
        lineLimits = lineLimits,
        shape = shape,
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = FishTheme.colors.surfaceAlt,
            unfocusedContainerColor = FishTheme.colors.surfaceAlt,
            disabledContainerColor = FishTheme.colors.surfaceAlt,
            focusedTextColor = FishTheme.colors.foreground,
            unfocusedTextColor = FishTheme.colors.foreground,
            cursorColor = FishTheme.colors.primary,
            focusedBorderColor = FishTheme.colors.foreground,
            unfocusedBorderColor = FishTheme.colors.border,
        ),
    )
}
