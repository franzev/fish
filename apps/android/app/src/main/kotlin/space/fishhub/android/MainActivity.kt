package space.fishhub.android

import android.Manifest
import android.os.Bundle
import android.os.SystemClock
import android.animation.ValueAnimator
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import android.view.KeyEvent
import android.view.MotionEvent
import android.util.Rational
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import space.fishhub.android.calling.CallIntents
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.chat.ChatAuthState
import space.fishhub.android.data.chat.AttachmentImportKind
import space.fishhub.android.data.chat.AttachmentImportSource
import space.fishhub.android.feature.call.CallRoute
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.chat.AndroidChatFormatter
import space.fishhub.android.feature.chat.ChatRoute
import space.fishhub.android.feature.chat.ChatViewModel
import space.fishhub.android.feature.chat.AttachmentImportUiState
import space.fishhub.android.feature.chat.ChatMediaCatalog
import space.fishhub.android.feature.chat.MediaPickerViewModel
import space.fishhub.android.feature.chat.MessageSearchViewModel
import space.fishhub.android.feature.chat.ParticipantUiModel
import space.fishhub.android.feature.chat.VoiceRecordingUiState
import space.fishhub.android.feature.presence.PresenceFormatter
import space.fishhub.android.feature.presence.PresenceViewModel
import space.fishhub.android.feature.settings.AccountSettingsMotion
import space.fishhub.android.feature.settings.AccountSettingsNotificationStatus
import space.fishhub.android.feature.settings.AccountSettingsTheme
import space.fishhub.android.messaging.ChatDestination
import space.fishhub.android.messaging.ChatIntents
import space.fishhub.android.messaging.ChatShareContent
import space.fishhub.android.messaging.ChatShareIntents
import space.fishhub.android.messaging.ChatNotificationFactory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import space.fishhub.android.settings.AppMotionPreference
import space.fishhub.android.settings.AppPreferences
import space.fishhub.android.settings.AppThemePreference
import space.fishhub.android.settings.effectiveReducedMotion
import space.fishhub.android.settings.isDark

class MainActivity : ComponentActivity() {
    private lateinit var fishApplication: FishApplication
    private var pendingPermissionAction: PendingPermissionAction? = null
    private val minimized = MutableStateFlow(false)
    private val pictureInPicture = MutableStateFlow(false)
    private var activeVideoCall = false
    private val attachmentImportState = MutableStateFlow(AttachmentImportUiState())
    private val pendingChatDestination = MutableStateFlow<ChatDestination?>(null)
    private val pendingShareContent = MutableStateFlow<ChatShareContent?>(null)
    private val systemDisabledAnimations = MutableStateFlow(!ValueAnimator.areAnimatorsEnabled())
    private val preferenceNotice = MutableStateFlow<String?>(null)
    private val notificationStatus = MutableStateFlow(AccountSettingsNotificationStatus.Off)
    private val canRequestNotifications = MutableStateFlow(false)
    private var attachmentConversationId: String? = null
    private var pendingCameraFile: File? = null
    private var pendingCameraUri: Uri? = null
    private lateinit var attachmentFileOpener: AttachmentFileOpener
    private lateinit var voiceMessageRecorder: VoiceMessageRecorder
    private val voiceRecordingState = MutableStateFlow(VoiceRecordingUiState())
    private var voiceRecordingTicker: kotlinx.coroutines.Job? = null
    private var voiceRecordingStartedAt = 0L

