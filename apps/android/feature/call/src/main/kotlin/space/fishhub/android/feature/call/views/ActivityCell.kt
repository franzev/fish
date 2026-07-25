package space.fishhub.android.feature.call.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishTheme

@Composable
internal fun ActivityCell(
    label: String,
    status: String,
    icon: ImageVector,
    speaking: Boolean,
    modifier: Modifier,
) {
    Row(
        modifier = modifier
            .background(
                FishTheme.colors.surfaceAlt,
                RoundedCornerShape(FishTheme.radii.control),
            )
            .padding(FishTheme.spacing.sm),
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (speaking) FishTheme.colors.success else FishTheme.colors.muted,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = status,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
