package space.fishhub.android.feature.presence

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.fishFocusBorder

@Composable
fun PresenceAccountTrigger(
    displayName: String,
    presence: PresencePresentation,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .defaultMinSize(
                minWidth = FishTheme.sizes.touchTarget,
                minHeight = FishTheme.sizes.touchTarget,
            )
            .fishFocusBorder(androidx.compose.foundation.shape.CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .clearAndSetSemantics {
                contentDescription = "$displayName, ${presence.label}, account and status"
            },
        contentAlignment = Alignment.Center,
    ) {
        PresenceAvatar(name = displayName, presence = presence)
    }
}
