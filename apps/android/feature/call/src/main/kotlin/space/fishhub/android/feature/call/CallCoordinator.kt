package space.fishhub.android.feature.call

import space.fishhub.android.data.call.Call
import space.fishhub.android.data.call.CallAuthState
import space.fishhub.android.data.call.CallCommandSuccess
import space.fishhub.android.data.call.CallDevicePreferences
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaConnection
import space.fishhub.android.data.call.CallMediaEngine
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.CallRepository
import space.fishhub.android.data.call.CallResult
import space.fishhub.android.data.call.CallStatus
import space.fishhub.android.data.call.CallWithCounterpart
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.state.CallEvent
import space.fishhub.android.feature.call.state.CallFailureReason
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import space.fishhub.android.feature.call.state.CallState
import space.fishhub.android.feature.call.state.isLive
import space.fishhub.android.feature.call.state.reduceCallState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant
import java.util.UUID

class CallCoordinator(
    private val repository: CallRepository,
    val mediaEngine: CallMediaEngine,
    private val deviceStore: CallDevicePreferences,
    private val systemGateway: CallSystemGateway,
    private val scope: CoroutineScope,
    private val appVersion: String,
    private val now: () -> Instant = Instant::now,
) : CallSystemActions {
    private val mutableState = MutableStateFlow(CallState())
    val state: StateFlow<CallState> = mutableState.asStateFlow()
    val mediaState: StateFlow<CallMediaState> = mediaEngine.state
    val audioEndpoints: StateFlow<List<CallAudioEndpoint>> = systemGateway.audioEndpoints
    val qualityPreference: StateFlow<VideoQualityPreference> = deviceStore.videoQualityPreference
        .stateIn(scope, SharingStarted.Eagerly, VideoQualityPreference.Auto)
    private val mutableNotice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = mutableNotice.asStateFlow()
    private val connectionMutex = Mutex()
    private val commandMutex = Mutex()
    private val mutableBusy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = mutableBusy.asStateFlow()
    private var realtimeJob: Job? = null
    private var currentUserId: String? = null
    private var connectedCallId: String? = null
    private var expiryJob: Job? = null

    init {
        systemGateway.bind(this)
        scope.launch {
            repository.authState.collectLatest { auth ->
                when (auth) {
                    CallAuthState.Loading -> Unit
                    CallAuthState.SignedOut -> signedOut()
                    is CallAuthState.SignedIn -> signedIn(auth.userId)
                }
            }
        }
        scope.launch {
            mediaEngine.state.collect { media ->
                val call = mutableState.value.current
                val callId = call.callId ?: return@collect
                when (media.connection) {
                    CallMediaConnection.Connected -> if (
                        call.status == CallLifecycleStatus.Connecting ||
                        call.status == CallLifecycleStatus.Reconnecting
                    ) {
                        dispatch(CallEvent.MediaConnected(callId, now().toString()))
                        systemGateway.markActive(callId)
                    }
                    CallMediaConnection.Reconnecting -> dispatch(CallEvent.Reconnecting(callId))
                    CallMediaConnection.Disconnected -> if (
                        call.status in setOf(
                            CallLifecycleStatus.Connecting,
                            CallLifecycleStatus.Active,
                            CallLifecycleStatus.Reconnecting,
                        )
                    ) {
                        finish(
                            callId,
                            CallEvent.CallFailed(callId, CallFailureReason.NetworkLost),
                        )
                    }
                    else -> Unit
                }
                if (media.connection != CallMediaConnection.Idle && call.muted != media.muted) {
                    dispatch(CallEvent.MuteChanged(media.muted))
                }
                if (
                    media.connection != CallMediaConnection.Idle &&
                    call.cameraEnabled != media.cameraEnabled
                ) {
                    dispatch(CallEvent.CameraChanged(media.cameraEnabled))
                }
            }
        }
        scope.launch {
            qualityPreference.collectLatest(mediaEngine::setVideoQualityPreference)
        }
    }

    fun permissionRequested(
        counterpartId: String,
        counterpartName: String,
        kind: CallKind,
    ): Boolean {
        if (mutableState.value.current.isLive) {
            mutableNotice.value = "Finish your current call before starting another one."
            return false
        }
        dispatch(CallEvent.PermissionRequested(counterpartId, counterpartName, kind))
        mutableNotice.value = null
        return true
    }

    fun permissionDenied(deviceUnavailable: Boolean = false) {
        dispatch(
            CallEvent.PermissionDenied(
                if (deviceUnavailable) CallFailureReason.DeviceUnavailable
                else CallFailureReason.PermissionDenied,
            ),
        )
    }

    fun startOutgoing(
        counterpartId: String,
        counterpartName: String,
        kind: CallKind,
        cameraEnabled: Boolean = kind == CallKind.Video,
    ) {
        runCommand {
            when (val result = repository.initiate(
                recipientId = counterpartId,
                kind = kind,
                clientRequestId = UUID.randomUUID().toString(),
            )) {
                is CallResult.Success -> {
                    val call = result.value.call
                    dispatch(
                        CallEvent.OutgoingCallCreated(
                            call.id,
                            counterpartId,
                            counterpartName,
                            call.kind,
                            call.expiresAt,
                        ),
                    )
                    if (call.kind == CallKind.Video) {
                        dispatch(CallEvent.CameraChanged(cameraEnabled))
                    }
                    scheduleExpiry(call)
                    systemGateway.presentOutgoing(call, counterpartName)
                }
                is CallResult.Failure -> fail(result)
            }
        }
    }

    fun receivePush(message: CallPushMessage) {
        scope.launch {
            if (message.isTerminal) {
                val event = terminalEvent(message)
                if (mutableState.value.current.callId == message.callId) {
                    finish(message.callId, event)
                } else {
                    systemGateway.dismiss(message.callId)
                }
                return@launch
            }
            if (message.event == CallPushMessage.Event.Ringing) {
                dispatch(
                    CallEvent.IncomingCallReceived(
                        message.callId,
                        message.counterpartId,
                        message.counterpartName,
                        message.kind,
                        message.expiresAt,
                    ),
                )
                if (mutableState.value.current.callId == message.callId) {
                    scheduleExpiry(message.callId, message.expiresAt)
                    systemGateway.presentIncoming(message.placeholderCall(), message.counterpartName)
                }
            }
            val userId = withTimeoutOrNull(5_000) {
                repository.authState.filterIsInstance<CallAuthState.SignedIn>().first().userId
            } ?: return@launch
            refreshCall(message.callId, userId)
        }
    }

    override fun answer(callId: String) {
        runCommand {
            systemGateway.answer(callId, mutableState.value.current.kind == CallKind.Video)
            when (val result = repository.accept(callId)) {
                is CallResult.Success -> {
                    dispatch(CallEvent.CallAccepted(callId))
                    connect(result.value)
                }
                is CallResult.Failure -> fail(result, callId)
            }
        }
    }

    override fun reject(callId: String) {
        runCommand {
            when (val result = repository.reject(callId)) {
                is CallResult.Success -> finish(callId, CallEvent.CallRejected(callId))
                is CallResult.Failure -> fail(result, callId)
            }
        }
    }

    fun cancel(callId: String) {
        runCommand {
            when (val result = repository.cancel(callId)) {
                is CallResult.Success -> finish(callId, CallEvent.CallCancelled(callId))
                is CallResult.Failure -> fail(result, callId)
            }
        }
    }

    override fun end(callId: String) {
        runCommand {
            when (val result = repository.end(callId)) {
                is CallResult.Success -> finish(callId, CallEvent.CallEnded(callId))
                is CallResult.Failure -> {
                    finish(callId, CallEvent.CallEnded(callId))
                    mutableNotice.value = result.notice
                }
            }
        }
    }

    override fun setMuted(muted: Boolean) {
        scope.launch {
            mediaEngine.setMuted(muted)
            systemGateway.setMuted(muted)
        }
    }

    fun setCameraEnabled(enabled: Boolean) {
        dispatch(CallEvent.CameraChanged(enabled))
        scope.launch { mediaEngine.setCameraEnabled(enabled) }
    }

    fun switchCamera() {
        scope.launch { mediaEngine.switchCamera() }
    }

    fun selectAudioEndpoint(id: String) {
        scope.launch { systemGateway.selectAudioEndpoint(id) }
    }

    fun setQualityPreference(preference: VideoQualityPreference) {
        scope.launch { deviceStore.setVideoQualityPreference(preference) }
    }

    fun clear() {
        val callId = mutableState.value.current.callId
        scope.launch {
            mediaEngine.disconnect()
            expiryJob?.cancel()
            expiryJob = null
            if (callId != null) systemGateway.dismiss(callId)
            dispatch(CallEvent.ClearCall)
            mutableNotice.value = null
        }
    }

    suspend fun updatePushRegistration(registrationId: String, appVersion: String) {
        deviceStore.setPushRegistrationId(registrationId)
        val signedIn = repository.authState.value as? CallAuthState.SignedIn ?: return
        registerPushDevice(signedIn.userId, registrationId, appVersion)
    }

    suspend fun unregisterPushDevice() {
        val installationId = deviceStore.installationId()
        repository.unregisterPushDevice(installationId)
    }

    private suspend fun signedIn(userId: String) {
        if (currentUserId != null && currentUserId != userId) {
            dispatch(CallEvent.IdentityChanged)
        }
        currentUserId = userId
        realtimeJob?.cancel()
        realtimeJob = scope.launch {
            repository.observeRealtime(userId).collectLatest { refreshCall(it.callId, userId) }
        }
        recover(userId)
        val registrationId = deviceStore.pushRegistrationId.first()
        if (registrationId != null) registerPushDevice(userId, registrationId, appVersion)
    }

    private suspend fun signedOut() {
        if (currentUserId == null) return
        val callId = mutableState.value.current.callId
        currentUserId = null
        realtimeJob?.cancel()
        realtimeJob = null
        mediaEngine.disconnect()
        expiryJob?.cancel()
        expiryJob = null
        if (callId != null) systemGateway.dismiss(callId)
        connectedCallId = null
        dispatch(CallEvent.IdentityChanged)
    }

    private suspend fun recover(userId: String) {
        when (val result = repository.findCurrentCall(userId)) {
            is CallResult.Success -> result.value?.let { applyAuthoritative(it, userId) }
            is CallResult.Failure -> mutableNotice.value = result.notice
        }
    }

    private suspend fun refreshCall(callId: String, userId: String) {
        when (val result = repository.findCall(callId)) {
            is CallResult.Success -> result.value?.let { applyAuthoritative(it, userId) }
            is CallResult.Failure -> Unit
        }
    }

    private suspend fun applyAuthoritative(value: CallWithCounterpart, userId: String) {
        val call = value.call
        val counterpartId = if (call.coachId == userId) call.clientId else call.coachId
        val direction = if (call.initiatedBy == userId) CallDirection.Outgoing else CallDirection.Incoming
        val current = mutableState.value.current
        if (current.callId != call.id) {
            if (direction == CallDirection.Incoming) {
                dispatch(
                    CallEvent.IncomingCallReceived(
                        call.id, counterpartId, value.counterpartName, call.kind, call.expiresAt,
                    ),
                )
                if (
                    call.status == CallStatus.Ringing &&
                    mutableState.value.current.callId == call.id
                ) {
                    scheduleExpiry(call)
                    systemGateway.presentIncoming(call, value.counterpartName)
                }
            } else {
                dispatch(
                    CallEvent.OutgoingCallCreated(
                        call.id, counterpartId, value.counterpartName, call.kind, call.expiresAt,
                    ),
                )
                if (call.kind == CallKind.Video) dispatch(CallEvent.CameraChanged(true))
                if (
                    call.status == CallStatus.Ringing &&
                    mutableState.value.current.callId == call.id
                ) {
                    scheduleExpiry(call)
                    systemGateway.presentOutgoing(call, value.counterpartName)
                }
            }
        }
        when (call.status) {
            CallStatus.Ringing -> Unit
            CallStatus.Connecting,
            CallStatus.Active,
            -> {
                if (
                    mutableState.value.current.status !in setOf(
                        CallLifecycleStatus.Connecting,
                        CallLifecycleStatus.Active,
                        CallLifecycleStatus.Reconnecting,
                    )
                ) {
                    dispatch(CallEvent.CallAccepted(call.id))
                }
                if (connectedCallId != call.id) {
                    when (val joined = repository.join(call.id)) {
                        is CallResult.Success -> connect(joined.value)
                        is CallResult.Failure -> fail(joined, call.id)
                    }
                }
            }
            CallStatus.Ended -> finish(call.id, CallEvent.CallEnded(call.id))
            CallStatus.Rejected -> finish(call.id, CallEvent.CallRejected(call.id))
            CallStatus.Cancelled -> finish(call.id, CallEvent.CallCancelled(call.id))
            CallStatus.Missed -> finish(call.id, CallEvent.CallMissed(call.id))
            CallStatus.Failed -> finish(
                call.id,
                CallEvent.CallFailed(call.id, CallFailureReason.ProviderUnavailable),
            )
        }
    }

    private suspend fun connect(result: CallCommandSuccess) {
        val connection = result.connection
            ?: return fail(
                CallResult.Failure("media_unavailable", "Calling is taking a break. Messages still work.", true),
                result.call.id,
            )
        connectionMutex.withLock {
            if (connectedCallId == result.call.id) return
            try {
                mediaEngine.connect(
                    callId = result.call.id,
                    connection = connection,
                    publishMicrophone = true,
                    publishCamera = result.call.kind == CallKind.Video &&
                        mutableState.value.current.cameraEnabled,
                )
                connectedCallId = result.call.id
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                finish(
                    result.call.id,
                    CallEvent.CallFailed(result.call.id, CallFailureReason.ConnectFailed),
                )
                mutableNotice.value = "The call could not connect. Messages still work."
            }
        }
    }

    private suspend fun finish(callId: String, event: CallEvent) {
        if (mutableState.value.current.callId != callId) {
            systemGateway.dismiss(callId)
            return
        }
        dispatch(event)
        expiryJob?.cancel()
        expiryJob = null
        connectedCallId = null
        mediaEngine.disconnect()
        systemGateway.dismiss(callId)
    }

    private suspend fun fail(failure: CallResult.Failure, callId: String? = null) {
        dispatch(
            CallEvent.CallFailed(
                callId,
                when (failure.code) {
                    "call_not_allowed", "not_authenticated" -> CallFailureReason.NotAllowed
                    "media_unavailable" -> CallFailureReason.ProviderUnavailable
                    else -> CallFailureReason.ConnectFailed
                },
            ),
        )
        mutableNotice.value = failure.notice
        if (callId != null && mutableState.value.current.callId == callId) {
            expiryJob?.cancel()
            expiryJob = null
            connectedCallId = null
            mediaEngine.disconnect()
            systemGateway.dismiss(callId)
        }
    }

    private suspend fun registerPushDevice(
        userId: String,
        providerInstallationId: String,
        appVersion: String,
    ) {
        if ((repository.authState.value as? CallAuthState.SignedIn)?.userId != userId) return
        repository.registerPushDevice(
            deviceStore.installationId(),
            providerInstallationId,
            appVersion,
        )
    }

    private fun terminalEvent(message: CallPushMessage): CallEvent =
        when (message.event) {
            CallPushMessage.Event.Rejected -> CallEvent.CallRejected(message.callId)
            CallPushMessage.Event.Cancelled -> CallEvent.CallCancelled(message.callId)
            CallPushMessage.Event.Ended -> CallEvent.CallEnded(message.callId)
            CallPushMessage.Event.Missed -> CallEvent.CallMissed(message.callId)
            else -> CallEvent.CallFailed(message.callId, CallFailureReason.ProviderUnavailable)
        }

    private fun dispatch(event: CallEvent) {
        mutableState.value = reduceCallState(mutableState.value, event)
    }

    private fun scheduleExpiry(call: Call) = scheduleExpiry(call.id, call.expiresAt)

    private fun scheduleExpiry(callId: String, expiresAt: String) {
        val expiry = runCatching { Instant.parse(expiresAt) }.getOrNull() ?: return
        expiryJob?.cancel()
        expiryJob = scope.launch {
            val waitMs = (expiry.toEpochMilli() - now().toEpochMilli()).coerceAtLeast(0)
            delay(waitMs)
            val current = mutableState.value.current
            if (current.callId == callId && current.status == CallLifecycleStatus.Ringing) {
                finish(callId, CallEvent.CallMissed(callId))
            }
        }
    }

    private fun runCommand(block: suspend () -> Unit) {
        scope.launch {
            if (!commandMutex.tryLock()) return@launch
            mutableBusy.value = true
            try {
                block()
            } finally {
                mutableBusy.value = false
                commandMutex.unlock()
            }
        }
    }
}

private fun CallPushMessage.placeholderCall(): Call = Call(
    id = callId,
    lessonSlotId = null,
    coachId = counterpartId,
    clientId = counterpartId,
    initiatedBy = counterpartId,
    kind = kind,
    status = CallStatus.Ringing,
    expiresAt = expiresAt,
    acceptedAt = null,
    connectedAt = null,
    endedAt = null,
    endReason = null,
    createdAt = Instant.now().toString(),
    updatedAt = Instant.now().toString(),
)
