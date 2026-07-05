package space.fishhub.app.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import space.fishhub.app.designsystem.preview.ThemePreview
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalSpacingTokens
import space.fishhub.app.designsystem.theme.Theme

@ThemePreview
@Composable
private fun ButtonPreview() {
    Theme {
        val colors = LocalColorTokens.current
        val space = LocalSpacingTokens.current

        Surface(color = colors.bg, contentColor = colors.body) {
            Column(
                modifier = Modifier.padding(space.lg),
                verticalArrangement = Arrangement.spacedBy(space.sm),
            ) {
                Button(onClick = {}) { ButtonText("Continue") }
                Button(onClick = {}, variant = ButtonVariant.Secondary) { ButtonText("Use email instead") }
                Button(onClick = {}, variant = ButtonVariant.Ghost) { ButtonText("Back") }
                Button(onClick = {}, loading = true) { ButtonText("Sending") }
            }
        }
    }
}
