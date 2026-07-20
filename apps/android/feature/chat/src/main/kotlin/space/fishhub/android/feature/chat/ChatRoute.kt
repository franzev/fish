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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.semantics.Role
import androidx.compose.material3.Text
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishTextField
import space.fishhub.android.feature.presence.PresenceAccountTrigger
import space.fishhub.android.feature.presence.PresenceUiState
import space.fishhub.android.feature.presence.PresenceViewModel
import space.fishhub.android.data.presence.PresenceConnectionState
import space.fishhub.android.data.presence.PresenceDisplayStatus
import space.fishhub.android.data.presence.PresenceDuration
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.feature.settings.AccountSettingsPresence
import space.fishhub.android.feature.settings.AccountSettingsPresenceDuration
import space.fishhub.android.feature.settings.AccountSettingsPresenceStatus
import space.fishhub.android.feature.settings.AccountSettingsPresenceVisibility
import space.fishhub.android.feature.settings.AccountSettingsBlockedPeopleState
import space.fishhub.android.feature.settings.AccountSettingsBlockedPerson
import space.fishhub.android.feature.settings.AccountSettingsSheet
import space.fishhub.android.feature.settings.AccountSettingsMotion
import space.fishhub.android.feature.settings.AccountSettingsTheme
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
    onOpenAttachment: (AttachmentOpenRequest) -> Unit = {},
    attachmentImportState: AttachmentImportUiState = AttachmentImportUiState(),
    cameraAvailable: Boolean = true,
    onChoosePhotos: (remainingSlots: Int) -> Unit = {},
    onTakePhoto: () -> Unit = {},
    onChooseFile: () -> Unit = {},
    voiceRecording: VoiceRecordingUiState = VoiceRecordingUiState(),
    voiceRecordingEnabled: Boolean = false,
    onStartVoiceRecording: () -> Unit = {},
    onFinishVoiceRecording: () -> Unit = {},
    onCancelVoiceRecording: () -> Unit = {},
    onAttachmentFlowFinished: () -> Unit = {},
    appearance: AccountSettingsTheme = AccountSettingsTheme.System,
    accessibility: AccountSettingsMotion = AccountSettingsMotion.System,
    notificationStatus: space.fishhub.android.feature.settings.AccountSettingsNotificationStatus =
        space.fishhub.android.feature.settings.AccountSettingsNotificationStatus.Off,
    canRequestNotifications: Boolean = false,
    onOpenNotifications: () -> Unit = {},
    onOpenPasswordRecovery: () -> Unit = {},
    onOpenPrivacyPolicy: () -> Unit = {},
    onAllowNotifications: () -> Unit = {},
    settingsNotice: String? = null,
    onClearSettingsNotice: () -> Unit = {},
    onAppearanceSelected: (AccountSettingsTheme) -> Unit = {},
    onAccessibilitySelected: (AccountSettingsMotion) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val routeState by viewModel.uiState.collectAsStateWithLifecycle()
    val mediaPickerState by mediaPickerViewModel.uiState.collectAsStateWithLifecycle()
    val presenceState by presenceViewModel.uiState.collectAsStateWithLifecycle()
    val blockedPeopleState by viewModel.blockedPeople.collectAsStateWithLifecycle()
    val composerState = rememberTextFieldState()
    var mediaPickerVisible by remember { mutableStateOf(false) }
    var accountSheetVisible by remember { mutableStateOf(false) }
    var attachmentSourceVisible by remember { mutableStateOf(false) }
    var selectedPhotoId by remember { mutableStateOf<String?>(null) }
    val currentUserDisplayName = when (val state = routeState) {
        is ChatRouteUiState.Conversation -> state.model.currentUserDisplayName
        is ChatRouteUiState.ConversationList -> state.currentUserDisplayName
        else -> ""
    }
    val canManageBlockedPeople = viewModel.currentUserRole ==
        space.fishhub.android.data.chat.model.UserRole.Client
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
    LaunchedEffect(viewModel, onOpenAttachment) {
        viewModel.attachmentOpenRequests.collectLatest(onOpenAttachment)
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
            onForgotPassword = onOpenPasswordRecovery,
            modifier = modifier,
        )
        is ChatRouteUiState.Conversation -> {
            val composerAttachments = state.attachmentDrafts
                .filterNot { it.inPreview }
                .sortedWith(compareBy({ it.position }, { it.id }))
            val previewAttachments = state.attachmentDrafts
                .filter { it.inPreview }
                .sortedWith(compareBy({ it.position }, { it.id }))
            ComposerStateBridge(
                state = composerState,
                protocolDraft = state.draft,
                onDraftChanged = viewModel::draftChanged,
            )
            ChatAdaptiveLayout(
                model = state.model.copy(notice = state.notice),
                composerState = composerState,
                emojiCatalog = mediaCatalog,
                onSend = viewModel::sendMessage,
                onBack = viewModel::showConversationList,
                onRetryConversation = viewModel::retryConversation,
                onRetryEarlier = viewModel::loadEarlier,
                onSelectConversation = viewModel::selectConversation,
                pendingMedia = state.pendingMedia,
                onOpenMediaPicker = { mediaPickerVisible = true },
                onRemovePendingMedia = viewModel::removePendingMedia,
                pendingAttachments = composerAttachments,
                onOpenAttachmentPicker = { attachmentSourceVisible = true },
                onRemovePendingAttachment = viewModel::removeAttachmentDraft,
                onRetryPendingAttachment = viewModel::retryAttachmentDraft,
                onRetryMessage = viewModel::retryMessage,
                onReportGif = viewModel::reportGif,
                onReplyMessage = viewModel::replyToMessage,
                onEditMessage = viewModel::editMessage,
                onDeleteMessage = viewModel::deleteMessage,
                onToggleReaction = viewModel::toggleReaction,
                onFocusMessage = viewModel::focusCurrentMessage,
                onClearReplyTarget = viewModel::clearReplyTarget,
                onRemoveFriend = viewModel::removeFriend,
                onBlockParticipant = viewModel::blockParticipant,
                onPhotoAttachmentClick = { attachmentId ->
                    selectedPhotoId = attachmentId
                    viewModel.refreshAttachment(attachmentId)
                },
                onFileAttachmentClick = viewModel::openFileAttachment,
                onAttachmentLoadError = viewModel::refreshAttachment,
                onStartAudioCall = onStartAudioCall,
                onStartVideoCall = onStartVideoCall,
                voiceRecording = voiceRecording,
                voiceRecordingEnabled = voiceRecordingEnabled,
                onStartVoiceRecording = onStartVoiceRecording,
                onFinishVoiceRecording = onFinishVoiceRecording,
                onCancelVoiceRecording = onCancelVoiceRecording,
                participantPresence = presenceState.presentationFor(state.model.participant?.id),
                accountContent = accountContent,
                modifier = modifier,
            )
            if (attachmentImportState.active || previewAttachments.isNotEmpty()) {
                AttachmentPreviewScreen(
                    attachments = previewAttachments,
                    importing = attachmentImportState.importing,
                    notice = attachmentImportState.notice,
                    onRemove = viewModel::removeAttachmentDraft,
                    onAddToMessage = {
                        viewModel.commitAttachmentPreview()
                        onAttachmentFlowFinished()
                    },
                    onDismiss = {
                        viewModel.discardAttachmentPreview()
                        onAttachmentFlowFinished()
                    },
                )
            }
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

    val attachmentConversationState = routeState as? ChatRouteUiState.Conversation
    if (attachmentSourceVisible && attachmentConversationState != null) {
        val composerCount = attachmentConversationState.attachmentDrafts.count { !it.inPreview }
        AttachmentSourceSheet(
            remainingSlots = (5 - composerCount).coerceAtLeast(0),
            cameraAvailable = cameraAvailable,
            onChoosePhotos = {
                attachmentSourceVisible = false
                onChoosePhotos((5 - composerCount).coerceAtLeast(0))
            },
            onTakePhoto = {
                attachmentSourceVisible = false
                onTakePhoto()
            },
            onChooseFile = {
                attachmentSourceVisible = false
                onChooseFile()
            },
            onDismiss = { attachmentSourceVisible = false },
        )
    }

    if (accountSheetVisible && currentUserDisplayName.isNotBlank()) {
        AccountSettingsSheet(
            displayName = currentUserDisplayName,
            presence = presenceState.toAccountSettingsPresence(),
            appearance = appearance,
            accessibility = accessibility,
            notificationStatus = notificationStatus,
            canRequestNotifications = canRequestNotifications,
            canManageBlockedPeople = canManageBlockedPeople,
            blockedPeopleState = blockedPeopleState.toAccountSettingsState(),
            onOpenNotifications = onOpenNotifications,
            onOpenPrivacyPolicy = onOpenPrivacyPolicy,
            onResetPassword = onOpenPasswordRecovery,
            onAllowNotifications = onAllowNotifications,
            notice = settingsNotice,
            onDismiss = {
                accountSheetVisible = false
                onClearSettingsNotice()
            },
            onSetPresence = { visibility, duration ->
                presenceViewModel.setPreference(
                    visibility.toPresencePreference(),
                    duration.toPresenceDuration(),
                )
            },
            onClearPresenceNotice = presenceViewModel::clearNotice,
            onClearNotice = onClearSettingsNotice,
            onLoadBlockedPeople = viewModel::loadBlockedPeople,
            onUnblockBlockedPerson = viewModel::unblockBlockedPerson,
            onAppearanceSelected = onAppearanceSelected,
            onAccessibilitySelected = onAccessibilitySelected,
            onSignOut = {
                accountSheetVisible = false
                viewModel.signOut()
            },
        )
    }

    val selectedPhoto = (routeState as? ChatRouteUiState.Conversation)
        ?.model
        ?.messages
        ?.asSequence()
        ?.flatMap { it.attachments.asSequence() }
        ?.firstOrNull { it.id == selectedPhotoId && it.kind == AttachmentUiKind.Photo }
    if (selectedPhoto != null) {
        AttachmentPhotoViewer(
            attachment = selectedPhoto,
            onDismiss = { selectedPhotoId = null },
            onLoadError = viewModel::refreshAttachment,
        )
    }
}

