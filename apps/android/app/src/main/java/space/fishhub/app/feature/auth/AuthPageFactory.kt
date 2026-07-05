package space.fishhub.app.feature.auth

import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation

internal fun pageForRoute(
    route: AuthRoute,
    name: String,
    email: String,
    password: String,
    confirmPassword: String,
    authNotice: String?,
    onRouteChange: (AuthRoute) -> Unit,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onGoogleSignIn: () -> Unit,
    onSignOut: () -> Unit,
): PageSpec {
    val goLogin = {
        onPasswordChange("")
        onConfirmPasswordChange("")
        onSignOut()
        onRouteChange(AuthRoute.Login)
    }
    val passwordField = FieldSpec(
        label = "Password",
        value = password,
        onChange = onPasswordChange,
        hint = "At least 8 characters.",
        keyboardType = KeyboardType.Password,
        visualTransformation = PasswordVisualTransformation(),
    )
    val confirmPasswordField = FieldSpec(
        label = "Confirm password",
        value = confirmPassword,
        onChange = onConfirmPasswordChange,
        keyboardType = KeyboardType.Password,
        visualTransformation = PasswordVisualTransformation(),
    )

    return when (route) {
        AuthRoute.Login -> PageSpec(
            title = "Log in",
            notice = authNotice,
            fields = listOf(
                FieldSpec("Email", email, onEmailChange, keyboardType = KeyboardType.Email),
                passwordField.copy(
                    hint = null,
                    notice = if (password == "wrong") "That email and password don't match. Try again?" else null,
                ),
            ),
            primary = "Log in",
            onPrimary = { onRouteChange(AuthRoute.SignedIn) },
            secondary = GoogleSignInLabel,
            onSecondary = onGoogleSignIn,
            links = listOf(
                LinkSpec("Create account", { onRouteChange(AuthRoute.CreateAccount) }, "New here? "),
                LinkSpec("Forgot your password?", { onRouteChange(AuthRoute.ForgotPassword) }),
            ),
        )

        AuthRoute.CreateAccount -> PageSpec(
            title = "Create your account",
            notice = authNotice,
            fields = listOf(
                FieldSpec("Name", name, onNameChange),
                FieldSpec(
                    label = "Email",
                    value = email,
                    onChange = onEmailChange,
                    error = if (email == "taken@example.com") {
                        "That email's already in use. Try logging in instead?"
                    } else {
                        null
                    },
                    keyboardType = KeyboardType.Email,
                ),
                passwordField,
                confirmPasswordField.copy(
                    error = confirmPasswordError(password, confirmPassword),
                ),
            ),
            primary = "Create account",
            onPrimary = {
                if (canCreateAccountWithPassword(password, confirmPassword)) {
                    onRouteChange(AuthRoute.CheckInbox)
                }
            },
            secondary = GoogleSignUpLabel,
            onSecondary = onGoogleSignIn,
            links = listOf(LinkSpec("Log in", { onRouteChange(AuthRoute.Login) }, "Already have an account? ")),
        )

        AuthRoute.CheckInbox -> PageSpec(
            title = "Check your inbox",
            body = "We sent a link to ${email.ifBlank { "you@work.com" }}. Open it on this device to continue.",
            primary = "Resend the email",
            onPrimary = {},
            links = listOf(
                LinkSpec("Back to log in", goLogin),
                LinkSpec("Preview expired link", { onRouteChange(AuthRoute.ExpiredLink) }),
            ),
        )

        AuthRoute.ForgotPassword -> PageSpec(
            title = "Reset your password",
            body = "Enter the email on your account and we'll send you a reset link.",
            fields = listOf(FieldSpec("Email", email, onEmailChange, keyboardType = KeyboardType.Email)),
            primary = "Send reset link",
            onPrimary = { onRouteChange(AuthRoute.CheckInbox) },
            links = listOf(
                LinkSpec("Preview set password", { onRouteChange(AuthRoute.SetPassword) }),
                LinkSpec("Back to log in", goLogin),
            ),
        )

        AuthRoute.SetPassword -> PageSpec(
            title = "Set a new password",
            fields = listOf(
                passwordField.copy(
                    error = if (password == "samepassword") {
                        "That's the same password as before. Pick a new one."
                    } else {
                        null
                    },
                ),
            ),
            primary = "Set new password",
            onPrimary = { onRouteChange(AuthRoute.SignedIn) },
        )

        AuthRoute.ExpiredLink -> PageSpec(
            title = "That link has expired",
            body = "Links only work once, and this one's had its turn. Send yourself a fresh one.",
            notice = "Add your email above, then resend.",
            fields = listOf(FieldSpec("Email", email, onEmailChange, keyboardType = KeyboardType.Email)),
            primary = "Resend the email",
            onPrimary = { onRouteChange(AuthRoute.CheckInbox) },
        )

        AuthRoute.SignedIn -> PageSpec(
            title = "You're signed in",
            body = "This confirms your session. Nothing else lives here yet.",
            primary = "Log out",
            onPrimary = goLogin,
        )
    }
}
