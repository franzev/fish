package space.fishhub.android.data.presence

import kotlinx.coroutines.flow.StateFlow

interface PresenceRepository {
    val state: StateFlow<PresenceState>

    fun setAppForegrounded(foregrounded: Boolean)
    fun markActive()

    suspend fun setPreference(
        preference: PresencePreference,
        duration: PresenceDuration,
    ): PresenceResult<PresenceCommandResult>

    suspend fun endSession()
}
