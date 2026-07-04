package space.fishhub.app.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.theme.LocalColorTokens

@Composable
fun Progress(
    value: Float,
    modifier: Modifier = Modifier,
) {
    val colors = LocalColorTokens.current
    val clamped = value.coerceIn(0f, 1f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(12.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(colors.surface2),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(clamped)
                .height(12.dp)
                .widthIn(min = 0.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(colors.primary),
        )
    }
}
