package space.fishhub.android.feature.chat.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun UnreadBadge(count: Int, modifier: Modifier = Modifier) {
    if (count <= 0) return
    val visibleCount = if (count > 99) "99+" else count.toString()
    Box(
        modifier = modifier
            .size(FishTheme.sizes.badgeSlot, FishTheme.sizes.badge)
            .background(
                color = FishTheme.colors.primary,
                shape = RoundedCornerShape(FishTheme.radii.pill),
            )
            .semantics {
                this.contentDescription = if (count == 1) "1 unread message" else "$count unread messages"
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = visibleCount,
            color = FishTheme.colors.onPrimary,
            maxLines = 1,
            style = FishTheme.typography.caption,
        )
    }
}
