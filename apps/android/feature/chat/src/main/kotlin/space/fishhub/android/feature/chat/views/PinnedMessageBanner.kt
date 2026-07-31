package space.fishhub.android.feature.chat.views

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.feature.chat.R

/**
 * The conversation's single pinned phrase, shown above the transcript. Its
 * only behavior is tap-to-focus; unpinning lives in the pinned message's own
 * action sheet, never a second control here. Callers render this only when
 * there is a readable pin — it never reserves space or shows a loading state
 * on its own.
 */
@Composable
fun PinnedMessageBanner(
    snippet: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val description = stringResource(R.string.pinned_message_accessibility, snippet)
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
                contentDescription = description
                role = Role.Button
            }
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
    ) {
        Icon(
            imageVector = FishIcons.Pin,
            contentDescription = null,
            tint = FishTheme.colors.body,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
        )
        Text(
            text = snippet,
            modifier = Modifier.weight(1f),
            color = FishTheme.colors.body,
            style = FishTheme.typography.ui,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
