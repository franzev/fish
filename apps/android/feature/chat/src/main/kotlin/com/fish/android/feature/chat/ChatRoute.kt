package com.fish.android.feature.chat

import androidx.compose.foundation.background
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
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.core.designsystem.component.FishButton
import com.fish.android.core.designsystem.component.FishEmptyState
import com.fish.android.core.designsystem.component.FishNotice
import com.fish.android.core.designsystem.component.FishTextField
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun ChatRoute(
    viewModel: ChatViewModel,
    modifier: Modifier = Modifier,
) {
    val routeState by viewModel.uiState.collectAsStateWithLifecycle()
    val composerState = rememberTextFieldState()

    when (val state = routeState) {
        ChatRouteUiState.Loading -> ChatAdaptiveLayout(
            model = ChatSamples.loading,
            composerState = composerState,
            onSend = {},
            onBack = {},
            onRetryEarlier = {},
            onSelectConversation = {},
            modifier = modifier,
        )
        is ChatRouteUiState.SignedOut -> SignInScreen(
            state = state,
            onEmailChange = viewModel::updateEmail,
            onPasswordChange = viewModel::updatePassword,
            onSignIn = viewModel::signIn,
            modifier = modifier,
        )
        is ChatRouteUiState.Conversation -> {
            ComposerStateBridge(
                state = composerState,
                protocolDraft = state.draft,
                onDraftChanged = viewModel::draftChanged,
            )
            ChatAdaptiveLayout(
                model = state.model.copy(notice = state.notice),
                composerState = composerState,
                onSend = viewModel::sendMessage,
                onBack = viewModel::showConversationList,
                onRetryConversation = viewModel::retryConversation,
                onRetryEarlier = viewModel::loadEarlier,
                onSelectConversation = viewModel::selectConversation,
                modifier = modifier,
            )
        }
        is ChatRouteUiState.ConversationList -> ConversationListScreen(
            conversations = state.conversations,
            selectedConversationId = state.selectedConversationId,
            notice = state.notice,
            onSelectConversation = viewModel::selectConversation,
            modifier = modifier,
        )
    }
}

@Composable
private fun ComposerStateBridge(
    state: TextFieldState,
    protocolDraft: String,
    onDraftChanged: (String) -> Unit,
) {
    LaunchedEffect(protocolDraft) {
        if (state.text.toString() != protocolDraft) {
            state.edit { replace(0, length, protocolDraft) }
        }
    }
    LaunchedEffect(state) {
        snapshotFlow { state.text.toString() }
            .distinctUntilChanged()
            .collect { onDraftChanged(it) }
    }
}

@Composable
internal fun SignInScreen(
    state: ChatRouteUiState.SignedOut,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSignIn: () -> Unit,
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
