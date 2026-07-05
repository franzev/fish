package space.fishhub.app.feature.auth

import androidx.compose.runtime.Composable
import space.fishhub.app.designsystem.preview.ThemePreview
import space.fishhub.app.designsystem.theme.Theme

@ThemePreview
@Composable
private fun AuthFlowPreview() {
    Theme {
        PreviewApp()
    }
}

@ThemePreview
@Composable
private fun CreateAccountErrorPreview() {
    Theme {
        AuthScreen(
            pageForRoute(
                route = AuthRoute.CreateAccount,
                name = "Franz",
                email = "taken@example.com",
                password = "learntoday",
                confirmPassword = "learnlater",
                authNotice = null,
                onRouteChange = {},
                onNameChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onConfirmPasswordChange = {},
                onGoogleSignIn = {},
                onSignOut = {},
            ),
        )
    }
}

@ThemePreview
@Composable
private fun ExpiredLinkPreview() {
    Theme {
        AuthScreen(
            pageForRoute(
                route = AuthRoute.ExpiredLink,
                name = "",
                email = "you@work.com",
                password = "",
                confirmPassword = "",
                authNotice = null,
                onRouteChange = {},
                onNameChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onConfirmPasswordChange = {},
                onGoogleSignIn = {},
                onSignOut = {},
            ),
        )
    }
}