    private val photoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MaxMessageAttachments),
    ) { uris ->
        importAttachmentUris(uris, AttachmentImportKind.Image)
    }
    private val documentPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        importAttachmentUris(uris, AttachmentImportKind.File, releasePersistableAccess = true)
    }
    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { captured ->
        val uri = pendingCameraUri
        if (captured && uri != null) {
            importAttachmentUris(listOf(uri), AttachmentImportKind.Image, cameraCapture = true)
        } else {
            clearPendingCameraCapture()
            attachmentConversationId = null
            attachmentImportState.value = AttachmentImportUiState()
        }
    }
    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            launchCameraCapture()
        } else {
            clearPendingCameraCapture()
            attachmentImportState.value = AttachmentImportUiState(
                active = true,
                notice = "Camera access is needed to take a photo. You can still choose one instead.",
            )
        }
    }

    private val voicePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        voiceRecordingState.value = VoiceRecordingUiState(
            notice = if (granted) null else getString(R.string.microphone_permission_needed),
        )
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        refreshNotificationState()
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        pendingPermissionAction?.let(::completePermissionAction)
        pendingPermissionAction = null
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fishApplication = application as FishApplication
        refreshNotificationState()
        attachmentFileOpener = AttachmentFileOpener(this, BuildConfig.SUPABASE_URL)
        voiceMessageRecorder = VoiceMessageRecorder(this)
        attachmentConversationId = savedInstanceState?.getString(AttachmentConversationStateKey)
        pendingCameraFile = savedInstanceState?.getString(CameraFileStateKey)?.let(::File)
            ?.takeIf(File::exists)
        pendingCameraUri = savedInstanceState?.getString(CameraUriStateKey)?.let(Uri::parse)
        cleanupAbandonedCameraCaptures()
        enableEdgeToEdge()
        setContent {
            val repository = fishApplication.chatRepository
            val gifRepository = fishApplication.gifRepository
            val formatter = remember { AndroidChatFormatter(applicationContext) }
            val mediaCatalog = remember { ChatMediaCatalog.load(applicationContext) }
            val presenceFormatter = remember { PresenceFormatter(applicationContext) }
            val appPreferences by fishApplication.appPreferenceStore.preferences
                .collectAsStateWithLifecycle(initialValue = AppPreferences())
            val systemAnimationsDisabled by systemDisabledAnimations.collectAsStateWithLifecycle()
            val settingsNotice by preferenceNotice.collectAsStateWithLifecycle()
            val currentNotificationStatus by notificationStatus.collectAsStateWithLifecycle()
            val currentCanRequestNotifications by canRequestNotifications.collectAsStateWithLifecycle()
            val reducedMotion = effectiveReducedMotion(
                systemDisabledAnimations = systemAnimationsDisabled,
                explicitMotion = appPreferences.motion,
            )
            val factory = remember(repository, gifRepository, formatter, mediaCatalog) {
                viewModelFactory {
                    initializer {
                        ChatViewModel(
                            repository = repository,
                            savedStateHandle = createSavedStateHandle(),
                            formatter = formatter,
                            gifRepository = gifRepository,
                            mediaCatalog = mediaCatalog,
                        )
                    }
                }
            }
            val mediaPickerFactory = remember(gifRepository, mediaCatalog, reducedMotion) {
                viewModelFactory {
                    initializer {
                        MediaPickerViewModel(
                            catalog = mediaCatalog,
                            gifRepository = gifRepository,
                            animationsEnabled = !reducedMotion,
                        )
                    }
                }
            }
            val messageSearchFactory = remember(repository, formatter) {
                viewModelFactory {
                    initializer {
                        MessageSearchViewModel(
                            repository = repository,
                            formatter = formatter,
                        )
                    }
                }
            }
            val presenceFactory = remember(fishApplication.presenceRepository, presenceFormatter) {
                viewModelFactory {
                    initializer {
                        PresenceViewModel(
                            repository = fishApplication.presenceRepository,
                            formatter = presenceFormatter,
                        )
                    }
                }
            }
            val chatViewModel: ChatViewModel = viewModel(factory = factory)
            val mediaPickerViewModel: MediaPickerViewModel = viewModel(factory = mediaPickerFactory)
            val messageSearchViewModel: MessageSearchViewModel = viewModel(factory = messageSearchFactory)
            val presenceViewModel: PresenceViewModel = viewModel(factory = presenceFactory)
            val chatRouteState by chatViewModel.uiState.collectAsStateWithLifecycle()
            val callMinimized by minimized.collectAsStateWithLifecycle()
            val pip by pictureInPicture.collectAsStateWithLifecycle()
            val attachmentImport by attachmentImportState.collectAsStateWithLifecycle()
            val voiceRecording by voiceRecordingState.collectAsStateWithLifecycle()
            val chatDestination by pendingChatDestination.collectAsStateWithLifecycle()
            val shareContent by pendingShareContent.collectAsStateWithLifecycle()
            val shareConversationId = (chatRouteState as?
                space.fishhub.android.feature.chat.ChatRouteUiState.Conversation)
                ?.model
                ?.selectedConversationId
            LaunchedEffect(chatDestination, chatViewModel) {
                chatDestination?.let { destination ->
                    chatViewModel.focusMessage(destination.conversationId, destination.messageId)
                    ChatNotificationFactory.clear(this@MainActivity, destination.conversationId)
                    pendingChatDestination.value = null
                }
            }
            LaunchedEffect(shareContent, shareConversationId) {
                val content = shareContent ?: return@LaunchedEffect
                val conversationId = shareConversationId
                    ?: return@LaunchedEffect
                pendingShareContent.value = null
                importSharedContent(chatViewModel, conversationId, content)
            }
            LaunchedEffect(chatViewModel) {
                fishApplication.callCoordinator.state.collectLatest { state ->
                    val call = state.current
                    if (call.status in setOf(
                            CallLifecycleStatus.Ended,
                            CallLifecycleStatus.Rejected,
                            CallLifecycleStatus.Cancelled,
                            CallLifecycleStatus.Missed,
                            CallLifecycleStatus.Failed,
                        ) && call.counterpartId != null &&
                        chatViewModel.currentConversation?.participantId == call.counterpartId
                    ) {
                        chatViewModel.refreshCallActivity()
                    }
                }
            }
            FishTheme(
                darkTheme = appPreferences.theme.isDark(isSystemInDarkTheme()),
                reducedMotion = reducedMotion,
            ) {
                Box(Modifier.fillMaxSize()) {
                    ChatRoute(
                        viewModel = chatViewModel,
                        mediaPickerViewModel = mediaPickerViewModel,
                        messageSearchViewModel = messageSearchViewModel,
                        presenceViewModel = presenceViewModel,
                        mediaCatalog = mediaCatalog,
                        onStartAudioCall = { requestOutgoing(it, CallKind.Audio) },
                        onStartVideoCall = { requestOutgoing(it, CallKind.Video) },
                        onCallBack = { kind -> requestCallBack(chatViewModel, kind) },
                        attachmentImportState = attachmentImport,
                        cameraAvailable = packageManager.hasSystemFeature(
                            PackageManager.FEATURE_CAMERA_ANY,
                        ),
                        onChoosePhotos = { remainingSlots ->
                            attachmentConversationId = selectedConversationId(chatViewModel)
                            if (remainingSlots > 0 && attachmentConversationId != null) {
                                photoPickerLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                )
                            }
                        },
                        onTakePhoto = {
                            attachmentConversationId = selectedConversationId(chatViewModel)
                            if (attachmentConversationId != null) requestAttachmentCamera()
                        },
                        onChooseFile = {
                            attachmentConversationId = selectedConversationId(chatViewModel)
                            if (attachmentConversationId != null) {
                                documentPickerLauncher.launch(SupportedDocumentMimeTypes)
                            }
                        },
                        voiceRecording = voiceRecording,
                        voiceRecordingEnabled = packageManager.hasSystemFeature(
                            PackageManager.FEATURE_MICROPHONE,
                        ),
                        onStartVoiceRecording = { startVoiceRecording(chatViewModel) },
                        onFinishVoiceRecording = { finishVoiceRecording(chatViewModel) },
                        onCancelVoiceRecording = ::cancelVoiceRecording,
                        onAttachmentFlowFinished = {
                            attachmentImportState.value = AttachmentImportUiState()
                            attachmentConversationId = null
                        },
                        onOpenAttachment = { request ->
                            lifecycleScope.launch {
                                when (val result = attachmentFileOpener.open(request)) {
                                    OpenAttachmentResult.Opened -> Unit
                                    is OpenAttachmentResult.Failed ->
                                        chatViewModel.attachmentOpenFailed(result.message)
                                }
                            }
                        },
                        appearance = appPreferences.theme.toAccountSettingsTheme(),
                        accessibility = appPreferences.motion.toAccountSettingsMotion(),
                        notificationStatus = currentNotificationStatus,
                        canRequestNotifications = currentCanRequestNotifications,
                        settingsNotice = settingsNotice,
                        onClearSettingsNotice = { preferenceNotice.value = null },
                        onAppearanceSelected = { selected ->
                            lifecycleScope.launch {
                                if (!fishApplication.appPreferenceStore.setTheme(
                                        selected.toAppThemePreference(),
                                    )
                                ) {
                                    preferenceNotice.value =
                                        getString(R.string.preference_write_failed)
                                }
                            }
                        },
                        onAccessibilitySelected = { selected ->
                            lifecycleScope.launch {
                                if (!fishApplication.appPreferenceStore.setMotion(
                                        selected.toAppMotionPreference(),
                                    )
                                ) {
                                    preferenceNotice.value =
                                        getString(R.string.preference_write_failed)
                                }
                            }
                        },
                        onAllowNotifications = ::requestNotificationPermission,
                        onOpenNotifications = ::openNotificationSettings,
                        onOpenPasswordRecovery = {
                            openExternalWebPage("/forgot-password", R.string.password_help_unavailable)
                        },
                        onOpenPrivacyPolicy = {
                            openExternalWebPage("/privacy", R.string.privacy_policy_unavailable)
                        },
                    )
                    CallRoute(
                        coordinator = fishApplication.callCoordinator,
                        minimized = callMinimized,
                        onMinimizedChange = ::setCallMinimized,
                        onAnswer = ::requestIncomingAnswer,
                        onOpenAppSettings = ::openAppSettings,
                        pictureInPicture = pip,
                    )
                }
            }
        }
        observeCallForPictureInPicture()
        observeAttachmentPrivacyCleanup()
        handleCallIntent(intent)
        handleChatIntent(intent)
        pendingShareContent.value = ChatShareIntents.content(intent)
        intent.action = null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(AttachmentConversationStateKey, attachmentConversationId)
        outState.putString(CameraFileStateKey, pendingCameraFile?.absolutePath)
        outState.putString(CameraUriStateKey, pendingCameraUri?.toString())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleCallIntent(intent)
        handleChatIntent(intent)
        pendingShareContent.value = ChatShareIntents.content(intent)
        intent.action = null
    }

    override fun onResume() {
        super.onResume()
        systemDisabledAnimations.value = !ValueAnimator.areAnimatorsEnabled()
        refreshNotificationState()
        fishApplication.presenceRepository.markActive()
    }

    override fun onStop() {
        cancelVoiceRecording()
        super.onStop()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) fishApplication.presenceRepository.markActive()
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        fishApplication.presenceRepository.markActive()
        return super.dispatchTouchEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        fishApplication.presenceRepository.markActive()
        return super.onKeyDown(keyCode, event)
    }

    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        fishApplication.presenceRepository.markActive()
        return super.dispatchGenericMotionEvent(event)
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (
            activeVideoCall &&
            !minimized.value &&
            !isInPictureInPictureMode
        ) {
            enterPictureInPictureMode(buildPictureInPictureParams(autoEnter = false))
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration,
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        pictureInPicture.value = isInPictureInPictureMode
    }

    private fun requestOutgoing(participant: ParticipantUiModel, kind: CallKind) {
        if (!fishApplication.callCoordinator.permissionRequested(
                participant.id,
                participant.displayName,
                kind,
            )
        ) return
        requestPermissions(PendingPermissionAction.Outgoing(participant, kind))
    }

    private fun requestCallBack(viewModel: ChatViewModel, kind: String) {
        val participant = (viewModel.uiState.value as?
            space.fishhub.android.feature.chat.ChatRouteUiState.Conversation)
            ?.model?.participant ?: return
        requestOutgoing(
            participant,
            if (kind == "video") CallKind.Video else CallKind.Audio,
        )
    }

    private fun requestIncomingAnswer(callId: String) {
        val kind = fishApplication.callCoordinator.state.value.current.kind
        requestPermissions(PendingPermissionAction.Answer(callId, kind))
    }

    private fun requestPermissions(action: PendingPermissionAction) {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_MICROPHONE)) {
            fishApplication.callCoordinator.permissionDenied(deviceUnavailable = true)
            if (action is PendingPermissionAction.Answer) {
                fishApplication.callCoordinator.reject(action.callId)
            }
            return
        }
        val requested = buildList {
            add(Manifest.permission.RECORD_AUDIO)
            if (action.kind == CallKind.Video && packageManager.hasSystemFeature(
                    PackageManager.FEATURE_CAMERA_ANY,
                )
            ) {
                add(Manifest.permission.CAMERA)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        val missing = requested.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            completePermissionAction(action)
        } else {
            pendingPermissionAction = action
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun completePermissionAction(action: PendingPermissionAction) {
        val microphoneGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
        if (!microphoneGranted) {
            fishApplication.callCoordinator.permissionDenied()
            if (action is PendingPermissionAction.Answer) {
                fishApplication.callCoordinator.reject(action.callId)
            }
            return
        }
        val cameraGranted = action.kind == CallKind.Video &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED
        when (action) {
            is PendingPermissionAction.Outgoing -> fishApplication.callCoordinator.startOutgoing(
                counterpartId = action.participant.id,
                counterpartName = action.participant.displayName,
                kind = action.kind,
                cameraEnabled = cameraGranted,
            )
            is PendingPermissionAction.Answer -> {
                if (action.kind == CallKind.Video) {
                    fishApplication.callCoordinator.setCameraEnabled(cameraGranted)
                }
                fishApplication.callCoordinator.answer(action.callId)
            }
        }
    }

    private fun handleCallIntent(intent: Intent?) {
        val callId = intent?.getStringExtra(CallIntents.ExtraCallId) ?: return
        minimized.value = false
        if (intent.action != CallIntents.ActionAnswer) return
        val kind = intent.getStringExtra(CallIntents.ExtraCallKind)
            ?.let { runCatching { CallKind.valueOf(it) }.getOrNull() }
            ?: fishApplication.callCoordinator.state.value.current.kind
        requestPermissions(PendingPermissionAction.Answer(callId, kind))
        intent.action = CallIntents.ActionOpen
    }

    private fun handleChatIntent(intent: Intent?) {
        val destination = ChatIntents.destination(intent) ?: return
        pendingChatDestination.value = destination
        intent?.action = null
        intent?.data = null
    }

    private fun importSharedContent(
        viewModel: ChatViewModel,
        conversationId: String,
        content: ChatShareContent,
    ) {
        content.text?.let { sharedText ->
            val currentDraft = (viewModel.uiState.value as?
                space.fishhub.android.feature.chat.ChatRouteUiState.Conversation)
                ?.draft
                .orEmpty()
            viewModel.draftChanged(
                listOf(currentDraft, sharedText)
                    .filter(String::isNotBlank)
                    .joinToString("\n")
            )
        }
        if (content.uris.isEmpty()) return

        attachmentConversationId = conversationId
        attachmentImportState.value = AttachmentImportUiState(active = true, importing = true)
        lifecycleScope.launch {
            try {
                val result = fishApplication.chatRepository.importAttachments(
                    conversationId,
                    content.uris.take(MaxMessageAttachments).map { uri ->
                        AttachmentImportSource(
                            uri = uri,
                            kind = if (
                                contentTypeFor(uri).startsWith("image/") ||
                                content.mimeType.orEmpty().startsWith("image/")
                            ) {
                                AttachmentImportKind.Image
                            } else {
                                AttachmentImportKind.File
                            },
                        )
                    },
                )
                val omitted = (content.uris.size - MaxMessageAttachments).coerceAtLeast(0)
                val notice = when {
                    omitted > 0 && result.message != null ->
                        "Some shared items were not added. ${result.message}"
                    omitted > 0 -> "Some shared items were not added."
                    else -> result.message
                }
                attachmentImportState.value = AttachmentImportUiState(
                    active = true,
                    importing = false,
                    notice = notice,
                )
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                attachmentImportState.value = AttachmentImportUiState(
                    active = true,
                    importing = false,
                    notice = "Those shared items could not be prepared. Please try again.",
                )
            }
        }
    }

    private fun contentTypeFor(uri: Uri): String =
        contentResolver.getType(uri).orEmpty().lowercase()

    private fun openAppSettings() {
        startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null),
            ),
        )
    }

    private fun selectedConversationId(viewModel: ChatViewModel): String? =
        (viewModel.uiState.value as? space.fishhub.android.feature.chat.ChatRouteUiState.Conversation)
            ?.model
            ?.selectedConversationId

    private fun importAttachmentUris(
        uris: List<Uri>,
        kind: AttachmentImportKind,
        releasePersistableAccess: Boolean = false,
        cameraCapture: Boolean = false,
    ) {
        val conversationId = attachmentConversationId
        if (uris.isEmpty() || conversationId == null) {
            if (cameraCapture) clearPendingCameraCapture()
            attachmentImportState.value = AttachmentImportUiState()
            attachmentConversationId = null
            return
        }
        attachmentImportState.value = AttachmentImportUiState(active = true, importing = true)
        if (releasePersistableAccess) {
            uris.forEach { uri ->
                runCatching {
                    contentResolver.takePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION,
                    )
                }
            }
        }
        lifecycleScope.launch {
            try {
                val result = fishApplication.chatRepository.importAttachments(
                    conversationId,
                    uris.map { AttachmentImportSource(it, kind) },
                )
                attachmentImportState.value = AttachmentImportUiState(
                    active = true,
                    importing = false,
                    notice = result.message,
                )
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                attachmentImportState.value = AttachmentImportUiState(
                    active = true,
                    importing = false,
                    notice = "Those files could not be prepared. Please try again.",
                )
            } finally {
                if (releasePersistableAccess) {
                    uris.forEach { uri ->
                        runCatching {
                            contentResolver.releasePersistableUriPermission(
                                uri,
                                Intent.FLAG_GRANT_READ_URI_PERMISSION,
                            )
                        }
                    }
                }
                if (cameraCapture) clearPendingCameraCapture()
            }
        }
    }

    private fun startVoiceRecording(viewModel: ChatViewModel) {
        if (voiceRecordingState.value.recording) return
        val conversationId = selectedConversationId(viewModel)
        if (conversationId == null) return
        voiceRecordingState.value = VoiceRecordingUiState()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            voicePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        if (!voiceMessageRecorder.start()) {
            voiceRecordingState.value = VoiceRecordingUiState(
                notice = getString(R.string.voice_recording_failed),
            )
            return
        }
        voiceRecordingStartedAt = SystemClock.elapsedRealtime()
        voiceRecordingState.value = VoiceRecordingUiState(recording = true)
        voiceRecordingTicker?.cancel()
        voiceRecordingTicker = lifecycleScope.launch {
            while (isActive) {
                voiceRecordingState.value = VoiceRecordingUiState(
                    recording = true,
                    elapsedMillis = SystemClock.elapsedRealtime() - voiceRecordingStartedAt,
                )
                delay(250)
            }
        }
    }

    private fun finishVoiceRecording(viewModel: ChatViewModel) {
        if (!voiceRecordingState.value.recording) return
        val conversationId = selectedConversationId(viewModel)
        stopVoiceRecordingState()
        val uri = voiceMessageRecorder.stop()
        if (conversationId == null || uri == null) {
            voiceMessageRecorder.cleanupCompleted()
            voiceRecordingState.value = VoiceRecordingUiState(
                notice = getString(R.string.voice_recording_failed),
            )
            return
        }
        lifecycleScope.launch {
            try {
                val result = fishApplication.chatRepository.importAttachments(
                    conversationId,
                    listOf(AttachmentImportSource(uri, AttachmentImportKind.File)),
                )
                val importedId = result.importedIds.singleOrNull()
                if (importedId == null) {
                    voiceRecordingState.value = VoiceRecordingUiState(
                        notice = result.message ?: getString(R.string.voice_recording_failed),
                    )
                    return@launch
                }
                fishApplication.chatRepository.commitAttachmentPreview(conversationId)
                viewModel.armVoiceAutoSend(importedId)
                voiceRecordingState.value = VoiceRecordingUiState()
            } catch (_: Throwable) {
                voiceRecordingState.value = VoiceRecordingUiState(
                    notice = getString(R.string.voice_recording_failed),
                )
            } finally {
                voiceMessageRecorder.cleanupCompleted()
            }
        }
    }

    private fun cancelVoiceRecording() {
        stopVoiceRecordingState()
        voiceMessageRecorder.cancel()
    }

    private fun stopVoiceRecordingState() {
        voiceRecordingTicker?.cancel()
        voiceRecordingTicker = null
        voiceRecordingState.value = VoiceRecordingUiState()
    }

    private fun requestAttachmentCamera() {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            attachmentImportState.value = AttachmentImportUiState(
                active = true,
                notice = "The camera is not available on this device.",
            )
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            launchCameraCapture()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchCameraCapture() {
        clearPendingCameraCapture()
        val directory = File(cacheDir, CameraCaptureDirectory).apply { mkdirs() }
        val file = File(directory, "capture-${UUID.randomUUID()}.jpg")
        if (!file.createNewFile()) {
            attachmentImportState.value = AttachmentImportUiState(
                active = true,
                notice = "The camera could not start. Try choosing a photo instead.",
            )
            return
        }
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        pendingCameraFile = file
        pendingCameraUri = uri
        cameraLauncher.launch(uri)
    }

    private fun clearPendingCameraCapture() {
        pendingCameraFile?.delete()
        pendingCameraFile = null
        pendingCameraUri = null
    }

    private fun cleanupAbandonedCameraCaptures() {
        val cutoff = Instant.now().minus(1, ChronoUnit.DAYS).toEpochMilli()
        File(cacheDir, CameraCaptureDirectory).listFiles()?.forEach { file ->
            if (file != pendingCameraFile && file.lastModified() <= cutoff) file.delete()
        }
    }

    private fun setCallMinimized(value: Boolean) {
        minimized.value = value
        updatePictureInPictureParams()
    }

    private fun observeCallForPictureInPicture() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                fishApplication.callCoordinator.state.collectLatest { state ->
                    activeVideoCall = state.current.kind == CallKind.Video &&
                        state.current.status in setOf(
                            CallLifecycleStatus.Connecting,
                            CallLifecycleStatus.Active,
                            CallLifecycleStatus.Reconnecting,
                        )
                    updatePictureInPictureParams()
                }
            }
        }
    }

    private fun observeAttachmentPrivacyCleanup() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                fishApplication.chatRepository.authState.collectLatest { auth ->
                    if (auth is ChatAuthState.SignedOut) attachmentFileOpener.cleanupAll()
                }
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            openNotificationSettings()
        }
    }

    private fun refreshNotificationState() {
        val requiresRuntimePermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        val runtimePermissionGranted = !requiresRuntimePermission ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        notificationStatus.value = if (
            notificationDeliveryEnabled(
                notificationsEnabledBySystem = NotificationManagerCompat.from(this)
                    .areNotificationsEnabled(),
                runtimePermissionGranted = runtimePermissionGranted,
                requiresRuntimePermission = requiresRuntimePermission,
            )
        ) {
            AccountSettingsNotificationStatus.On
        } else {
            AccountSettingsNotificationStatus.Off
        }
        canRequestNotifications.value = requiresRuntimePermission &&
            !runtimePermissionGranted &&
            !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun openNotificationSettings() {
        val notificationSettings = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        if (notificationSettings.resolveActivity(packageManager) != null) {
            startActivity(notificationSettings)
            return
        }
        val appSettings = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:$packageName"),
        )
        if (appSettings.resolveActivity(packageManager) != null) {
            startActivity(appSettings)
        } else {
            preferenceNotice.value = "Notification settings aren’t available in this build."
        }
    }

    private fun openExternalWebPage(path: String, unavailableMessageRes: Int) {
        val uri = ExternalWebLinkPolicy.build(
            baseUrl = BuildConfig.WEB_BASE_URL,
            path = path,
            isRelease = BuildConfig.BUILD_TYPE == "release",
        )
        val intent = uri?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)) }
        if (intent != null && intent.resolveActivity(packageManager) != null) {
            startActivity(intent)
        } else {
            preferenceNotice.value = getString(unavailableMessageRes)
        }
    }

    private fun updatePictureInPictureParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setPictureInPictureParams(
                buildPictureInPictureParams(
                    autoEnter = activeVideoCall && !minimized.value,
                ),
            )
        }
    }

    private fun buildPictureInPictureParams(autoEnter: Boolean): PictureInPictureParams =
        PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .apply {
                val sourceBounds = Rect()
                window.decorView.getGlobalVisibleRect(sourceBounds)
                if (sourceBounds.width() > 0 && sourceBounds.height() > 0) {
                    setSourceRectHint(sourceBounds)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    setAutoEnterEnabled(autoEnter)
                    setSeamlessResizeEnabled(true)
                }
            }
            .build()

    private sealed interface PendingPermissionAction {
        val kind: CallKind

        data class Outgoing(
            val participant: ParticipantUiModel,
            override val kind: CallKind,
        ) : PendingPermissionAction

        data class Answer(
            val callId: String,
            override val kind: CallKind,
        ) : PendingPermissionAction
    }

    private companion object {
        const val MaxMessageAttachments = 5
        const val CameraCaptureDirectory = "chat-camera"
        const val AttachmentConversationStateKey = "attachment-conversation-id"
        const val CameraFileStateKey = "attachment-camera-file"
        const val CameraUriStateKey = "attachment-camera-uri"
        val SupportedDocumentMimeTypes = arrayOf(
            "video/mp4",
            "application/pdf",
            "text/plain",
            "text/csv",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    }
}

private fun AppThemePreference.toAccountSettingsTheme() = when (this) {
    AppThemePreference.System -> AccountSettingsTheme.System
    AppThemePreference.Light -> AccountSettingsTheme.Light
    AppThemePreference.Dark -> AccountSettingsTheme.Dark
}

private fun AppMotionPreference.toAccountSettingsMotion() = when (this) {
    AppMotionPreference.System -> AccountSettingsMotion.System
    AppMotionPreference.ReduceMotion -> AccountSettingsMotion.ReduceMotion
}

private fun AccountSettingsTheme.toAppThemePreference() = when (this) {
    AccountSettingsTheme.System -> AppThemePreference.System
    AccountSettingsTheme.Light -> AppThemePreference.Light
    AccountSettingsTheme.Dark -> AppThemePreference.Dark
}

private fun AccountSettingsMotion.toAppMotionPreference() = when (this) {
    AccountSettingsMotion.System -> AppMotionPreference.System
    AccountSettingsMotion.ReduceMotion -> AppMotionPreference.ReduceMotion
}
