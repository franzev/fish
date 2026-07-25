package space.fishhub.android.feature.chat

import android.content.ClipData
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.toClipEntry
import androidx.compose.ui.text.TextRange
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatDataModule
import space.fishhub.android.data.chat.ChatRealtimeEvent
import space.fishhub.android.data.presence.PresenceConnectionState
import space.fishhub.android.data.presence.PresenceDisplayStatus
import space.fishhub.android.data.presence.PresenceDuration
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.feature.chat.logic.ChatMediaCatalog
import space.fishhub.android.feature.chat.model.AttachmentImportUiState
import space.fishhub.android.feature.chat.model.AttachmentOpenRequest
import space.fishhub.android.feature.chat.model.AttachmentUiKind
import space.fishhub.android.feature.chat.model.BlockedPeopleUiState
import space.fishhub.android.feature.chat.model.ChatConnectionUiState
import space.fishhub.android.feature.chat.model.ChatRouteUiState
import space.fishhub.android.feature.chat.model.ParticipantUiModel
import space.fishhub.android.feature.chat.model.VoiceRecordingUiState
import space.fishhub.android.feature.chat.screens.AttachmentPreviewScreen
import space.fishhub.android.feature.chat.screens.ChatAdaptiveLayout
import space.fishhub.android.feature.chat.screens.ConversationListScreen
import space.fishhub.android.feature.chat.screens.MessageSearchScreen
import space.fishhub.android.feature.chat.screens.SignInScreen
import space.fishhub.android.feature.chat.sharedcontent.SharedContentAcceptedItem
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryPresenter
import space.fishhub.android.feature.chat.sharedcontent.SharedContentGalleryScreen
import space.fishhub.android.feature.chat.sharedcontent.SharedContentNativeAction
import space.fishhub.android.feature.chat.sharedcontent.SharedContentNativeActionResult
import space.fishhub.android.feature.chat.sharedcontent.SharedContentOrigin
import space.fishhub.android.feature.chat.sharedcontent.SharedContentPreviewItem
import space.fishhub.android.feature.chat.sharedcontent.SharedContentPreviewScreen
import space.fishhub.android.feature.chat.sharedcontent.SharedContentStore
import space.fishhub.android.feature.chat.sharedcontent.SharedContentVisibilityPort
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentDeliveryBatch
import space.fishhub.android.feature.chat.sharedcontent.state.SharedContentNetworkPolicy
import space.fishhub.android.feature.chat.sharedcontent.toPreviewItem
import space.fishhub.android.feature.chat.viewmodels.ChatViewModel
import space.fishhub.android.feature.chat.viewmodels.MediaPickerViewModel
import space.fishhub.android.feature.chat.viewmodels.MessageSearchViewModel
import space.fishhub.android.feature.chat.views.AttachmentSourceSheet
import space.fishhub.android.feature.chat.views.AttachmentViewer
import space.fishhub.android.feature.chat.views.mediapicker.MediaPickerSheet
import space.fishhub.android.feature.presence.PresenceAccountTrigger
import space.fishhub.android.feature.presence.PresenceUiState
import space.fishhub.android.feature.presence.PresenceViewModel
import space.fishhub.android.feature.settings.model.AccountSettingsBlockedPeopleState
import space.fishhub.android.feature.settings.model.AccountSettingsBlockedPerson
import space.fishhub.android.feature.settings.model.AccountSettingsMotion
import space.fishhub.android.feature.settings.model.AccountSettingsPresence
import space.fishhub.android.feature.settings.model.AccountSettingsPresenceDuration
import space.fishhub.android.feature.settings.model.AccountSettingsPresenceStatus
import space.fishhub.android.feature.settings.model.AccountSettingsPresenceVisibility
import space.fishhub.android.feature.settings.views.AccountSettingsSheet
import space.fishhub.android.feature.settings.model.AccountSettingsTheme

