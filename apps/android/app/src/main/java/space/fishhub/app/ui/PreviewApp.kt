package space.fishhub.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import space.fishhub.app.designsystem.component.Alert
import space.fishhub.app.designsystem.component.AlertTone
import space.fishhub.app.designsystem.component.Button
import space.fishhub.app.designsystem.component.ButtonText
import space.fishhub.app.designsystem.component.Card
import space.fishhub.app.designsystem.component.TextField
import space.fishhub.app.designsystem.theme.LocalColorTokens
import space.fishhub.app.designsystem.theme.LocalRadiusTokens
import space.fishhub.app.designsystem.theme.LocalSizeTokens
import space.fishhub.app.designsystem.theme.LocalTypeTokens

private enum class Screen(val label: String) {
    Login("Log in"),
    Create("Create"),
    Inbox("Inbox"),
    Forgot("Forgot"),
    Password("Password"),
    Expired("Expired"),
    Home("Home"),
}

@Composable
fun PreviewApp() {
    val colors = LocalColorTokens.current
    var selected by rememberSaveable { mutableStateOf(Screen.Login) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .background(colors.bg),
    ) {
        ScreenTabs(
            selected = selected,
            onSelected = { selected = it },
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 48.dp),
            contentAlignment = Alignment.Center,
        ) {
            when (selected) {
                Screen.Login -> LoginScreen()
                Screen.Create -> CreateAccountScreen()
                Screen.Inbox -> CheckInboxScreen()
                Screen.Forgot -> ForgotPasswordScreen()
                Screen.Password -> NewPasswordScreen()
                Screen.Expired -> ExpiredLinkScreen()
                Screen.Home -> SignedInScreen()
            }
        }
    }
}

@Composable
private fun ScreenTabs(selected: Screen, onSelected: (Screen) -> Unit) {
    val colors = LocalColorTokens.current
    val radius = LocalRadiusTokens.current
    val scrollState = rememberScrollState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.bg)
            .horizontalScroll(scrollState)
            .padding(horizontal = 12.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Screen.entries.forEach { screen ->
            val isSelected = selected == screen
            Text(
                text = screen.label,
                color = if (isSelected) colors.onPrimary else colors.body,
                style = LocalTypeTokens.current.caption,
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .border(
                        BorderStroke(1.dp, if (isSelected) colors.primary else colors.border),
                        RoundedCornerShape(radius.pill),
                    )
                    .background(
                        if (isSelected) colors.primary else colors.surface,
                        RoundedCornerShape(radius.pill),
                    )
                    .clickable { onSelected(screen) }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            )
        }
    }
}

@Composable
private fun AuthCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = LocalSizeTokens.current.content),
    ) {
        content()
    }
}

@Composable
private fun LoginScreen() {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    AuthCard {
        Heading("Log in")
        Form {
            TextField(
                label = "Email",
                value = email,
                onValueChange = { email = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            TextField(
                label = "Password",
                value = password,
                onValueChange = { password = it },
                notice = if (password == "wrong") "That email and password don't match. Try again?" else null,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(onClick = {}) {
                ButtonText("Log in")
            }
        }
        FooterLink("New here? ", "Create account")
        FooterLink("", "Forgot your password?")
    }
}

@Composable
private fun CreateAccountScreen() {
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    AuthCard {
        Heading("Create your account")
        Form {
            TextField(label = "Name", value = name, onValueChange = { name = it })
            TextField(
                label = "Email",
                value = email,
                onValueChange = { email = it },
                error = if (email == "taken@example.com") "That email's already in use. Try logging in instead?" else null,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            TextField(
                label = "Password",
                value = password,
                onValueChange = { password = it },
                hint = "At least 8 characters.",
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(onClick = {}) {
                ButtonText("Create account")
            }
        }
        FooterLink("Already have an account? ", "Log in")
    }
}

@Composable
private fun CheckInboxScreen() {
    AuthCard {
        Heading("Check your inbox")
        Body("We sent a link to you@work.com. Open it on this device to continue.")
        Spacer(Modifier.height(24.dp))
        Button(onClick = {}) {
            ButtonText("Resend the email")
        }
    }
}

@Composable
private fun ForgotPasswordScreen() {
    var email by rememberSaveable { mutableStateOf("") }

    AuthCard {
        Heading("Reset your password")
        Body("Enter the email on your account and we'll send you a reset link.")
        Form {
            TextField(
                label = "Email",
                value = email,
                onValueChange = { email = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            Button(onClick = {}) {
                ButtonText("Send reset link")
            }
        }
    }
}

@Composable
private fun NewPasswordScreen() {
    var password by rememberSaveable { mutableStateOf("") }

    AuthCard {
        Heading("Set a new password")
        Form {
            TextField(
                label = "Password",
                value = password,
                onValueChange = { password = it },
                hint = "At least 8 characters.",
                error = if (password == "samepassword") "That's the same password as before. Pick a new one." else null,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(onClick = {}) {
                ButtonText("Set new password")
            }
        }
    }
}

@Composable
private fun ExpiredLinkScreen() {
    var email by rememberSaveable { mutableStateOf("you@work.com") }

    AuthCard {
        Alert(
            tone = AlertTone.Notice,
            text = "Add your email above, then resend.",
            modifier = Modifier.padding(bottom = 16.dp),
        )
        Heading("That link has expired")
        Body("Links only work once, and this one's had its turn. Send yourself a fresh one.")
        Form {
            TextField(
                label = "Email",
                value = email,
                onValueChange = { email = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            Button(onClick = {}) {
                ButtonText("Resend the email")
            }
        }
    }
}

@Composable
private fun SignedInScreen() {
    AuthCard {
        Heading("You're signed in")
        Body("This confirms your session. Nothing else lives here yet.")
        Spacer(Modifier.height(24.dp))
        Button(onClick = {}) {
            ButtonText("Log out")
        }
    }
}

@Composable
private fun Heading(text: String) {
    Text(
        text = text,
        color = LocalColorTokens.current.foreground,
        style = LocalTypeTokens.current.heading,
    )
}

@Composable
private fun Body(text: String) {
    Text(
        text = text,
        color = LocalColorTokens.current.body,
        style = LocalTypeTokens.current.body,
        modifier = Modifier.padding(top = 12.dp),
    )
}

@Composable
private fun Form(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.padding(top = 24.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        content = content,
    )
}

@Composable
private fun FooterLink(prefix: String, link: String) {
    val colors = LocalColorTokens.current
    val type = LocalTypeTokens.current
    val copy = buildAnnotatedString {
        append(prefix)
        withStyle(
            SpanStyle(
                color = colors.body,
                textDecoration = TextDecoration.Underline,
            ),
        ) {
            append(link)
        }
    }

    Text(
        text = copy,
        color = colors.muted,
        style = type.caption,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = if (prefix.isEmpty()) 8.dp else 20.dp),
    )
}
