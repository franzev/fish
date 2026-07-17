package com.fish.android.data.presence.remote

import com.fish.android.data.presence.PresenceCommandResult
import com.fish.android.data.presence.PresenceDuration
import com.fish.android.data.presence.PresencePreference
import com.fish.android.data.presence.PresencePreferenceSetting
import com.fish.android.data.presence.PresenceSnapshot
import kotlinx.coroutines.flow.Flow

internal sealed interface PresenceRealtimeEvent {
    data class SnapshotChanged(val snapshot: PresenceSnapshot) : PresenceRealtimeEvent
    data class PreferenceChanged(
        val setting: PresencePreferenceSetting,
        val revision: Long,
    ) : PresenceRealtimeEvent
    data object SubjectsChanged : PresenceRealtimeEvent
    data object Connected : PresenceRealtimeEvent
    data object Disconnected : PresenceRealtimeEvent
}

internal interface PresenceRemoteDataSource {
    suspend fun listVisible(): List<PresenceSnapshot>
    suspend fun getOwnPreference(): PresencePreferenceSetting
    suspend fun touchSession(sessionId: String, activity: Boolean, ended: Boolean): PresenceSnapshot
    suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ): PresenceCommandResult
    fun observeRealtime(userId: String, subjectIds: Set<String>): Flow<PresenceRealtimeEvent>
}
