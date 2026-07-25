package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishNotice(
    title: String,
    modifier: Modifier = Modifier,
    message: String? = null,
    tone: FishNoticeTone = FishNoticeTone.Neutral,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val color = when (tone) {
        FishNoticeTone.Neutral -> FishTheme.colors.notice
        FishNoticeTone.Error -> FishTheme.colors.notice
        FishNoticeTone.Warning -> FishTheme.colors.warning
        FishNoticeTone.Success -> FishTheme.colors.success
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                color = FishTheme.colors.surfaceAlt,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .border(
                width = FishTheme.spacing.threeXs,
                color = color,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .padding(FishTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (tone == FishNoticeTone.Success) FishIcons.Check else FishIcons.AlertCircle,
            contentDescription = null,
            modifier = Modifier.size(FishTheme.sizes.iconGlyph),
            tint = color,
        )
        Column(
            modifier = Modifier
                .padding(start = FishTheme.spacing.sm)
                .weight(1f),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.threeXs),
        ) {
            Text(
                text = title,
                color = FishTheme.colors.body,
                style = FishTheme.typography.ui,
            )
            if (message != null) {
                Text(
                    text = message,
                    color = FishTheme.colors.muted,
                    style = FishTheme.typography.caption,
                )
            }
        }
        if (actionLabel != null && onAction != null) {
            FishButton(
                label = actionLabel,
                onClick = onAction,
                variant = FishButtonVariant.Ghost,
            )
        }
    }
}

enum class FishNoticeTone { Neutral, Error, Warning, Success }
