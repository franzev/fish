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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.content.edit
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
import space.fishhub.android.feature.chat.ParticipantUiModel
import space.fishhub.android.feature.chat.VoiceRecordingUiState
import space.fishhub.android.feature.presence.PresenceFormatter
import space.fishhub.android.feature.presence.PresenceViewModel
import space.fishhub.android.messaging.ChatDestination
import space.fishhub.android.messaging.ChatIntents
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

class MainActivity : ComponentActivity() {
    private lateinit var fishApplication: FishApplication
    private var pendingPermissionAction: PendingPermissionAction? = null
    private val minimized = MutableStateFlow(false)
    private val pictureInPicture = MutableStateFlow(false)
    private var activeVideoCall = false
    private val attachmentImportState = MutableStateFlow(AttachmentImportUiState())
    private val pendingChatDestination = MutableStateFlow<ChatDestination?>(null)
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

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        pendingPermissionAction?.let(::completePermissionAction)
        pendingPermissionAction = null
    }
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fishApplication = application as FishApplication
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
            val animationsEnabled = remember { ValueAnimator.areAnimatorsEnabled() }
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
            val mediaPickerFactory = remember(gifRepository, mediaCatalog, animationsEnabled) {
                viewModelFactory {
                    initializer {
                        MediaPickerViewModel(
                            catalog = mediaCatalog,
                            gifRepository = gifRepository,
                            animationsEnabled = animationsEnabled,
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
            val presenceViewModel: PresenceViewModel = viewModel(factory = presenceFactory)
            val callMinimized by minimized.collectAsStateWithLifecycle()
            val pip by pictureInPicture.collectAsStateWithLifecycle()
            val attachmentImport by attachmentImportState.collectAsStateWithLifecycle()
            val voiceRecording by voiceRecordingState.collectAsStateWithLifecycle()
            val chatDestination by pendingChatDestination.collectAsStateWithLifecycle()
            LaunchedEffect(chatDestination, chatViewModel) {
                chatDestination?.let { destination ->
                    chatViewModel.focusMessage(destination.conversationId, destination.messageId)
                    pendingChatDestination.value = null
                }
            }
            FishTheme(reducedMotion = !animationsEnabled) {
                Box(Modifier.fillMaxSize()) {
                    ChatRoute(
                        viewModel = chatViewModel,
                        mediaPickerViewModel = mediaPickerViewModel,
                        presenceViewModel = presenceViewModel,
                        mediaCatalog = mediaCatalog,
                        onStartAudioCall = { requestOutgoing(it, CallKind.Audio) },
                        onStartVideoCall = { requestOutgoing(it, CallKind.Video) },
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
        observeNotificationPermission()
        observeAttachmentPrivacyCleanup()
        handleCallIntent(intent)
        handleChatIntent(intent)
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
    }

    override fun onResume() {
        super.onResume()
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

    private fun observeNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                fishApplication.chatRepository.authState.collectLatest { auth ->
                    if (auth !is ChatAuthState.SignedIn) return@collectLatest
                    val preferences = getSharedPreferences("fish-permissions", MODE_PRIVATE)
                    if (
                        preferences.getBoolean("notification-requested", false) ||
                        ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.POST_NOTIFICATIONS,
                        ) == PackageManager.PERMISSION_GRANTED
                    ) return@collectLatest
                    preferences.edit { putBoolean("notification-requested", true) }
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
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
            "application/pdf",
            "text/plain",
            "text/csv",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    }
}
