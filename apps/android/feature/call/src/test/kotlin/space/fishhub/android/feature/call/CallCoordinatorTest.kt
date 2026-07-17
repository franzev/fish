package space.fishhub.android.feature.call

import android.content.Context
import android.view.View
import space.fishhub.android.data.call.Call
import space.fishhub.android.data.call.CallAuthState
import space.fishhub.android.data.call.CallCommandSuccess
import space.fishhub.android.data.call.CallConnection
import space.fishhub.android.data.call.CallDevicePreferences
import space.fishhub.android.data.call.CallDirection
import space.fishhub.android.data.call.CallKind
import space.fishhub.android.data.call.CallMediaConnection
import space.fishhub.android.data.call.CallMediaEngine
import space.fishhub.android.data.call.CallMediaState
import space.fishhub.android.data.call.CallRealtimeEvent
import space.fishhub.android.data.call.CallRepository
import space.fishhub.android.data.call.CallResult
import space.fishhub.android.data.call.CallStatus
import space.fishhub.android.data.call.CallVideoSource
import space.fishhub.android.data.call.CallWithCounterpart
import space.fishhub.android.data.call.VideoQualityPreference
import space.fishhub.android.feature.call.state.CallLifecycleStatus
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.TestScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CallCoordinatorTest {
    private val now = Instant.parse("2026-07-17T10:00:00Z")

    @Test
    fun `outgoing video call preserves camera denial and registers with system`() = runTest {
        val fixture = fixture()
        assertTrue(fixture.coordinator.permissionRequested("coach-1", "Coach Mina", CallKind.Video))
        fixture.coordinator.startOutgoing("coach-1", "Coach Mina", CallKind.Video, false)
        runCurrent()

        assertEquals(CallLifecycleStatus.Ringing, fixture.coordinator.state.value.current.status)
        assertFalse(fixture.coordinator.state.value.current.cameraEnabled)
        assertEquals(listOf("call-1"), fixture.gateway.outgoing)
    }

    @Test
    fun `busy gate deduplicates rapid outgoing commands`() = runTest {
        val fixture = fixture().also { it.repository.commandDelayMs = 1_000 }
        fixture.coordinator.permissionRequested("coach-1", "Coach Mina", CallKind.Audio)
        fixture.coordinator.startOutgoing("coach-1", "Coach Mina", CallKind.Audio)
        fixture.coordinator.startOutgoing("coach-1", "Coach Mina", CallKind.Audio)
        runCurrent()

        assertEquals(1, fixture.repository.initiateCount)
        assertTrue(fixture.coordinator.busy.value)
        advanceTimeBy(1_001)
        runCurrent()
        assertFalse(fixture.coordinator.busy.value)
    }

    @Test
    fun `second incoming call is ignored while a call is already ringing`() = runTest {
        val fixture = fixture()
        fixture.coordinator.receivePush(push("call-1", "2026-07-17T10:01:00Z"))
        runCurrent()
        fixture.coordinator.receivePush(push("call-2", "2026-07-17T10:02:00Z"))
        runCurrent()

        assertEquals("call-1", fixture.coordinator.state.value.current.callId)
        assertEquals(listOf("call-1"), fixture.gateway.incoming)
    }

    @Test
    fun `terminal push releases media and native call surface`() = runTest {
        val fixture = fixture()
        fixture.coordinator.receivePush(push("call-1", "2026-07-17T10:01:00Z"))
        runCurrent()
        fixture.coordinator.receivePush(
            push("call-1", "2026-07-17T10:01:00Z").copy(
                event = CallPushMessage.Event.Cancelled,
            ),
        )
        runCurrent()

        assertEquals(CallLifecycleStatus.Cancelled, fixture.coordinator.state.value.current.status)
        assertTrue(fixture.media.disconnectCount > 0)
        assertTrue("call-1" in fixture.gateway.dismissed)
    }

    @Test
    fun `ringing call expires locally and stops its notification`() = runTest {
        val fixture = fixture()
        fixture.coordinator.receivePush(push("call-1", "2026-07-17T10:00:01Z"))
        runCurrent()
        advanceTimeBy(1_001)
        runCurrent()

        assertEquals(CallLifecycleStatus.Missed, fixture.coordinator.state.value.current.status)
        assertTrue("call-1" in fixture.gateway.dismissed)
    }

    private fun TestScope.fixture(): Fixture {
        val repository = FakeRepository(now)
        val media = FakeMediaEngine()
        val gateway = FakeSystemGateway()
        val preferences = FakePreferences()
        val coordinator = CallCoordinator(
            repository = repository,
            mediaEngine = media,
            deviceStore = preferences,
            systemGateway = gateway,
            scope = backgroundScope,
            appVersion = "test",
            now = { now },
        )
        return Fixture(coordinator, repository, media, gateway)
    }

    private fun push(id: String, expiresAt: String) = CallPushMessage(
        event = CallPushMessage.Event.Ringing,
        callId = id,
        kind = CallKind.Audio,
        counterpartId = "coach-1",
        counterpartName = "Coach Mina",
        expiresAt = expiresAt,
    )

    private data class Fixture(
        val coordinator: CallCoordinator,
        val repository: FakeRepository,
        val media: FakeMediaEngine,
        val gateway: FakeSystemGateway,
    )
}