@Composable
fun ChatRoute(
    viewModel: ChatViewModel,
    mediaPickerViewModel: MediaPickerViewModel,
    messageSearchViewModel: MessageSearchViewModel,
    presenceViewModel: PresenceViewModel,
    mediaCatalog: ChatMediaCatalog,
    onStartAudioCall: (ParticipantUiModel) -> Unit = {},
    onStartVideoCall: (ParticipantUiModel) -> Unit = {},
    onCallBack: (String) -> Unit = {},
    onOpenAttachment: (AttachmentOpenRequest) -> Unit = {},
    onSharedContentAction: suspend (
        space.fishhub.android.feature.chat.sharedcontent.SharedContentPreviewItem,
        SharedContentNativeAction,
        ChatDataModule.SharedContentVerifiedContent?,
    ) -> SharedContentNativeActionResult = { _, _, _ ->
        SharedContentNativeActionResult.Started
    },
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
    motion: AccountSettingsMotion = AccountSettingsMotion.System,
    notificationStatus: space.fishhub.android.feature.settings.model.AccountSettingsNotificationStatus =
        space.fishhub.android.feature.settings.model.AccountSettingsNotificationStatus.Off,
    canRequestNotifications: Boolean = false,
    onOpenNotificationSettings: () -> Unit = {},
    onOpenPasswordRecovery: () -> Unit = {},
    onOpenPrivacyPolicy: () -> Unit = {},
    onAllowNotifications: () -> Unit = {},
    settingsNotice: String? = null,
    onClearSettingsNotice: () -> Unit = {},
    onSetAppearance: (AccountSettingsTheme) -> Unit = {},
    onSetMotion: (AccountSettingsMotion) -> Unit = {},
    sharedContentRuntime: ChatDataModule.SharedContentGalleryRuntime,
    onSharedContentStoreChanged: (SharedContentStore?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val clipboard = LocalClipboard.current
    val clipboardScope = rememberCoroutineScope()
    val routeState by viewModel.uiState.collectAsStateWithLifecycle()
    val mediaPickerState by mediaPickerViewModel.uiState.collectAsStateWithLifecycle()
    val messageSearchState by messageSearchViewModel.uiState.collectAsStateWithLifecycle()
    val presenceState by presenceViewModel.uiState.collectAsStateWithLifecycle()
    val blockedPeopleState by viewModel.blockedPeople.collectAsStateWithLifecycle()
    val composerState = rememberTextFieldState()
    val selectedConversationId = (routeState as? ChatRouteUiState.Conversation)
        ?.model
        ?.selectedConversationId
    var mediaPickerVisible by remember { mutableStateOf(false) }
    var accountSheetVisible by remember { mutableStateOf(false) }
    var attachmentSourceVisible by remember { mutableStateOf(false) }
    var selectedPhotoId by remember { mutableStateOf<String?>(null) }
    var participantDetailsVisible by remember(selectedConversationId) { mutableStateOf(false) }
    var sharedContentOrigin by remember(selectedConversationId) {
        mutableStateOf<SharedContentOrigin?>(null)
    }
    var sharedContentReturnOrigin by remember(selectedConversationId) {
        mutableStateOf<SharedContentOrigin?>(null)
    }
    var sharedContentSessionActive by remember(selectedConversationId) {
        mutableStateOf(false)
    }
    var sharedContentPreviewId by remember(selectedConversationId) {
        mutableStateOf<String?>(null)
    }
    var sharedContentEntry by remember(selectedConversationId) { mutableIntStateOf(0) }
    var focusReturn by remember(selectedConversationId) {
        mutableStateOf(SharedContentFocusReturn.None)
    }
    val sharedContentHeaderFocus = remember(selectedConversationId) { FocusRequester() }
    val participantDetailsFocus = remember(selectedConversationId) { FocusRequester() }
    val sharedContentIdentity by sharedContentRuntime.repository.sharedContentIdentity
        .collectAsStateWithLifecycle()
    val currentUserDisplayName = when (val state = routeState) {
        is ChatRouteUiState.Conversation -> state.model.currentUserDisplayName
        is ChatRouteUiState.ConversationList -> state.currentUserDisplayName
        else -> ""
    }
    val currentConversation = viewModel.currentConversation
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
    LaunchedEffect(selectedConversationId) {
        // Search is intentionally session-only and must not follow a different conversation.
        messageSearchViewModel.close()
        sharedContentOrigin = null
        sharedContentReturnOrigin = null
        sharedContentSessionActive = false
        sharedContentPreviewId = null
        participantDetailsVisible = false
        focusReturn = SharedContentFocusReturn.None
    }
    LaunchedEffect(sharedContentOrigin, participantDetailsVisible, focusReturn) {
        if (sharedContentOrigin != null || focusReturn == SharedContentFocusReturn.None) return@LaunchedEffect
        withFrameNanos { }
        when (focusReturn) {
            SharedContentFocusReturn.HeaderSharedContent -> sharedContentHeaderFocus.requestFocus()
            SharedContentFocusReturn.DetailsSharedContent -> Unit
            SharedContentFocusReturn.ParticipantDetails -> participantDetailsFocus.requestFocus()
            SharedContentFocusReturn.None -> Unit
        }
        focusReturn = SharedContentFocusReturn.None
    }

    val galleryKey = sharedContentSessionActive.let {
        if (!it) return@let null
        val owner = sharedContentIdentity.ownerIdentityId
        val conversation = selectedConversationId
        if (sharedContentIdentity.isGalleryEligible && owner != null && conversation != null) {
            SharedContentSessionKey(
                ownerIdentityId = owner,
                conversationId = conversation,
                identityGeneration = sharedContentIdentity.generation.value,
                entry = sharedContentEntry,
            )
        } else {
            null
        }
    }
    val galleryScope = rememberCoroutineScope()
    val gallerySession = remember(galleryKey, sharedContentRuntime) {
        galleryKey?.let { key ->
            lateinit var store: SharedContentStore
            val visibilityPort = object : SharedContentVisibilityPort {
                override suspend fun submit(batch: SharedContentDeliveryBatch) {
                    val requests = store.acceptedItems.value
                        .filter { it.itemId in batch.ids }
                        .mapNotNull { item ->
                            item.thumbnailRequest(key, mediaCatalog)
                        }
                    sharedContentRuntime.prefetchThumbnails(requests)
                }

                override fun confirmThumbnailDisplayed(
                    itemId: String,
                    contentVersion: String,
                ): Boolean = sharedContentRuntime.confirmDisplayed(
                    ownerIdentityId = key.ownerIdentityId,
                    conversationId = key.conversationId,
                    itemId = itemId,
                    contentVersion = contentVersion,
                )
            }
            store = SharedContentStore(
                repository = sharedContentRuntime.repository,
                scope = galleryScope,
                visibilityPort = visibilityPort,
            )
            SharedContentSession(
                key = key,
                store = store,
                presenter = SharedContentGalleryPresenter(
                    store = store,
                    scope = galleryScope,
                    onSelectItem = { sharedContentPreviewId = it },
                ),
            )
        }
    }
    val galleryItems = gallerySession?.store?.acceptedItems
        ?.collectAsStateWithLifecycle()
        ?.value
        ?: emptyList()
    DisposableEffect(gallerySession) {
        gallerySession?.let { onSharedContentStoreChanged(it.store) }
        onDispose {
            gallerySession?.close()
            if (gallerySession != null) onSharedContentStoreChanged(null)
        }
    }
    LaunchedEffect(gallerySession) {
        gallerySession?.let { session ->
            session.store.bind(
                ownerIdentityId = session.key.ownerIdentityId,
                conversationId = session.key.conversationId,
                verifiedIdentityGeneration = session.key.identityGeneration,
            )
            session.store.open()
        }
    }
    LaunchedEffect(gallerySession) {
        val session = gallerySession ?: return@LaunchedEffect
        sharedContentRuntime.repository.observeRealtime(session.key.conversationId).collect { event ->
            if (event is ChatRealtimeEvent.MessageChanged) session.store.realtime()
        }
    }
    LaunchedEffect(
        gallerySession,
        (routeState as? ChatRouteUiState.Conversation)?.model?.connection,
    ) {
        val session = gallerySession ?: return@LaunchedEffect
        val online = (routeState as? ChatRouteUiState.Conversation)
            ?.model
            ?.connection != ChatConnectionUiState.Offline
        session.store.connectivity(
            SharedContentNetworkPolicy(
                networkUsable = online,
                lookaheadAllowed = online,
            ),
        )
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        gallerySession?.store?.background()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        gallerySession?.store?.foreground()
    }
    LaunchedEffect(sharedContentOrigin, gallerySession) {
        if (sharedContentOrigin != null && gallerySession == null) {
            sharedContentOrigin = null
            participantDetailsVisible = false
            focusReturn = SharedContentFocusReturn.None
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
            val galleryOrigin = sharedContentOrigin
            if (galleryOrigin != null && gallerySession != null) {
                val session = gallerySession
                val previewItem = sharedContentPreviewId?.let { id ->
                    val acceptedItem = galleryItems
                        .firstOrNull { it.itemId == id }
                    acceptedItem?.toPreviewItem(
                        senderName = sharedContentSenderName(
                            acceptedItem,
                            currentUserDisplayName,
                            currentConversation,
                        ),
                    )
                }
                if (previewItem != null) {
                    SharedContentPreviewScreen(
                        item = previewItem,
                        onBack = { sharedContentPreviewId = null },
                        onOpenSource = { messageId ->
                            sharedContentReturnOrigin = galleryOrigin
                            sharedContentPreviewId = null
                            sharedContentOrigin = null
                            viewModel.focusCurrentMessage(messageId)
                        },
                        onNativeAction = { action ->
                            val attachmentAction = action in setOf(
                                SharedContentNativeAction.Share,
                                SharedContentNativeAction.Save,
                                SharedContentNativeAction.Download,
                                SharedContentNativeAction.Open,
                            )
                            val opensAttachment = action == SharedContentNativeAction.Open &&
                                previewItem.kind in setOf("video", "document", "voice")
                            val needsVerifiedContent = previewItem.attachmentId != null &&
                                attachmentAction &&
                                (previewItem.canTransfer || opensAttachment)
                            val verified = if (needsVerifiedContent) {
                                previewItem.attachmentId.let { attachmentId ->
                                    previewItem.byteSize?.let { byteSize ->
                                        sharedContentRuntime.loadVerifiedContent(
                                            ChatDataModule.SharedContentFullContentRequest(
                                                ownerIdentityId = session.key.ownerIdentityId,
                                                conversationId = session.key.conversationId,
                                                identityGeneration = session.key.identityGeneration,
                                                attachmentId = attachmentId,
                                                name = previewItem.originalName ?: previewItem.title,
                                                mimeType = previewItem.mimeType ?: "application/octet-stream",
                                                expectedByteSize = byteSize,
                                            ),
                                        )
                                    }
                                }
                            } else {
                                null
                            }
                            if (needsVerifiedContent && verified == null) {
                                SharedContentNativeActionResult.Unavailable
                            } else {
                                onSharedContentAction(previewItem, action, verified)
                            }
                        },
                        onDelete = { messageId ->
                            viewModel.deleteSharedContentSource(messageId) { session.store.realtime() }
                        },
                        modifier = modifier,
                        thumbnailLoader = { handle ->
                            val item = galleryItems.firstOrNull { it.itemId == handle.itemId }
                            item?.thumbnailRequest(session.key, mediaCatalog)
                                ?.let { sharedContentRuntime.loadThumbnail(it) }
                        },
                    )
                } else {
                    SharedContentGalleryScreen(
                        presenter = gallerySession.presenter,
                        onBack = {
                            session.close()
                            onSharedContentStoreChanged(null)
                            sharedContentSessionActive = false
                            sharedContentPreviewId = null
                            sharedContentOrigin = null
                            focusReturn = when (galleryOrigin) {
                                SharedContentOrigin.ConversationHeader ->
                                    SharedContentFocusReturn.HeaderSharedContent
                                SharedContentOrigin.ConversationDetails ->
                                    SharedContentFocusReturn.DetailsSharedContent
                            }
                        },
                        modifier = modifier,
                        thumbnailLoader = { handle ->
                            val item = galleryItems.firstOrNull { it.itemId == handle.itemId }
                            val request = item?.thumbnailRequest(session.key, mediaCatalog)
                            request?.let { sharedContentRuntime.loadThumbnail(it) }
                        },
                    )
                }
            } else if (messageSearchState.visible && currentConversation != null) {
                MessageSearchScreen(
                    state = messageSearchState,
                    onQueryChanged = messageSearchViewModel::updateQuery,
                    onSubmitQuery = messageSearchViewModel::submitQuery,
                    onRetry = messageSearchViewModel::retry,
                    onLoadMore = messageSearchViewModel::loadMore,
                    onResultSelected = { messageId ->
                        messageSearchViewModel.close()
                        viewModel.focusCurrentMessage(messageId)
                    },
                    onClose = messageSearchViewModel::close,
                    modifier = modifier,
                )
            } else {
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
                    onCopyMessage = { body ->
                        clipboardScope.launch {
                            clipboard.setClipEntry(ClipData.newPlainText("message", body).toClipEntry())
                        }
                    },
                    onReportGif = viewModel::reportGif,
                    onReplyMessage = viewModel::replyToMessage,
                    onEditMessage = viewModel::editMessage,
                    onDeleteMessage = viewModel::deleteMessage,
                    onToggleReaction = viewModel::toggleReaction,
                    onFocusMessage = viewModel::focusCurrentMessage,
                    onOpenMessageSearch = {
                        currentConversation?.let(messageSearchViewModel::open)
                    },
                    onOpenSharedContentFromHeader = {
                        participantDetailsVisible = false
                        sharedContentEntry += 1
                        sharedContentSessionActive = true
                        sharedContentOrigin = SharedContentOrigin.ConversationHeader
                    },
                    onOpenSharedContentFromDetails = {
                        sharedContentEntry += 1
                        sharedContentSessionActive = true
                        sharedContentOrigin = SharedContentOrigin.ConversationDetails
                    },
                    participantDetailsVisible = participantDetailsVisible,
                    onOpenParticipantDetails = {
                        participantDetailsVisible = true
                    },
                    onDismissParticipantDetails = {
                        participantDetailsVisible = false
                        focusReturn = SharedContentFocusReturn.ParticipantDetails
                    },
                    sharedContentHeaderModifier = Modifier.focusRequester(
                        sharedContentHeaderFocus,
                    ),
                    sharedContentDetailsFocusRequested =
                        focusReturn == SharedContentFocusReturn.DetailsSharedContent,
                    participantDetailsModifier = Modifier.focusRequester(
                        participantDetailsFocus,
                    ),
                    onClearReplyTarget = viewModel::clearReplyTarget,
                    onRemoveFriend = viewModel::removeFriend,
                    onBlockParticipant = viewModel::blockParticipant,
                    onSetQuiet = viewModel::setQuiet,
                    onPhotoAttachmentClick = { attachmentId ->
                        selectedPhotoId = attachmentId
                        viewModel.refreshAttachment(attachmentId)
                    },
                    onFileAttachmentClick = viewModel::openFileAttachment,
                    onFileAttachmentShare = viewModel::shareFileAttachment,
                    onAttachmentLoadError = viewModel::refreshAttachment,
                    onStartAudioCall = onStartAudioCall,
                    onStartVideoCall = onStartVideoCall,
                    onCallBack = onCallBack,
                    voiceRecording = voiceRecording,
                    voiceRecordingEnabled = voiceRecordingEnabled,
                    onStartVoiceRecording = onStartVoiceRecording,
                    onFinishVoiceRecording = onFinishVoiceRecording,
                    onCancelVoiceRecording = onCancelVoiceRecording,
                    participantPresence = presenceState.presentationFor(state.model.participant?.id),
                    accountContent = accountContent,
                    modifier = modifier,
                )
            }
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

    BackHandler(
        enabled = sharedContentSessionActive && sharedContentOrigin == null,
    ) {
        sharedContentOrigin = sharedContentReturnOrigin ?: SharedContentOrigin.ConversationHeader
        sharedContentReturnOrigin = null
    }

    if (mediaPickerVisible && routeState is ChatRouteUiState.Conversation) {
        MediaPickerSheet(
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
            motion = motion,
            notificationStatus = notificationStatus,
            canRequestNotifications = canRequestNotifications,
            canManageBlockedPeople = canManageBlockedPeople,
            blockedPeopleState = blockedPeopleState.toAccountSettingsState(),
            onOpenNotificationSettings = onOpenNotificationSettings,
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
            onUnblock = viewModel::unblockBlockedPerson,
            onSetAppearance = onSetAppearance,
            onSetMotion = onSetMotion,
            onSignOut = {
                accountSheetVisible = false
                viewModel.signOut()
            },
        )
    }

    // The viewer pages across the photos of the message that was tapped, so the
    // gallery is scoped the same way FishKit scopes it.
    val selectedPhotoGroup = (routeState as? ChatRouteUiState.Conversation)
        ?.model
        ?.messages
        ?.asSequence()
        ?.map { message -> message.attachments.filter { it.kind == AttachmentUiKind.Photo } }
        ?.firstOrNull { photos -> photos.any { it.id == selectedPhotoId } }
        .orEmpty()
    if (selectedPhotoGroup.isNotEmpty()) {
        AttachmentViewer(
            images = selectedPhotoGroup,
            initialIndex = selectedPhotoGroup.indexOfFirst { it.id == selectedPhotoId },
            onDismiss = { selectedPhotoId = null },
            onLoadError = viewModel::refreshAttachment,
        )
    }
}

private enum class SharedContentFocusReturn {
    None,
    HeaderSharedContent,
    DetailsSharedContent,
    ParticipantDetails,
}

private data class SharedContentSessionKey(
    val ownerIdentityId: String,
    val conversationId: String,
    val identityGeneration: Long,
    val entry: Int,
)

private fun sharedContentSenderName(
    item: space.fishhub.android.feature.chat.sharedcontent.SharedContentAcceptedItem,
    currentUserDisplayName: String,
    conversation: AuthorizedConversation?,
): String = when {
    item.senderId.isNotBlank() && item.senderId == conversation?.currentUserId ->
        currentUserDisplayName
    item.senderId.isNotBlank() && item.senderId == conversation?.participantId ->
        conversation.participantDisplayName
    item.senderId.isNotBlank() -> item.senderId
    else -> "Sender unavailable"
}

private fun space.fishhub.android.feature.chat.sharedcontent.SharedContentAcceptedItem
    .thumbnailRequest(
        key: SharedContentSessionKey,
        mediaCatalog: ChatMediaCatalog,
    ): ChatDataModule.SharedContentThumbnailRequest? {
    if (category != "media") return null
    return ChatDataModule.SharedContentThumbnailRequest(
        ownerIdentityId = key.ownerIdentityId,
        conversationId = key.conversationId,
        identityGeneration = key.identityGeneration,
        itemId = itemId,
        contentVersion = contentVersion,
        kind = kind,
        attachmentId = attachmentId,
        sourceMessageId = sourceMessageId,
        stickerAssetPath = stickerId?.let(mediaCatalog::sticker)?.assetPath,
    )
}

private data class SharedContentSession(
    val key: SharedContentSessionKey,
    val store: SharedContentStore,
    val presenter: SharedContentGalleryPresenter,
) {
    fun close() {
        presenter.close()
        store.close()
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
