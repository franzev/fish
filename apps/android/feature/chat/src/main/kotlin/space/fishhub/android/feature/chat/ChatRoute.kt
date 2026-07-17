package space.fishhub.android.feature.chat

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
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.TextRange
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
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishTextField
import space.fishhub.android.feature.presence.PresenceAccountSheet
import space.fishhub.android.feature.presence.PresenceAccountTrigger
import space.fishhub.android.feature.presence.PresenceViewModel
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.collectLatest

@Composable
fun ChatRoute(
    viewModel: ChatViewModel,
    mediaPickerViewModel: MediaPickerViewModel,
    presenceViewModel: PresenceViewModel,
    mediaCatalog: ChatMediaCatalog,
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val routeState by viewModel.uiState.collectAsStateWithLifecycle()
    val mediaPickerState by mediaPickerViewModel.uiState.collectAsStateWithLifecycle()
    val presenceState by presenceViewModel.uiState.collectAsStateWithLifecycle()
    val composerState = rememberTextFieldState()
    var mediaPickerVisible by remember { mutableStateOf(false) }
    var accountSheetVisible by remember { mutableStateOf(false) }
    val currentUserDisplayName = when (val state = routeState) {
        is ChatRouteUiState.Conversation -> state.model.currentUserDisplayName
        is ChatRouteUiState.ConversationList -> state.currentUserDisplayName
        else -> ""
    }
    val accountContent: (@Composable () -> Unit)? = currentUserDisplayName
        .takeIf(String::isNotBlank)
        ?.let { displayName ->
            {
                PresenceAccountTrigger(
                    displayName = displayName,
                    presence = presenceState.own,
                    onClick = { accountSheetVisible = true },
                )
            }
        }

    LaunchedEffect(presenceViewModel) {
        presenceViewModel.preferenceConfirmed.collectLatest {
            accountSheetVisible = false
        }
    }

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
                pendingMedia = state.pendingMedia,
                onOpenMediaPicker = { mediaPickerVisible = true },
                onRemovePendingMedia = viewModel::removePendingMedia,
                onRetryMessage = viewModel::retryMessage,
                onReportGif = viewModel::reportGif,
                onStartAudioCall = onStartAudioCall,
                onStartVideoCall = onStartVideoCall,
                participantPresence = presenceState.presentationFor(state.model.participant?.id),
                accountContent = accountContent,
                modifier = modifier,
            )
            LaunchedEffect(state.model.selectedConversationId, state.pendingGifQuery) {
                mediaPickerViewModel.restoreGifQuery(state.pendingGifQuery)
            }
            LaunchedEffect(state.model.connection) {
                mediaPickerViewModel.setOnline(
                    state.model.connection != ChatConnectionUiState.Offline,
                )
            }
        }
        is ChatRouteUiState.ConversationList -> ConversationListScreen(
            currentUserDisplayName = state.currentUserDisplayName,
            conversations = state.conversations,
            selectedConversationId = state.selectedConversationId,
            notice = state.notice,
            onSelectConversation = viewModel::selectConversation,
            accountContent = accountContent,
            modifier = modifier,
        )
    }

    if (mediaPickerVisible && routeState is ChatRouteUiState.Conversation) {
        ChatMediaPickerSheet(
            state = mediaPickerState,
            onDismiss = { mediaPickerVisible = false },
            onTabSelected = mediaPickerViewModel::selectTab,
            onQueryChanged = mediaPickerViewModel::updateQuery,
            onEmojiSelected = { emoji ->
                composerState.edit {
                    val start = selection.min
                    val end = selection.max
                    replace(start, end, emoji)
                    selection = TextRange(start + emoji.length)
                }
                mediaPickerVisible = false
            },
            onGifSelected = { gif ->
                viewModel.selectGif(gif, mediaPickerState.gifQuery)
                mediaPickerVisible = false
            },
            onStickerSelected = { sticker ->
                viewModel.selectSticker(sticker)
                mediaPickerVisible = false
            },
            onRetryGifs = mediaPickerViewModel::retryGifs,
            onLoadMoreGifs = mediaPickerViewModel::loadMoreGifs,
            onToggleGifAnimations = mediaPickerViewModel::toggleGifAnimations,
        )
    }

    if (accountSheetVisible && currentUserDisplayName.isNotBlank()) {
        PresenceAccountSheet(
            displayName = currentUserDisplayName,
            state = presenceState,
            onDismiss = { accountSheetVisible = false },
            onSetPreference = presenceViewModel::setPreference,
            onSignOut = {
                accountSheetVisible = false
                viewModel.signOut()
            },
            onClearNotice = presenceViewModel::clearNotice,
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
