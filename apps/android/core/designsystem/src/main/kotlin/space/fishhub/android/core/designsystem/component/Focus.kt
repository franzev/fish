package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.border
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun Modifier.fishFocusBorder(shape: Shape): Modifier {
    var focused by remember { mutableStateOf(false) }
    return onFocusChanged { focused = it.isFocused }
        .then(
            if (focused) {
                Modifier.border(
                    width = FishTheme.spacing.threeXs,
                    color = FishTheme.colors.borderStrong,
                    shape = shape,
                )
            } else {
                Modifier
            },
        )
}
