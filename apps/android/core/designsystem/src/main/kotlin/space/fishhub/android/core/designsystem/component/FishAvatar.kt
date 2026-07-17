package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishAvatar(
    name: String,
    modifier: Modifier = Modifier,
    image: Painter? = null,
    size: Dp = FishTheme.sizes.avatarMedium,
) {
    val initials = name
        .trim()
        .split(Regex("\\s+"))
        .filter(String::isNotBlank)
        .take(2)
        .joinToString(separator = "") { it.take(1).uppercase() }
        .ifBlank { "?" }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(FishTheme.colors.avatar)
            .semantics { contentDescription = name },
        contentAlignment = Alignment.Center,
    ) {
        if (image != null) {
            Image(
                painter = image,
                contentDescription = null,
                modifier = Modifier.matchParentSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(
                text = initials,
                color = FishTheme.colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Clip,
                style = FishTheme.typography.label,
            )
        }
    }
}
