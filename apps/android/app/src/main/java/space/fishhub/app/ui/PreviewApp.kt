package space.fishhub.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle
import space.fishhub.app.designsystem.component.Button
import space.fishhub.app.designsystem.component.ButtonText
import space.fishhub.app.designsystem.component.TextField
import space.fishhub.app.designsystem.preview.ThemePreview
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalSpacingTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens
import space.fishhub.app.designsystem.theme.Theme

private enum class Route {
    Login,
    CreateAccount,
    CheckInbox,
    ForgotPassword,
    SetPassword,
    ExpiredLink,
    SignedIn,
}

private data class FieldSpec(
    val label: String,
    val value: String,
    val onChange: (String) -> Unit,
    val hint: String? = null,
    val notice: String? = null,
    val error: String? = null,
    val keyboardType: KeyboardType = KeyboardType.Text,
    val visualTransformation: VisualTransformation = VisualTransformation.None,
)

private data class LinkSpec(
    val text: String,
    val onClick: () -> Unit,
    val prefix: String = "",
)

private data class PageSpec(
    val title: String,
    val body: String? = null,
    val notice: String? = null,
    val fields: List<FieldSpec> = emptyList(),
    val primary: String,
    val onPrimary: () -> Unit,
    val links: List<LinkSpec> = emptyList(),
)

@Composable
fun PreviewApp() {
    var route by rememberSaveable { mutableStateOf(Route.Login) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }

    val page = pageForRoute(
        route = route,
        name = name,
        email = email,
        password = password,
        confirmPassword = confirmPassword,
        onRouteChange = { route = it },
        onNameChange = { name = it },
        onEmailChange = { email = it },
        onPasswordChange = { password = it },
        onConfirmPasswordChange = { confirmPassword = it },
    )

    AuthScreen(page)
}

private fun pageForRoute(
    route: Route,
    name: String,
    email: String,
    password: String,
    confirmPassword: String,
    onRouteChange: (Route) -> Unit,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
): PageSpec {
    val goLogin = {
        onPasswordChange("")
        onConfirmPasswordChange("")
        onRouteChange(Route.Login)
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
        Route.Login -> PageSpec(
            title = "Log in",
            fields = listOf(
                FieldSpec("Email", email, onEmailChange, keyboardType = KeyboardType.Email),
                passwordField.copy(
                    hint = null,
                    notice = if (password == "wrong") "That email and password don't match. Try again?" else null,
                ),
            ),
            primary = "Log in",
            onPrimary = { onRouteChange(Route.SignedIn) },
            links = listOf(
                LinkSpec("Create account", { onRouteChange(Route.CreateAccount) }, "New here? "),
                LinkSpec("Forgot your password?", { onRouteChange(Route.ForgotPassword) }),
            ),
        )

        Route.CreateAccount -> PageSpec(
            title = "Create your account",
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
                    error = if (confirmPassword.isNotEmpty() && confirmPassword != password) {
                        "Passwords don't match yet."
                    } else {
                        null
                    },
                ),
            ),
            primary = "Create account",
            onPrimary = { onRouteChange(Route.CheckInbox) },
            links = listOf(LinkSpec("Log in", { onRouteChange(Route.Login) }, "Already have an account? ")),
        )

        Route.CheckInbox -> PageSpec(
            title = "Check your inbox",
            body = "We sent a link to ${email.ifBlank { "you@work.com" }}. Open it on this device to continue.",
            primary = "Resend the email",
            onPrimary = {},
            links = listOf(
                LinkSpec("Back to log in", goLogin),
                LinkSpec("Preview expired link", { onRouteChange(Route.ExpiredLink) }),
            ),
        )

        Route.ForgotPassword -> PageSpec(
            title = "Reset your password",
            body = "Enter the email on your account and we'll send you a reset link.",
            fields = listOf(FieldSpec("Email", email, onEmailChange, keyboardType = KeyboardType.Email)),
            primary = "Send reset link",
            onPrimary = { onRouteChange(Route.CheckInbox) },
            links = listOf(
                LinkSpec("Preview set password", { onRouteChange(Route.SetPassword) }),
                LinkSpec("Back to log in", goLogin),
            ),
        )

        Route.SetPassword -> PageSpec(
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
            onPrimary = { onRouteChange(Route.SignedIn) },
        )

        Route.ExpiredLink -> PageSpec(
            title = "That link has expired",
            body = "Links only work once, and this one's had its turn. Send yourself a fresh one.",
            notice = "Add your email above, then resend.",
            fields = listOf(FieldSpec("Email", email, onEmailChange, keyboardType = KeyboardType.Email)),
            primary = "Resend the email",
            onPrimary = { onRouteChange(Route.CheckInbox) },
        )

        Route.SignedIn -> PageSpec(
            title = "You're signed in",
            body = "This confirms your session. Nothing else lives here yet.",
            primary = "Log out",
            onPrimary = goLogin,
        )
    }
}

