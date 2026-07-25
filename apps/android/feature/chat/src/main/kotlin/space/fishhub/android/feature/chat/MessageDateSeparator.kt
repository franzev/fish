package space.fishhub.android.feature.chat

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun MessageDateSeparator(label: String, modifier: Modifier = Modifier) {
    Text(
        text = label,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = FishTheme.spacing.md)
            .semantics { heading() },
        color = FishTheme.colors.muted,
        textAlign = TextAlign.Center,
        style = FishTheme.typography.caption,
    )
}
