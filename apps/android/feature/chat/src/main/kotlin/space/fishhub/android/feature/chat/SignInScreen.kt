package space.fishhub.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.semantics.Role
import androidx.compose.material3.Text
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishTextField

@Composable
internal fun SignInScreen(
    state: ChatRouteUiState.SignedOut,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSignIn: () -> Unit,
    onForgotPassword: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val focusManager = LocalFocusManager.current
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .padding(FishTheme.spacing.page),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = FishTheme.sizes.conversationRail)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            FishEmptyState(
                title = stringResource(R.string.sign_in_title),
                description = stringResource(R.string.sign_in_description),
                modifier = Modifier.padding(bottom = FishTheme.spacing.sm),
            )
            FishTextField(
                value = state.email,
                onValueChange = onEmailChange,
                label = stringResource(R.string.email_label),
                placeholder = stringResource(R.string.email_placeholder),
                enabled = !state.submitting,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Next) },
                ),
            )
            FishTextField(
                value = state.password,
                onValueChange = onPasswordChange,
                label = stringResource(R.string.password_label),
                enabled = !state.submitting,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { onSignIn() }),
            )
            Text(
                text = stringResource(R.string.forgot_password),
                color = FishTheme.colors.body,
                style = FishTheme.typography.ui.copy(textDecoration = TextDecoration.Underline),
                modifier = Modifier
                    .clickable(role = Role.Button, onClick = onForgotPassword)
                    .padding(vertical = FishTheme.spacing.twoXs),
            )
            if (state.notice != null) {
                FishNotice(message = state.notice)
            }
            FishButton(
                label = stringResource(R.string.sign_in),
                onClick = onSignIn,
                modifier = Modifier.fillMaxWidth(),
                loading = state.submitting,
            )
        }
    }
}
