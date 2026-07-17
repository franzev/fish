package space.fishhub.android

import android.Manifest
import android.os.Bundle
import android.animation.ValueAnimator
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.KeyEvent
import android.view.MotionEvent
import android.util.Rational
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.content.edit
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
import space.fishhub.android.feature.call.CallRoute
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.chat.AndroidChatFormatter
import space.fishhub.android.feature.chat.ChatRoute
import space.fishhub.android.feature.chat.ChatViewModel
import space.fishhub.android.feature.chat.ChatMediaCatalog
import space.fishhub.android.feature.chat.MediaPickerViewModel
import space.fishhub.android.feature.chat.ParticipantUiModel
import space.fishhub.android.feature.presence.PresenceFormatter
import space.fishhub.android.feature.presence.PresenceViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var fishApplication: FishApplication
    private var pendingPermissionAction: PendingPermissionAction? = null
    private val minimized = MutableStateFlow(false)
    private val pictureInPicture = MutableStateFlow(false)
    private var activeVideoCall = false

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
            FishTheme(reducedMotion = !animationsEnabled) {
                Box(Modifier.fillMaxSize()) {
                    ChatRoute(
                        viewModel = chatViewModel,
                        mediaPickerViewModel = mediaPickerViewModel,
                        presenceViewModel = presenceViewModel,
                        mediaCatalog = mediaCatalog,
                        onStartAudioCall = { requestOutgoing(it, CallKind.Audio) },
                        onStartVideoCall = { requestOutgoing(it, CallKind.Video) },
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
        handleCallIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleCallIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        fishApplication.presenceRepository.markActive()
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

    private fun openAppSettings() {
        startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null),
            ),
        )
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
}
