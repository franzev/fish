package space.fishhub.android.calling

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telecom.DisconnectCause
import android.telecom.VideoProfile
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallEndpointCompat
import androidx.core.telecom.CallsManager
import space.fishhub.android.MainActivity
import space.fishhub.android.data.call.Call
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.feature.call.CallAudioEndpoint
import space.fishhub.android.feature.call.CallSystemActions
import space.fishhub.android.feature.call.CallSystemGateway
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

class AndroidCallSystemGateway(
    context: Context,
    private val scope: CoroutineScope,
) : CallSystemGateway {
    private val appContext = context.applicationContext
    private val callsManager = CallsManager(appContext)
    private val registrations = ConcurrentHashMap<String, Registration>()
    private val mutableAudioEndpoints = MutableStateFlow<List<CallAudioEndpoint>>(emptyList())
    override val audioEndpoints: StateFlow<List<CallAudioEndpoint>> =
        mutableAudioEndpoints.asStateFlow()
    private var actions: CallSystemActions? = null

    init {
        CallNotificationFactory.ensureChannel(appContext)
        runCatching {
            callsManager.registerAppWithTelecom(
                CallsManager.CAPABILITY_BASELINE or CallsManager.CAPABILITY_SUPPORTS_VIDEO_CALLING,
            )
        }
    }

    override fun bind(actions: CallSystemActions) {
        this.actions = actions
    }

    override suspend fun presentIncoming(call: Call, counterpartName: String) {
        present(call, counterpartName, CallDirection.Incoming)
    }

    override suspend fun presentOutgoing(call: Call, counterpartName: String) {
        present(call, counterpartName, CallDirection.Outgoing)
    }

    override suspend fun answer(callId: String, isVideo: Boolean) {
        val registration = registrations[callId] ?: return
        val videoState = if (isVideo) VideoProfile.STATE_BIDIRECTIONAL else VideoProfile.STATE_AUDIO_ONLY
        registration.control?.answer(videoState) ?: run { registration.pendingAnswer = videoState }
    }

    override suspend fun markActive(callId: String) {
        registrations[callId]?.let { registration ->
            registration.active = true
            registration.control?.setActive()
            startNotification(registration)
        }
    }

    override suspend fun dismiss(callId: String) {
        val registration = registrations.remove(callId)
        registration?.control?.disconnect(DisconnectCause(DisconnectCause.LOCAL))
        registration?.job?.cancel()
        if (registrations.isEmpty()) mutableAudioEndpoints.value = emptyList()
        appContext.startService(
            Intent(appContext, CallForegroundService::class.java)
                .setAction(CallForegroundService.Stop)
                .putExtra(CallIntents.ExtraCallId, callId),
        )
        NotificationManagerCompat.from(appContext).cancel(
            CallNotificationFactory.notificationId(callId),
        )
    }

    override suspend fun setMuted(muted: Boolean) = Unit

    override suspend fun selectAudioEndpoint(id: String) {
        val registration = registrations.values.firstOrNull { it.active } ?: return
        registration.endpoints.firstOrNull { it.identifier.toString() == id }?.let { endpoint ->
            registration.control?.requestEndpointChange(endpoint)
        }
    }

    private fun publishAudioEndpoints(registration: Registration) {
        mutableAudioEndpoints.value = registration.endpoints.map { endpoint ->
            CallAudioEndpoint(
                id = endpoint.identifier.toString(),
                label = endpoint.name.toString(),
                selected = endpoint == registration.selectedEndpoint,
            )
        }
    }

    private fun present(call: Call, counterpartName: String, direction: CallDirection) {
        if (registrations.containsKey(call.id)) return
        val registration = Registration(call, counterpartName, direction)
        registrations[call.id] = registration
        startNotification(registration)
        registration.job = scope.launch {
            runCatching {
                callsManager.addCall(
                    callAttributes = CallAttributesCompat(
                        displayName = counterpartName,
                        address = Uri.fromParts("fish", call.id, null),
                        direction = if (direction == CallDirection.Incoming) {
                            CallAttributesCompat.DIRECTION_INCOMING
                        } else {
                            CallAttributesCompat.DIRECTION_OUTGOING
                        },
                        callType = if (call.kind == CallKind.Video) {
                            CallAttributesCompat.CALL_TYPE_VIDEO_CALL
                        } else {
                            CallAttributesCompat.CALL_TYPE_AUDIO_CALL
                        },
                        callCapabilities = 0,
                    ),
                    onAnswer = { requestAnswer(call.id, call.kind) },
                    onDisconnect = { cause: DisconnectCause ->
                        if (cause.code != DisconnectCause.LOCAL) actions?.end(call.id)
                    },
                    onSetActive = {},
                    onSetInactive = {},
                ) {
                    val callControl = this
                    registration.control = callControl
                    registration.pendingAnswer?.let { pending ->
                        registration.pendingAnswer = null
                        launch { callControl.answer(pending) }
                    }
                    launch {
                        callControl.currentCallEndpoint.collectLatest {
                            registration.selectedEndpoint = it
                            publishAudioEndpoints(registration)
                        }
                    }
                    launch {
                        callControl.availableEndpoints.collectLatest {
                            registration.endpoints = it
                            publishAudioEndpoints(registration)
                        }
                    }
                    launch {
                        callControl.isMuted.collectLatest { actions?.setMuted(it) }
                    }
                }
            }.onFailure {
                // The in-app call remains usable on devices without Telecom support.
            }
        }
    }

    private fun requestAnswer(callId: String, kind: CallKind) {
        if (ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            actions?.answer(callId)
            return
        }
        appContext.startActivity(
            Intent(appContext, MainActivity::class.java)
                .setAction(CallIntents.ActionAnswer)
                .putExtra(CallIntents.ExtraCallId, callId)
                .putExtra(CallIntents.ExtraCallKind, kind.name)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        )
    }

    private fun startNotification(registration: Registration) {
        val intent = Intent(appContext, CallForegroundService::class.java)
            .setAction(CallForegroundService.Start)
            .putExtra(CallIntents.ExtraCallId, registration.call.id)
            .putExtra(CallIntents.ExtraCallKind, registration.call.kind.name)
            .putExtra(CallIntents.ExtraCounterpartName, registration.counterpartName)
            .putExtra(CallIntents.ExtraIncoming, registration.direction == CallDirection.Incoming)
            .putExtra(CallIntents.ExtraActive, registration.active)
        runCatching { ContextCompat.startForegroundService(appContext, intent) }
            .onFailure {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                    ContextCompat.checkSelfPermission(
                        appContext,
                        Manifest.permission.POST_NOTIFICATIONS,
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    runCatching {
                        NotificationManagerCompat.from(appContext).notify(
                            CallNotificationFactory.notificationId(registration.call.id),
                            CallNotificationFactory.build(
                                appContext,
                                registration.call.id,
                                registration.counterpartName,
                                registration.call.kind,
                                registration.direction == CallDirection.Incoming,
                                registration.active,
                            ),
                        )
                    }
                }
            }
    }

    private class Registration(
        val call: Call,
        val counterpartName: String,
        val direction: CallDirection,
        var control: CallControlScope? = null,
        var endpoints: List<CallEndpointCompat> = emptyList(),
        var selectedEndpoint: CallEndpointCompat? = null,
        var pendingAnswer: Int? = null,
        var active: Boolean = false,
        var job: Job? = null,
    )
}