private fun PresenceUiState.toAccountSettingsPresence() = AccountSettingsPresence(
    status = own.status.toAccountSettingsStatus(),
    label = own.label,
    visibility = ownPreference.toAccountSettingsVisibility(),
    updating = updating,
    reconnecting = connection == PresenceConnectionState.Connecting ||
        connection == PresenceConnectionState.Disconnected,
    notice = notice,
)

private fun BlockedPeopleUiState.toAccountSettingsState(): AccountSettingsBlockedPeopleState = when (this) {
    BlockedPeopleUiState.Idle -> AccountSettingsBlockedPeopleState.Hidden
    BlockedPeopleUiState.Loading -> AccountSettingsBlockedPeopleState.Loading
    is BlockedPeopleUiState.Failed -> AccountSettingsBlockedPeopleState.Failed(message)
    is BlockedPeopleUiState.Loaded -> AccountSettingsBlockedPeopleState.Loaded(
        people = people.map { person ->
            AccountSettingsBlockedPerson(
                userId = person.userId,
                displayName = person.displayName,
                username = person.username,
            )
        },
        busyIds = busyIds,
        notice = notice,
    )
}

private fun PresenceDisplayStatus.toAccountSettingsStatus() = when (this) {
    PresenceDisplayStatus.Online -> AccountSettingsPresenceStatus.Online
    PresenceDisplayStatus.Idle -> AccountSettingsPresenceStatus.Idle
    PresenceDisplayStatus.Away -> AccountSettingsPresenceStatus.Away
    PresenceDisplayStatus.Busy -> AccountSettingsPresenceStatus.Busy
    PresenceDisplayStatus.Invisible -> AccountSettingsPresenceStatus.Invisible
    PresenceDisplayStatus.Offline -> AccountSettingsPresenceStatus.Offline
}

