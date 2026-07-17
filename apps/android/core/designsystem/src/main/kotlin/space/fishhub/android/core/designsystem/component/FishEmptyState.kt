package space.fishhub.android.core.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishEmptyState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(FishTheme.spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
    ) {
        Text(
            text = title,
            color = FishTheme.colors.foreground,
            textAlign = TextAlign.Center,
            style = FishTheme.typography.heading,
        )
        Text(
            text = description,
            color = FishTheme.colors.body,
            textAlign = TextAlign.Center,
            style = FishTheme.typography.body,
        )
        if (action != null) {
            action()
        }
    }
}
