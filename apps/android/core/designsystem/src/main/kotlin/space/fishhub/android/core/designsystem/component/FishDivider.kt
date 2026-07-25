package space.fishhub.android.core.designsystem.component

import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import space.fishhub.android.core.designsystem.FishTheme

@Composable
fun FishDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier = modifier, color = FishTheme.colors.divider)
}
