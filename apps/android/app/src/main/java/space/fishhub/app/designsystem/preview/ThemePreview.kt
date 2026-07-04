package space.fishhub.app.designsystem.preview

import android.content.res.Configuration
import androidx.compose.ui.tooling.preview.Preview

@Preview(
    name = "Light",
    group = "Theme",
    showBackground = true,
    backgroundColor = 0xFFF8F8F8,
)
@Preview(
    name = "Dark",
    group = "Theme",
    showBackground = true,
    backgroundColor = 0xFF0B0B0B,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
annotation class ThemePreview
