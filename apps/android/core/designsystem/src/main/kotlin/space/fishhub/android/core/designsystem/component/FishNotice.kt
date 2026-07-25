package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
    message: String,
    modifier: Modifier = Modifier,
    tone: FishNoticeTone = FishNoticeTone.Neutral,
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
        Text(
            text = message,
            modifier = Modifier.padding(start = FishTheme.spacing.sm),
            color = FishTheme.colors.body,
            style = FishTheme.typography.ui,
        )
    }
}

enum class FishNoticeTone { Neutral, Error, Warning, Success }
