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
private fun TextFieldPreview() {
    Theme {
        val colors = LocalColorTokens.current
        val space = LocalSpacingTokens.current

        Surface(color = colors.bg, contentColor = colors.body) {
            Column(
                modifier = Modifier.padding(space.lg),
                verticalArrangement = Arrangement.spacedBy(space.sm),
            ) {
                TextField(
                    label = "Email",
                    value = "you@work.com",
                    onValueChange = {},
                    hint = "Use the email your coach invited.",
                )
                TextField(
                    label = "Password",
                    value = "",
                    onValueChange = {},
                    placeholder = "Password",
                    notice = "That email and password don't match. Try again?",
                )
                TextField(
                    label = "New password",
                    value = "samepassword",
                    onValueChange = {},
                    error = "That's the same password as before. Pick a new one.",
                )
            }
        }
    }
}
