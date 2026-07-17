package com.fish.android.data.presence

enum class PresenceStatus { Online, Idle, Away, Busy, Offline }

enum class PresenceDisplayStatus { Online, Idle, Away, Busy, Invisible, Offline }

enum class PresencePreference { Automatic, Away, Busy, Invisible }

enum class PresenceDuration(val seconds: Int?) {
    FifteenMinutes(900),
    OneHour(3_600),
    EightHours(28_800),
    OneDay(86_400),
    ThreeDays(259_200),
    Forever(null),
}

data class PresenceSnapshot(
    val userId: String,
    val status: PresenceStatus,
    val lastHeartbeatAt: String?,
    val lastSeenAt: String?,
    val revision: Long,
    val updatedAt: String,
)

data class PresencePreferenceSetting(
    val preference: PresencePreference = PresencePreference.Automatic,
    val expiresAt: String? = null,
)

enum class PresenceConnectionState { SignedOut, Connecting, Connected, Disconnected }

data class PresenceState(
    val currentUserId: String? = null,
    val snapshots: Map<String, PresenceSnapshot> = emptyMap(),
    val ownPreference: PresencePreferenceSetting = PresencePreferenceSetting(),
    val preferenceRevision: Long = 0,
    val connection: PresenceConnectionState = PresenceConnectionState.SignedOut,
)

data class PresenceCommandResult(
    val snapshot: PresenceSnapshot,
    val setting: PresencePreferenceSetting,
)

sealed interface PresenceResult<out T> {
    data class Success<T>(val value: T) : PresenceResult<T>
    data class Failure(val message: String) : PresenceResult<Nothing>
}
