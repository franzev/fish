package space.fishhub.android.feature.settings.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.settings.logic.label

@Composable
internal fun SettingsRow(
    label: String,
    modifier: Modifier = Modifier,
    explanation: String? = null,
    trailing: String? = null,
    selected: Boolean = false,
    enabled: Boolean = true,
    role: Role = Role.Button,
    leadingIcon: ImageVector? = null,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(FishTheme.radii.control)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
            .background(
                if (selected) FishTheme.colors.selected else FishTheme.colors.surfaceAlt,
                shape,
            )
            .clickable(enabled = enabled, role = role, onClick = onClick)
            .semantics {
                this.selected = selected
                contentDescription = listOfNotNull(label, explanation, trailing).joinToString(", ")
            }
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.let {
            Icon(
                imageVector = it,
                contentDescription = null,
                tint = FishTheme.colors.body,
                modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            )
            Spacer(Modifier.width(FishTheme.spacing.sm))
        }
        Column(Modifier.weight(1f)) {
            Text(label, color = FishTheme.colors.foreground, style = FishTheme.typography.label)
            explanation?.let {
                Text(it, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
            }
        }
        trailing?.let {
            Text(it, color = FishTheme.colors.muted, style = FishTheme.typography.caption)
        }
        if (selected) {
            Icon(
                imageVector = FishIcons.Check,
                contentDescription = null,
                tint = FishTheme.colors.foreground,
                modifier = Modifier
                    .padding(start = FishTheme.spacing.sm)
                    .size(FishTheme.sizes.iconGlyph),
            )
        }
    }
}
