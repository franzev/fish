package space.fishhub.android.feature.presence

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishAvatar

@Composable
fun PresenceAvatar(
    name: String,
    presence: PresencePresentation,
    modifier: Modifier = Modifier,
    size: Dp = FishTheme.sizes.avatarSmall,
) {
    Box(
        modifier = modifier.clearAndSetSemantics {
            contentDescription = "$name, ${presence.label}"
        },
    ) {
        FishAvatar(name = name, size = size)
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .background(FishTheme.colors.surface, CircleShape)
                .padding(FishTheme.spacing.threeXs),
        ) {
            PresenceIndicator(
                status = presence.status,
                label = presence.label,
                decorative = true,
                modifier = Modifier.size(FishTheme.sizes.presenceIndicatorSmall),
            )
        }
    }
}
