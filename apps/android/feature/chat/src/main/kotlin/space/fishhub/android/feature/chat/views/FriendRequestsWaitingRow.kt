package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.friends.R as FriendsR

/**
 * A friend request is waiting. Said once, quietly, as a row someone can open
 * when they have the room for it — never a count, a badge, or a red dot, which
 * would turn a kindness into a debt.
 */
@Composable
internal fun FriendRequestsWaitingRow(
    count: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (count <= 0) return
    val label = stringResource(
        if (count == 1) {
            FriendsR.string.friend_requests_waiting_one
        } else {
            FriendsR.string.friend_requests_waiting_many
        },
    )
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
            .background(
                color = FishTheme.colors.surfaceAlt,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .clickable(role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = label
                role = Role.Button
            }
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            modifier = Modifier.weight(1f),
            color = FishTheme.colors.body,
            style = FishTheme.typography.ui,
        )
        Icon(
            imageVector = FishIcons.ChevronRight,
            contentDescription = null,
            tint = FishTheme.colors.muted,
            modifier = Modifier
                .padding(start = FishTheme.spacing.sm)
                .size(FishTheme.sizes.iconGlyph),
        )
    }
}
