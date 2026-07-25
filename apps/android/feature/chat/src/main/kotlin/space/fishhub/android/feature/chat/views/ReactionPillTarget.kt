package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.fishFocusBorder

@Composable
internal fun ReactionPillTarget(
    description: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .defaultMinSize(
                minWidth = FishTheme.sizes.touchTarget,
                minHeight = FishTheme.sizes.touchTarget,
            )
            .fishFocusBorder(RoundedCornerShape(FishTheme.radii.pill))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = description
                this.selected = selected
                role = Role.Button
            },
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}