@Composable
private fun AuthScreen(page: PageSpec) {
    val colors = LocalColorTokens.current
    val space = LocalSpacingTokens.current
    val size = LocalSizeTokens.current

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = colors.bg,
        contentColor = colors.body,
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding(),
        ) {
            val minContentHeight = (maxHeight - space.xxl - space.xxl).coerceAtLeast(size.control)

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = space.lg, vertical = space.xxl),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = minContentHeight),
                    contentAlignment = Alignment.Center,
                ) {
                    Page(page)
                }
            }
        }
    }
}

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
                route = Route.CreateAccount,
                name = "Franz",
                email = "taken@example.com",
                password = "learntoday",
                confirmPassword = "learnlater",
                onRouteChange = {},
                onNameChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onConfirmPasswordChange = {},
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
                route = Route.ExpiredLink,
                name = "",
                email = "you@work.com",
                password = "",
                confirmPassword = "",
                onRouteChange = {},
                onNameChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onConfirmPasswordChange = {},
            ),
        )
    }
}

@Composable
private fun Page(page: PageSpec) {
    val space = LocalSpacingTokens.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = LocalSizeTokens.current.content),
        verticalArrangement = Arrangement.spacedBy(space.lg),
    ) {
        if (page.notice != null) Notice(page.notice)
        Header(page.title, page.body)
        if (page.fields.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(space.xs)) {
                page.fields.forEach { field ->
                    TextField(
                        label = field.label,
                        value = field.value,
                        onValueChange = field.onChange,
                        hint = field.hint,
                        notice = field.notice,
                        error = field.error,
                        keyboardOptions = KeyboardOptions(keyboardType = field.keyboardType),
                        visualTransformation = field.visualTransformation,
                    )
                }
            }
        }
        Button(onClick = page.onPrimary, fullWidth = true) { ButtonText(page.primary) }
        if (page.links.isNotEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(space.sm),
            ) {
                page.links.forEach { link -> TextLink(link) }
            }
        }
    }
}

@Composable
private fun Header(title: String, body: String?) {
    val colors = LocalColorTokens.current
    val type = LocalTypeTokens.current

    Column(verticalArrangement = Arrangement.spacedBy(LocalSpacingTokens.current.sm)) {
        Text(title, color = colors.foreground, style = type.display)
        if (body != null) Text(body, color = colors.body, style = type.body)
    }
}

@Composable
private fun Notice(text: String) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val space = LocalSpacingTokens.current

    Surface(
        color = colors.surface,
        contentColor = colors.body,
        shape = RoundedCornerShape(radius.control),
    ) {
        Text(
            text = text,
            color = colors.notice,
            style = LocalTypeTokens.current.caption,
            modifier = Modifier
                .fillMaxWidth()
                .padding(space.md),
        )
    }
}

@Composable
private fun TextLink(link: LinkSpec) {
    val colors = LocalColorTokens.current
    val space = LocalSpacingTokens.current
    val interactionSource = remember { MutableInteractionSource() }
    val copy = buildAnnotatedString {
        append(link.prefix)
        withStyle(SpanStyle(color = colors.foreground, fontWeight = FontWeight.Medium)) {
            append(link.text)
        }
    }

    Text(
        text = copy,
        color = colors.muted,
        style = LocalTypeTokens.current.caption,
        modifier = Modifier
            .heightIn(min = LocalSizeTokens.current.control)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClick = link.onClick,
            )
            .padding(horizontal = space.md, vertical = space.md),
    )
}
