package space.fishhub.android.feature.presence

import space.fishhub.android.data.presence.PresenceCommandResult
import space.fishhub.android.data.presence.PresenceConnectionState
import space.fishhub.android.data.presence.PresenceDuration
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.data.presence.PresencePreferenceSetting
import space.fishhub.android.data.presence.PresenceRepository
import space.fishhub.android.data.presence.PresenceResult
import space.fishhub.android.data.presence.PresenceSnapshot
import space.fishhub.android.data.presence.PresenceState
import space.fishhub.android.data.presence.PresenceStatus
import java.time.Instant
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class PresenceViewModelTest {
    @get:Rule val main = PresenceMainDispatcherRule()

    @Test
    fun `optimistic command prevents duplicates and closes only after success`() =
        runTest(main.dispatcher) {
            val repository = FakePresenceRepository()
            val ticks = MutableSharedFlow<Long>(replay = 1).also { it.tryEmit(Now) }
            val viewModel = PresenceViewModel(repository, PresenceFormatter(), { Now }, ticks)
            var successes = 0
            val events = launch { viewModel.preferenceConfirmed.collect { successes += 1 } }
            repository.gate = CompletableDeferred()

            viewModel.setPreference(PresencePreference.Away, PresenceDuration.OneHour)
            viewModel.setPreference(PresencePreference.Busy, PresenceDuration.Forever)
            runCurrent()

            assertTrue(viewModel.uiState.value.updating)
            assertEquals(PresencePreference.Away, viewModel.uiState.value.ownPreference)
            assertEquals(1, repository.commandCalls)

            repository.gate?.complete(Unit)
            runCurrent()
            assertFalse(viewModel.uiState.value.updating)
            assertEquals(1, successes)
            events.cancel()
        }

    @Test
    fun `failure rolls back current optimistic mutation and keeps calm notice`() =
        runTest(main.dispatcher) {
            val repository = FakePresenceRepository().apply {
                result = PresenceResult.Failure("Your status could not change. Try again.")
            }
            val ticks = MutableSharedFlow<Long>(replay = 1).also { it.tryEmit(Now) }
            val viewModel = PresenceViewModel(repository, PresenceFormatter(), { Now }, ticks)

            viewModel.setPreference(PresencePreference.Busy, PresenceDuration.Forever)
            runCurrent()

            assertFalse(viewModel.uiState.value.updating)
            assertEquals(PresencePreference.Automatic, viewModel.uiState.value.ownPreference)
            assertNotNull(viewModel.uiState.value.notice)
        }

    @Test
    fun `expired timed mode returns local presentation to automatic`() =
        runTest(main.dispatcher) {
            val repository = FakePresenceRepository()
            repository.state.value = repository.state.value.copy(
                ownPreference = PresencePreferenceSetting(
                    PresencePreference.Away,
                    Instant.ofEpochMilli(Now + 1_000).toString(),
                ),
            )
            val ticks = MutableSharedFlow<Long>(replay = 1).also { it.tryEmit(Now) }
            val viewModel = PresenceViewModel(repository, PresenceFormatter(), { Now }, ticks)
            runCurrent()
            assertEquals(PresencePreference.Away, viewModel.uiState.value.ownPreference)

            ticks.emit(Now + 1_001)
            runCurrent()
            assertEquals(PresencePreference.Automatic, viewModel.uiState.value.ownPreference)
            assertNull(viewModel.uiState.value.notice)
        }

    private companion object {
        val Now = Instant.parse("2026-07-17T12:00:00Z").toEpochMilli()
    }
}

private class FakePresenceRepository : PresenceRepository {
    override val state = MutableStateFlow(
        PresenceState(
            currentUserId = "me",
            snapshots = mapOf("me" to ownSnapshot()),
            connection = PresenceConnectionState.Connected,
        ),
    )
    var gate: CompletableDeferred<Unit>? = null
    var commandCalls = 0
    var result: PresenceResult<PresenceCommandResult> = PresenceResult.Success(
        PresenceCommandResult(
            ownSnapshot().copy(revision = 2, status = PresenceStatus.Away),
            PresencePreferenceSetting(PresencePreference.Away),
        ),
    )

    override fun setAppForegrounded(foregrounded: Boolean) = Unit
    override fun markActive() = Unit
    override suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ): PresenceResult<PresenceCommandResult> {
        commandCalls += 1
        gate?.await()
        val value = result
        if (value is PresenceResult.Success) {
            state.value = state.value.copy(
                snapshots = state.value.snapshots + ("me" to value.value.snapshot),
                ownPreference = value.value.setting,
                preferenceRevision = value.value.snapshot.revision,
            )
        }
        return value
    }
    override suspend fun endSession() = Unit
}

private fun ownSnapshot() = PresenceSnapshot(
    userId = "me",
    status = PresenceStatus.Online,
    lastHeartbeatAt = "2026-07-17T11:59:30Z",
    lastSeenAt = null,
    revision = 1,
    updatedAt = "2026-07-17T11:59:30Z",
)

@OptIn(ExperimentalCoroutinesApi::class)
class PresenceMainDispatcherRule(
    val dispatcher: TestDispatcher = StandardTestDispatcher(),
) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)
    override fun finished(description: Description) = Dispatchers.resetMain()
}