private fun PresencePreference.toAccountSettingsVisibility() = when (this) {
    PresencePreference.Automatic -> AccountSettingsPresenceVisibility.Automatic
    PresencePreference.Away -> AccountSettingsPresenceVisibility.Away
    PresencePreference.Busy -> AccountSettingsPresenceVisibility.Busy
    PresencePreference.Invisible -> AccountSettingsPresenceVisibility.Invisible
}

private fun AccountSettingsPresenceVisibility.toPresencePreference() = when (this) {
    AccountSettingsPresenceVisibility.Automatic -> PresencePreference.Automatic
    AccountSettingsPresenceVisibility.Away -> PresencePreference.Away
    AccountSettingsPresenceVisibility.Busy -> PresencePreference.Busy
    AccountSettingsPresenceVisibility.Invisible -> PresencePreference.Invisible
}

private fun AccountSettingsPresenceDuration.toPresenceDuration() = when (this) {
    AccountSettingsPresenceDuration.FifteenMinutes -> PresenceDuration.FifteenMinutes
    AccountSettingsPresenceDuration.OneHour -> PresenceDuration.OneHour
    AccountSettingsPresenceDuration.EightHours -> PresenceDuration.EightHours
    AccountSettingsPresenceDuration.OneDay -> PresenceDuration.OneDay
    AccountSettingsPresenceDuration.ThreeDays -> PresenceDuration.ThreeDays
    AccountSettingsPresenceDuration.Forever -> PresenceDuration.Forever
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
