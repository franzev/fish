package space.fishhub.app.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens

@Composable
fun Card(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current

    Surface(
        modifier = modifier,
        color = colors.surface,
        contentColor = colors.body,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(radius.card),
        border = BorderStroke(1.dp, colors.border),
        shadowElevation = 0.dp,
        tonalElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            content = content,
        )
    }
}
