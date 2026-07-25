package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishProgress(
    progress: Float,
    contentDescription: String,
    modifier: Modifier = Modifier,
) {
    val value = progress.coerceIn(0f, 1f)
    LinearProgressIndicator(
        progress = { value },
        modifier = modifier
            .fillMaxWidth()
            .height(FishTheme.spacing.sm)
            .semantics {
                this.contentDescription = contentDescription
                progressBarRangeInfo = ProgressBarRangeInfo(value, 0f..1f)
            },
        color = FishTheme.colors.primary,
        trackColor = FishTheme.colors.surfaceAlt,
        strokeCap = androidx.compose.ui.graphics.StrokeCap.Round,
        gapSize = FishTheme.spacing.threeXs,
        drawStopIndicator = {},
    )
}