private class FakeRepository(now: Instant) : CallRepository {
    override val authState: StateFlow<CallAuthState> =
        MutableStateFlow(CallAuthState.SignedIn("client-1"))
    var initiateCount = 0
    var commandDelayMs = 0L
    val calls = mutableMapOf<String, CallWithCounterpart>()
    val realtime = MutableSharedFlow<CallRealtimeEvent>(extraBufferCapacity = 8)
    private val outgoing = call("call-1", now.plusSeconds(60), CallDirection.Outgoing)

    override suspend fun initiate(
        recipientId: String,
        kind: CallKind,
        clientRequestId: String,
    ): CallResult<CallCommandSuccess> {
        initiateCount += 1
        if (commandDelayMs > 0) delay(commandDelayMs)
        val value = outgoing.copy(kind = kind)
        calls[value.id] = CallWithCounterpart(value, "Coach Mina")
        return CallResult.Success(CallCommandSuccess(value))
    }

    override suspend fun accept(callId: String) = success(callId, CallStatus.Connecting, true)
    override suspend fun reject(callId: String) = success(callId, CallStatus.Rejected)
    override suspend fun cancel(callId: String) = success(callId, CallStatus.Cancelled)
    override suspend fun end(callId: String) = success(callId, CallStatus.Ended)
    override suspend fun join(callId: String) = success(callId, CallStatus.Active, true)
    override suspend fun findCurrentCall(userId: String): CallResult<CallWithCounterpart?> =
        CallResult.Success(null)
    override suspend fun findCall(callId: String): CallResult<CallWithCounterpart?> =
        CallResult.Success(calls[callId])
    override fun observeRealtime(userId: String): Flow<CallRealtimeEvent> = realtime
    override suspend fun registerPushDevice(
        installationId: String,
        providerInstallationId: String,
        appVersion: String,
    ): CallResult<Unit> = CallResult.Success(Unit)
    override suspend fun unregisterPushDevice(installationId: String): CallResult<Unit> =
        CallResult.Success(Unit)

    private fun success(
        callId: String,
        status: CallStatus,
        connected: Boolean = false,
    ): CallResult<CallCommandSuccess> {
        val original = calls[callId]?.call ?: outgoing
        val updated = original.copy(status = status)
        calls[callId] = CallWithCounterpart(updated, "Coach Mina")
        return CallResult.Success(
            CallCommandSuccess(
                updated,
                if (connected) CallConnection("wss://example.test", "redacted") else null,
            ),
        )
    }
}

private class FakeMediaEngine : CallMediaEngine {
    private val mutableState = MutableStateFlow(CallMediaState())
    override val state: StateFlow<CallMediaState> = mutableState
    var disconnectCount = 0

    override suspend fun connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone: Boolean,
        publishCamera: Boolean,
    ) {
        mutableState.value = CallMediaState(
            connection = CallMediaConnection.Connected,
            cameraEnabled = publishCamera,
        )
    }
    override suspend fun setMuted(muted: Boolean) {
        mutableState.value = mutableState.value.copy(muted = muted)
    }
    override suspend fun setCameraEnabled(enabled: Boolean) {
        mutableState.value = mutableState.value.copy(cameraEnabled = enabled)
    }
    override suspend fun switchCamera() = Unit
    override fun setVideoQualityPreference(preference: VideoQualityPreference) = Unit
    override suspend fun disconnect() {
        disconnectCount += 1
        mutableState.value = CallMediaState()
    }
    override fun createVideoView(context: Context, source: CallVideoSource): View = error("unused")
    override fun releaseVideoView(view: View) = Unit
}

private class FakePreferences : CallDevicePreferences {
    override val videoQualityPreference = MutableStateFlow(VideoQualityPreference.Auto)
    override val pushRegistrationId = MutableStateFlow<String?>(null)
    override suspend fun installationId() = "00000000-0000-0000-0000-000000000001"
    override suspend fun setVideoQualityPreference(preference: VideoQualityPreference) {
        videoQualityPreference.value = preference
    }
    override suspend fun setPushRegistrationId(registrationId: String?) {
        pushRegistrationId.value = registrationId
    }
}

private class FakeSystemGateway : CallSystemGateway {
    override val audioEndpoints = MutableStateFlow<List<CallAudioEndpoint>>(emptyList())
    val incoming = mutableListOf<String>()
    val outgoing = mutableListOf<String>()
    val dismissed = mutableListOf<String>()
    private var actions: CallSystemActions? = null

    override fun bind(actions: CallSystemActions) {
        this.actions = actions
    }
    override suspend fun presentIncoming(call: Call, counterpartName: String) {
        incoming += call.id
    }
    override suspend fun presentOutgoing(call: Call, counterpartName: String) {
        outgoing += call.id
    }
    override suspend fun answer(callId: String, isVideo: Boolean) = Unit
    override suspend fun markActive(callId: String) = Unit
    override suspend fun dismiss(callId: String) {
        dismissed += callId
    }
    override suspend fun setMuted(muted: Boolean) = Unit
    override suspend fun selectAudioEndpoint(id: String) = Unit
}

private fun call(id: String, expiresAt: Instant, direction: CallDirection): Call = Call(
    id = id,
    lessonSlotId = null,
    coachId = "coach-1",
    clientId = "client-1",
    initiatedBy = if (direction == CallDirection.Outgoing) "client-1" else "coach-1",
    kind = CallKind.Audio,
    status = CallStatus.Ringing,
    expiresAt = expiresAt.toString(),
    acceptedAt = null,
    connectedAt = null,
    endedAt = null,
    endReason = null,
    createdAt = expiresAt.minusSeconds(45).toString(),
    updatedAt = expiresAt.minusSeconds(45).toString(),
)
