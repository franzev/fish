package com.fish.android.data.call

import android.content.Context
import android.view.View
import io.github.jan.supabase.SupabaseClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.emptyFlow

object CallDataModule {
    data class Dependencies(
        val repository: CallRepository,
        val mediaEngine: CallMediaEngine,
        val deviceStore: CallDeviceStore,
        val scope: CoroutineScope,
    )

    fun create(context: Context, supabaseClient: SupabaseClient?): Dependencies {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val deviceStore = CallDeviceStore(context)
        if (supabaseClient == null) {
            return Dependencies(UnconfiguredCallRepository, NoOpCallMediaEngine, deviceStore, scope)
        }
        return Dependencies(
            repository = SupabaseCallRepository(supabaseClient, scope),
            mediaEngine = LiveKitCallMediaEngine(context, scope),
            deviceStore = deviceStore,
            scope = scope,
        )
    }
}

private object UnconfiguredCallRepository : CallRepository {
    override val authState: StateFlow<CallAuthState> = MutableStateFlow(CallAuthState.SignedOut)
    private val failure = CallResult.Failure(
        "call_unavailable",
        "This build is not connected yet. Messages still work.",
        recoverable = false,
    )

    override suspend fun initiate(recipientId: String, kind: CallKind, clientRequestId: String) = failure
    override suspend fun accept(callId: String) = failure
    override suspend fun reject(callId: String) = failure
    override suspend fun cancel(callId: String) = failure
    override suspend fun end(callId: String) = failure
    override suspend fun join(callId: String) = failure
    override suspend fun findCurrentCall(userId: String) = failure
    override suspend fun findCall(callId: String) = failure
    override fun observeRealtime(userId: String): Flow<CallRealtimeEvent> = emptyFlow()
    override suspend fun registerPushDevice(
        installationId: String,
        providerInstallationId: String,
        appVersion: String,
    ) = failure
    override suspend fun unregisterPushDevice(installationId: String) = failure
}

private object NoOpCallMediaEngine : CallMediaEngine {
    override val state: StateFlow<CallMediaState> = MutableStateFlow(CallMediaState())
    override suspend fun connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone: Boolean,
        publishCamera: Boolean,
    ) = Unit
    override suspend fun setMuted(muted: Boolean) = Unit
    override suspend fun setCameraEnabled(enabled: Boolean) = Unit
    override suspend fun switchCamera() = Unit
    override fun setVideoQualityPreference(preference: VideoQualityPreference) = Unit
    override suspend fun disconnect() = Unit
    override fun createVideoView(context: Context, source: CallVideoSource): View = View(context)
    override fun releaseVideoView(view: View) = Unit
}
