package space.fishhub.app.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens

enum class AlertTone {
    Notice,
    Warning,
    Error,
    Success,
}

@Composable
fun Alert(
    tone: AlertTone,
    text: String,
    modifier: Modifier = Modifier,
) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val type = LocalTypeTokens.current
    val toneColor = when (tone) {
        AlertTone.Notice -> colors.notice
        AlertTone.Warning -> colors.warning
        AlertTone.Error -> colors.error
        AlertTone.Success -> colors.success
    }
    val icon = when (tone) {
        AlertTone.Notice -> "i"
        AlertTone.Warning -> "!"
        AlertTone.Error -> "!"
        AlertTone.Success -> "ok"
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = colors.surface,
        contentColor = colors.body,
        shape = RoundedCornerShape(radius.control),
        border = BorderStroke(if (tone == AlertTone.Notice) 1.dp else 2.dp, toneColor),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .border(BorderStroke(1.5.dp, toneColor), RoundedCornerShape(999.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = icon,
                    color = toneColor,
                    style = type.caption,
                )
            }
            Text(
                text = text,
                color = colors.body,
                style = type.caption.copy(
                    fontWeight = if (tone == AlertTone.Error || tone == AlertTone.Warning) {
                        FontWeight.SemiBold
                    } else {
                        FontWeight.Normal
                    },
                ),
            )
        }
    }
}
