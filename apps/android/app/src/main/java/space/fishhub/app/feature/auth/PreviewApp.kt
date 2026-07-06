package space.fishhub.app.feature.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import space.fishhub.app.core.auth.OAuthCallbackResult
import space.fishhub.app.feature.app.AppShell

@Composable
internal fun PreviewApp(
    onGoogleSignIn: () -> Unit = {},
    onSignOut: () -> Unit = {},
    googleAuthResult: OAuthCallbackResult? = null,
    hasStoredAuthSession: Boolean = false,
) {
    var route by rememberSaveable { mutableStateOf(AuthRoute.Login) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var authNotice by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(googleAuthResult, hasStoredAuthSession) {
        when (googleAuthResult) {
            is OAuthCallbackResult.Failure -> authNotice = googleAuthResult.message
            is OAuthCallbackResult.Success -> {
                authNotice = null
                route = AuthRoute.SignedIn
            }
            null -> {
                if (hasStoredAuthSession) {
                    route = AuthRoute.SignedIn
                }
            }
        }
    }

    if (route == AuthRoute.SignedIn) {
        AppShell(
            displayName = name.ifBlank { "Alex Rivera" },
            coachName = "Maya Chen",
            onSignOut = {
                authNotice = null
                password = ""
                confirmPassword = ""
                onSignOut()
                route = AuthRoute.Login
            },
        )
        return
    }

    val page = pageForRoute(
        route = route,
        name = name,
        email = email,
        password = password,
        confirmPassword = confirmPassword,
        authNotice = authNotice,
        onRouteChange = { route = it },
        onNameChange = { name = it },
        onEmailChange = { email = it },
        onPasswordChange = { password = it },
        onConfirmPasswordChange = { confirmPassword = it },
        onGoogleSignIn = onGoogleSignIn,
        onSignOut = {
            authNotice = null
            onSignOut()
        },
    )

    AuthScreen(page)
}
