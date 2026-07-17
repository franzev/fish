package com.fish.android.feature.presence

import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.layout.size
import com.fish.android.core.designsystem.FishIcons
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.data.presence.PresenceDisplayStatus

@Composable
fun PresenceIndicator(
    status: PresenceDisplayStatus,
    label: String,
    modifier: Modifier = Modifier,
    decorative: Boolean = false,
) {
    val (icon, color) = status.visuals()
    val semantics = if (decorative) {
        Modifier.clearAndSetSemantics { }
    } else {
        Modifier.semantics { contentDescription = label }
    }
    Icon(
        imageVector = icon,
        contentDescription = null,
        tint = color,
        modifier = modifier
            .then(semantics)
            .size(FishTheme.sizes.presenceIndicatorSmall),
    )
}

@Composable
private fun PresenceDisplayStatus.visuals(): Pair<ImageVector, Color> = when (this) {
    PresenceDisplayStatus.Online -> FishIcons.CircleFilled to FishTheme.colors.presenceOnline
    PresenceDisplayStatus.Idle -> FishIcons.Moon to FishTheme.colors.presenceIdle
    PresenceDisplayStatus.Away -> FishIcons.Clock to FishTheme.colors.presenceAway
    PresenceDisplayStatus.Busy -> FishIcons.CircleMinus to FishTheme.colors.presenceBusy
    PresenceDisplayStatus.Invisible -> FishIcons.EyeOff to FishTheme.colors.presenceOffline
    PresenceDisplayStatus.Offline -> FishIcons.OutlineCircle to FishTheme.colors.presenceOffline
}
