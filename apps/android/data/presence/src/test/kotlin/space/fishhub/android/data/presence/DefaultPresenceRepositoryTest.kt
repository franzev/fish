package space.fishhub.android.data.presence

import space.fishhub.android.data.presence.remote.PresenceRealtimeEvent
import space.fishhub.android.data.presence.remote.PresenceRemoteDataSource
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DefaultPresenceRepositoryTest {
    @Test
    fun `heartbeat failures retry at five ten and thirty seconds`() = runTest {
        val remote = FakePresenceRemote().apply { touchFailuresRemaining = 3 }
        val repository = DefaultPresenceRepository(
            remote,
            MutableStateFlow("me"),
            this,
            sessionId = "session",
        )

        repository.setAppForegrounded(true)
        runCurrent()
        assertEquals(1, remote.touchAttempts)
        advanceTimeBy(5_000)
        runCurrent()
        assertEquals(2, remote.touchAttempts)
        advanceTimeBy(10_000)
        runCurrent()
        assertEquals(3, remote.touchAttempts)
        advanceTimeBy(30_000)
        runCurrent()
        assertEquals(4, remote.touchAttempts)

        repository.close()
        runCurrent()
    }

    @Test
    fun `foreground auth starts immediately and background ends the session`() = runTest {
        val auth = MutableStateFlow<String?>("me")
        val remote = FakePresenceRemote()
        val repository = DefaultPresenceRepository(remote, auth, this, sessionId = "session")

        repository.setAppForegrounded(true)
        runCurrent()

        assertTrue(remote.touches.first().activity)
        assertFalse(remote.touches.first().ended)
        assertEquals(setOf("me", "friend"), repository.state.value.snapshots.keys)

        repository.setAppForegrounded(false)
        runCurrent()

        assertTrue(remote.touches.last().ended)
        repository.close()
        runCurrent()
    }

    @Test
    fun `heartbeat runs every thirty seconds and idle return sends activity`() = runTest {
        var now = 0L
        val remote = FakePresenceRemote()
        val repository = DefaultPresenceRepository(
            remote = remote,
            authUserId = MutableStateFlow("me"),
            parentScope = this,
            nowMs = { now },
            sessionId = "session",
        )
        repository.setAppForegrounded(true)
        runCurrent()
        val immediateCount = remote.touches.size

        advanceTimeBy(30_000)
        now += 30_000
        runCurrent()
        assertEquals(immediateCount + 1, remote.touches.size)
        assertFalse(remote.touches.last().activity)

        now += 5 * 60_000
        repository.markActive()
        runCurrent()
        assertTrue(remote.touches.last().activity)
        repository.close()
        runCurrent()
    }

    @Test
    fun `only newer revisions merge and revoked subjects reject late events`() = runTest {
        val remote = FakePresenceRemote()
        val repository = DefaultPresenceRepository(
            remote,
            MutableStateFlow("me"),
            this,
            sessionId = "session",
        )
        repository.setAppForegrounded(true)
        runCurrent()

        remote.events.emit(PresenceRealtimeEvent.SnapshotChanged(snapshot("friend", 1, PresenceStatus.Away)))
        runCurrent()
        assertEquals(PresenceStatus.Online, repository.state.value.snapshots["friend"]?.status)

        remote.events.emit(PresenceRealtimeEvent.SnapshotChanged(snapshot("friend", 3, PresenceStatus.Away)))
        runCurrent()
        assertEquals(PresenceStatus.Away, repository.state.value.snapshots["friend"]?.status)

        remote.visible = listOf(snapshot("me", 4))
        remote.events.emit(PresenceRealtimeEvent.SubjectsChanged)
        runCurrent()
        assertFalse("friend" in repository.state.value.snapshots)
        repository.close()
        runCurrent()

        remote.events.emit(PresenceRealtimeEvent.SnapshotChanged(snapshot("friend", 9)))
        runCurrent()
        assertFalse("friend" in repository.state.value.snapshots)
    }

    @Test
    fun `preference result updates only when it is not superseded`() = runTest {
        val remote = FakePresenceRemote()
        val repository = DefaultPresenceRepository(
            remote,
            MutableStateFlow("me"),
            this,
            sessionId = "session",
        )
        repository.setAppForegrounded(true)
        runCurrent()
        remote.events.emit(
            PresenceRealtimeEvent.PreferenceChanged(
                PresencePreferenceSetting(PresencePreference.Busy),
                revision = 10,
            ),
        )
        runCurrent()

        remote.commandResult = PresenceCommandResult(
            snapshot = snapshot("me", 8, PresenceStatus.Away),
            setting = PresencePreferenceSetting(PresencePreference.Away),
        )
        repository.setPreference(PresencePreference.Away, PresenceDuration.OneHour)

        assertEquals(PresencePreference.Busy, repository.state.value.ownPreference.preference)
        assertEquals(10, repository.state.value.preferenceRevision)
        repository.close()
        runCurrent()
    }
}

private data class Touch(val activity: Boolean, val ended: Boolean)

private class FakePresenceRemote : PresenceRemoteDataSource {
    var visible = listOf(snapshot("me", 2), snapshot("friend", 2))
    val touches = mutableListOf<Touch>()
    val events = MutableSharedFlow<PresenceRealtimeEvent>(extraBufferCapacity = 8)
    var commandResult = PresenceCommandResult(
        snapshot = snapshot("me", 3, PresenceStatus.Away),
        setting = PresencePreferenceSetting(PresencePreference.Away),
    )
    var touchFailuresRemaining = 0
    var touchAttempts = 0

    override suspend fun listVisible() = visible
    override suspend fun getOwnPreference() = PresencePreferenceSetting()
    override suspend fun touchSession(
        sessionId: String,
        activity: Boolean,
        ended: Boolean,
    ): PresenceSnapshot {
        touchAttempts += 1
        if (touchFailuresRemaining > 0) {
            touchFailuresRemaining -= 1
            throw java.io.IOException("offline")
        }
        touches += Touch(activity, ended)
        return snapshot("me", touches.size.toLong(), if (ended) PresenceStatus.Offline else PresenceStatus.Online)
    }
    override suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ) = commandResult

    override fun observeRealtime(
        userId: String,
        subjectIds: Set<String>,
    ): Flow<PresenceRealtimeEvent> = flow {
        emit(PresenceRealtimeEvent.Connected)
        events.collect { emit(it) }
        awaitCancellation()
    }
}

private fun snapshot(
    userId: String,
    revision: Long,
    status: PresenceStatus = PresenceStatus.Online,
) = PresenceSnapshot(
    userId = userId,
    status = status,
    lastHeartbeatAt = Instant.ofEpochMilli(1_000).toString(),
    lastSeenAt = Instant.ofEpochMilli(1_000).toString(),
    revision = revision,
    updatedAt = Instant.ofEpochMilli(1_000).toString(),
)
