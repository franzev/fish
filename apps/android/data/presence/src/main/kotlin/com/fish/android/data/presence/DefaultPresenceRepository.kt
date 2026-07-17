package com.fish.android.data.presence

import com.fish.android.data.presence.remote.PresenceRealtimeEvent
import com.fish.android.data.presence.remote.PresenceRemoteDataSource
import com.fish.android.data.presence.remote.PresenceRemoteException
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

internal class DefaultPresenceRepository(
    private val remote: PresenceRemoteDataSource,
    authUserId: StateFlow<String?>,
    parentScope: CoroutineScope,
    private val diagnostics: PresenceDiagnostics = NoOpPresenceDiagnostics,
    private val nowMs: () -> Long = System::currentTimeMillis,
    private val delayMs: suspend (Long) -> Unit = { delay(it) },
    private val sessionId: String = UUID.randomUUID().toString(),
) : PresenceRepository {
    private val scope = CoroutineScope(parentScope.coroutineContext + SupervisorJob())
    private val foregrounded = MutableStateFlow(false)
    private val mutableState = MutableStateFlow(PresenceState())
    private val writeMutex = Mutex()
    private val refreshMutex = Mutex()
    private val immediateHeartbeats = Channel<Unit>(Channel.CONFLATED)

    @Volatile private var lastActivityAtMs = nowMs()
    @Volatile private var activeIdentity: String? = null
    @Volatile private var activeSessionEnded = false
    private val activityVersion = AtomicLong(0)
    @Volatile private var sentActivityVersion = 0L

    override val state = mutableState.asStateFlow()

    init {
        scope.launch {
            combine(authUserId, foregrounded) { userId, isForegrounded ->
                userId to isForegrounded
            }.collectLatest { (userId, isForegrounded) ->
                if (userId == null) {
                    activeIdentity = null
                    mutableState.value = PresenceState()
                } else if (isForegrounded) {
                    runSession(userId)
                } else {
                    mutableState.value = mutableState.value.copy(
                        currentUserId = userId,
                        connection = PresenceConnectionState.Disconnected,
                    )
                }
            }
        }
    }

    override fun setAppForegrounded(foregrounded: Boolean) {
        this.foregrounded.value = foregrounded
    }

    override fun markActive() {
        val now = nowMs()
        val wasIdle = now - lastActivityAtMs >= IdleAfterMs
        lastActivityAtMs = now
        activityVersion.incrementAndGet()
        if (wasIdle && foregrounded.value && activeIdentity != null) {
            immediateHeartbeats.trySend(Unit)
        }
    }

    override suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ): PresenceResult<PresenceCommandResult> {
        if (activeIdentity == null) {
            return PresenceResult.Failure("Sign in to change your status.")
        }
        val started = nowMs()
        return try {
            val result = writeMutex.withLock { remote.setPreference(preference, duration) }
            mergeCommand(result)
            diagnostics.record(
                PresenceDiagnosticEvent(
                    PresenceOperation.SetPreference,
                    succeeded = true,
                    durationMs = nowMs() - started,
                ),
            )
            PresenceResult.Success(result)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            diagnostics.record(
                PresenceDiagnosticEvent(
                    PresenceOperation.SetPreference,
                    succeeded = false,
                    durationMs = nowMs() - started,
                    failureCategory = error.failureCategory(),
                ),
            )
            PresenceResult.Failure(
                (error as? PresenceRemoteException)?.message
                    ?: "Your status could not change. Try again.",
            )
        }
    }

    override suspend fun endSession() {
        if (activeIdentity == null) return
        withTimeoutOrNull(EndSessionTimeoutMs) {
            touchWithRetry(activity = false, ended = true, retry = false)
        }
        activeSessionEnded = true
    }

    internal fun close() {
        scope.cancel()
    }

    private suspend fun runSession(userId: String): Unit = coroutineScope {
        activeIdentity = userId
        activeSessionEnded = false
        lastActivityAtMs = nowMs()
        val initialActivityVersion = activityVersion.incrementAndGet()
        mutableState.value = PresenceState(
            currentUserId = userId,
            connection = PresenceConnectionState.Connecting,
        )
        try {
            if (touchWithRetry(activity = true, ended = false)) {
                sentActivityVersion = initialActivityVersion
            }
            refresh(userId)
            val realtimeJob = launch { collectRealtime(userId) }
            refresh(userId)
            val heartbeatJob = launch { heartbeatLoop() }
            try {
                awaitCancellation()
            } finally {
                realtimeJob.cancelAndJoin()
                heartbeatJob.cancelAndJoin()
            }
        } finally {
            withContext(NonCancellable) {
                if (activeIdentity == userId && !activeSessionEnded) {
                    runCatching {
                        withTimeoutOrNull(EndSessionTimeoutMs) {
                            touchWithRetry(activity = false, ended = true, retry = false)
                        }
                    }
                }
                if (activeIdentity == userId) activeIdentity = null
            }
        }
    }

    private suspend fun heartbeatLoop() {
        while (true) {
            coroutineScope {
                val interval = launch {
                    delayMs(HeartbeatIntervalMs)
                    sendHeartbeat()
                }
                val immediate = launch {
                    immediateHeartbeats.receive()
                    sendHeartbeat()
                }
                kotlinx.coroutines.selects.select<Unit> {
                    interval.onJoin { immediate.cancel() }
                    immediate.onJoin { interval.cancel() }
                }
            }
        }
    }

    private suspend fun sendHeartbeat() {
        val version = activityVersion.get()
        val hasRecentActivity = version > sentActivityVersion
        if (touchWithRetry(activity = hasRecentActivity, ended = false) && hasRecentActivity) {
            sentActivityVersion = version
        }
    }

    private suspend fun collectRealtime(userId: String) {
        var subjects = mutableState.value.snapshots.keys
        while (activeIdentity == userId) {
            var rebuildImmediately = false
            try {
                remote.observeRealtime(userId, subjects).collect { event ->
                    when (event) {
                        PresenceRealtimeEvent.Connected -> {
                            mutableState.value = mutableState.value.copy(
                                connection = PresenceConnectionState.Connected,
                            )
                            refresh(userId)
                            val refreshedSubjects = mutableState.value.snapshots.keys
                            if (refreshedSubjects != subjects) {
                                subjects = refreshedSubjects
                                throw RebuildRealtimeSubscription
                            }
                        }
                        PresenceRealtimeEvent.Disconnected -> {
                            mutableState.value = mutableState.value.copy(
                                connection = PresenceConnectionState.Disconnected,
                            )
                        }
                        PresenceRealtimeEvent.SubjectsChanged -> {
                            refresh(userId)
                            subjects = mutableState.value.snapshots.keys
                            throw RebuildRealtimeSubscription
                        }
                        is PresenceRealtimeEvent.PreferenceChanged ->
                            mergePreference(event.setting, event.revision)
                        is PresenceRealtimeEvent.SnapshotChanged -> mergeSnapshot(event.snapshot)
                    }
                }
            } catch (_: RebuildRealtimeSubscription) {
                // Recreate the RLS-filtered channels with the authoritative subject directory.
                rebuildImmediately = true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                diagnostics.record(
                    PresenceDiagnosticEvent(
                        PresenceOperation.Realtime,
                        false,
                        0,
                        error.failureCategory(),
                    ),
                )
            }
            if (activeIdentity == userId && !rebuildImmediately) delayMs(RealtimeRetryMs)
            subjects = mutableState.value.snapshots.keys
        }
    }

    private suspend fun refresh(userId: String): Unit = refreshMutex.withLock {
        if (activeIdentity != userId) return
        val started = nowMs()
        try {
            val snapshots = remote.listVisible()
            val preference = remote.getOwnPreference()
            if (activeIdentity != userId) return
            val previous = mutableState.value
            val replacement = snapshots.associateBy(PresenceSnapshot::userId).mapValues { (id, next) ->
                val current = previous.snapshots[id]
                if (current != null && current.revision > next.revision) current else next
            }
            mutableState.value = previous.copy(
                currentUserId = userId,
                snapshots = replacement,
                ownPreference = preference,
            )
            diagnostics.record(
                PresenceDiagnosticEvent(PresenceOperation.Refresh, true, nowMs() - started),
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Throwable) {
            mutableState.value = mutableState.value.copy(
                connection = PresenceConnectionState.Disconnected,
            )
            diagnostics.record(
                PresenceDiagnosticEvent(
                    PresenceOperation.Refresh,
                    false,
                    nowMs() - started,
                    error.failureCategory(),
                ),
            )
        }
    }

    private fun mergeSnapshot(snapshot: PresenceSnapshot) {
        val current = mutableState.value
        if (snapshot.userId !in current.snapshots) return
        val existing = current.snapshots[snapshot.userId]
        if (existing != null && snapshot.revision <= existing.revision) return
        mutableState.value = current.copy(
            snapshots = current.snapshots + (snapshot.userId to snapshot),
        )
    }

    private fun mergePreference(setting: PresencePreferenceSetting, revision: Long) {
        val current = mutableState.value
        if (revision <= current.preferenceRevision) return
        mutableState.value = current.copy(
            ownPreference = setting,
            preferenceRevision = revision,
        )
    }

    private fun mergeCommand(result: PresenceCommandResult) {
        val current = mutableState.value
        val existing = current.snapshots[result.snapshot.userId]
        val snapshots = if (existing == null || result.snapshot.revision > existing.revision) {
            current.snapshots + (result.snapshot.userId to result.snapshot)
        } else {
            current.snapshots
        }
        if (result.snapshot.revision < current.preferenceRevision) return
        mutableState.value = current.copy(
            snapshots = snapshots,
            ownPreference = result.setting,
            preferenceRevision = result.snapshot.revision,
        )
    }

    private suspend fun touchWithRetry(
        activity: Boolean,
        ended: Boolean,
        retry: Boolean = true,
    ): Boolean {
        val delays = if (retry) RetryDelaysMs else emptyList()
        var attempt = 0
        while (true) {
            val started = nowMs()
            try {
                val snapshot = writeMutex.withLock {
                    remote.touchSession(sessionId, activity, ended)
                }
                mergeSnapshot(snapshot)
                diagnostics.record(
                    PresenceDiagnosticEvent(
                        if (ended) PresenceOperation.EndSession else PresenceOperation.Heartbeat,
                        true,
                        nowMs() - started,
                    ),
                )
                return true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                if (attempt >= delays.size) {
                    diagnostics.record(
                        PresenceDiagnosticEvent(
                            if (ended) PresenceOperation.EndSession else PresenceOperation.Heartbeat,
                            false,
                            nowMs() - started,
                            error.failureCategory(),
                        ),
                    )
                    return false
                }
                delayMs(delays[attempt++])
            }
        }
    }

    private fun Throwable.failureCategory(): PresenceFailureCategory = when (this) {
        is IllegalArgumentException -> PresenceFailureCategory.Malformed
        is PresenceRemoteException -> PresenceFailureCategory.Remote
        else -> PresenceFailureCategory.Network
    }

    private companion object {
        const val HeartbeatIntervalMs = 30_000L
        const val IdleAfterMs = 5 * 60_000L
        const val RealtimeRetryMs = 5_000L
        const val EndSessionTimeoutMs = 3_000L
        val RetryDelaysMs = listOf(5_000L, 10_000L, 30_000L)
    }
}

private object RebuildRealtimeSubscription : CancellationException()
