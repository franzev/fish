package space.fishhub.android.feature.chat.component

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishAvatar
import space.fishhub.android.core.designsystem.component.fishFocusBorder

@Composable
fun ConversationRow(
    name: String,
    snippet: String,
    time: String,
    unreadCount: Int,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(FishTheme.radii.control)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.primaryControl)
            .background(
                color = if (selected) FishTheme.colors.selected else FishTheme.colors.surface,
                shape = shape,
            )
            .fishFocusBorder(shape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { this.selected = selected }
            .padding(FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FishAvatar(name = name)
        Spacer(Modifier.width(FishTheme.spacing.sm))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = name,
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = FishTheme.typography.label,
                )
                Text(
                    text = time,
                    color = FishTheme.colors.muted,
                    maxLines = 1,
                    style = FishTheme.typography.caption,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = snippet,
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.body,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = FishTheme.typography.ui,
                )
                if (unreadCount > 0) {
                    Spacer(Modifier.width(FishTheme.spacing.xs))
                    UnreadBadge(unreadCount)
                }
            }
        }
    }
}

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
