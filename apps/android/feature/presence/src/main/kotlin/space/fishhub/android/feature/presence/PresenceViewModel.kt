package space.fishhub.android.feature.presence

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import space.fishhub.android.data.presence.PresenceDuration
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.data.presence.PresencePreferenceSetting
import space.fishhub.android.data.presence.PresenceRepository
import space.fishhub.android.data.presence.PresenceResult
import java.time.Instant
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class PresenceViewModel(
    private val repository: PresenceRepository,
    private val formatter: PresenceFormatter,
    private val nowMs: () -> Long = System::currentTimeMillis,
    clock: Flow<Long>? = null,
) : ViewModel() {
    private data class Mutation(
        val id: Long,
        val setting: PresencePreferenceSetting,
        val baseRevision: Long,
    )

    private val mutation = MutableStateFlow<Mutation?>(null)
    private val notice = MutableStateFlow<String?>(null)
    private val successes = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    private var nextMutationId = 0L
    val preferenceConfirmed = successes.asSharedFlow()

    private val ticks = clock ?: flow {
        while (true) {
            emit(nowMs())
            delay(ClockIntervalMs)
        }
    }

    val uiState = combine(repository.state, ticks, mutation, notice) {
            repositoryState, now, optimisticMutation, currentNotice ->
        val expiresAtMs = optimisticMutation?.setting?.expiresAt?.toEpochMsOrNull()
            ?: repositoryState.ownPreference.expiresAt.toEpochMsOrNull()
        val expired = expiresAtMs != null && expiresAtMs <= now
        val effectiveSetting = when {
            expired -> PresencePreferenceSetting()
            optimisticMutation != null -> optimisticMutation.setting
            else -> repositoryState.ownPreference
        }
        val subjects = repositoryState.snapshots.mapValues { (_, snapshot) ->
            formatter.format(snapshot, now)
        }
        val ownSnapshot = repositoryState.currentUserId?.let(repositoryState.snapshots::get)
        PresenceUiState(
            currentUserId = repositoryState.currentUserId,
            own = formatter.format(
                snapshot = ownSnapshot,
                nowMs = now,
                ownPreference = effectiveSetting.preference,
                ownPreferenceExpired = expired,
            ),
            ownPreference = effectiveSetting.preference,
            subjects = subjects,
            connection = repositoryState.connection,
            updating = optimisticMutation != null,
            notice = currentNotice,
        )
    }.stateIn(viewModelScope, SharingStarted.Eagerly, PresenceUiState())

    fun setPreference(preference: PresencePreference, duration: PresenceDuration) {
        if (mutation.value != null) return
        val repositoryState = repository.state.value
        val expiresAt = duration.seconds?.let { seconds ->
            Instant.ofEpochMilli(nowMs() + seconds * 1_000L).toString()
        }
        val id = ++nextMutationId
        mutation.value = Mutation(
            id = id,
            setting = PresencePreferenceSetting(preference, expiresAt),
            baseRevision = repositoryState.preferenceRevision,
        )
        notice.value = null
        viewModelScope.launch {
            when (val result = repository.setPreference(preference, duration)) {
                is PresenceResult.Success -> {
                    val current = mutation.value
                    if (current?.id != id) return@launch
                    mutation.value = null
                    if (repository.state.value.preferenceRevision <= result.value.snapshot.revision) {
                        successes.tryEmit(Unit)
                    }
                }
                is PresenceResult.Failure -> {
                    val current = mutation.value
                    if (current?.id != id) return@launch
                    mutation.value = null
                    notice.value = result.message
                }
            }
        }
    }

    fun clearNotice() {
        notice.value = null
    }

    private fun String?.toEpochMsOrNull(): Long? =
        this?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }

    private companion object {
        const val ClockIntervalMs = 15_000L
    }
}
