package space.fishhub.android.data.presence.remote

import space.fishhub.android.data.presence.PresenceCommandResult
import space.fishhub.android.data.presence.PresencePreference
import space.fishhub.android.data.presence.PresencePreferenceSetting
import space.fishhub.android.data.presence.PresenceSnapshot
import space.fishhub.android.data.presence.PresenceStatus
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
internal data class PresenceSnapshotDto(
    @SerialName("user_id") val userId: String,
    val status: String,
    @SerialName("last_heartbeat_at") val lastHeartbeatAt: String? = null,
    @SerialName("last_seen_at") val lastSeenAt: String? = null,
    val revision: Long,
    @SerialName("updated_at") val updatedAt: String,
)

@Serializable
internal data class PresencePreferenceDto(
    val mode: String,
    @SerialName("expires_at") val expiresAt: String? = null,
)

@Serializable
internal data class TouchPresenceRequest(
    @SerialName("p_session_id") val sessionId: String,
    @SerialName("p_activity") val activity: Boolean,
    @SerialName("p_ended") val ended: Boolean,
)

@Serializable
internal data class PresenceCommandRequest(
    val mode: String,
    val durationSeconds: Int? = null,
)

@Serializable
internal data class PresenceCommandResponse(
    val snapshot: PresenceCommandSnapshotDto,
    val setting: PresenceCommandSettingDto,
)

@Serializable
internal data class PresenceCommandSnapshotDto(
    val userId: String,
    val status: String,
    val lastHeartbeatAt: String? = null,
    val lastSeenAt: String? = null,
    val revision: Long,
    val updatedAt: String,
)

@Serializable
internal data class PresenceCommandSettingDto(
    val preference: String,
    val expiresAt: String? = null,
)

@Serializable
internal data class PresencePreferenceBroadcastDto(
    val mode: String,
    val expiresAt: String? = null,
    val revision: Long,
)

@Serializable
internal data class PresenceSubjectsBroadcastDto(val revision: Long? = null)

@Serializable
internal data class CalmErrorDto(val code: String? = null, val error: String? = null)

internal fun PresenceSnapshotDto.toDomain(): PresenceSnapshot = PresenceSnapshot(
    userId = userId,
    status = status.toPresenceStatus(),
    lastHeartbeatAt = lastHeartbeatAt,
    lastSeenAt = lastSeenAt,
    revision = revision,
    updatedAt = updatedAt,
)

internal fun PresenceCommandResponse.toDomain(): PresenceCommandResult = PresenceCommandResult(
    snapshot = PresenceSnapshot(
        userId = snapshot.userId,
        status = snapshot.status.toPresenceStatus(),
        lastHeartbeatAt = snapshot.lastHeartbeatAt,
        lastSeenAt = snapshot.lastSeenAt,
        revision = snapshot.revision,
        updatedAt = snapshot.updatedAt,
    ),
    setting = PresencePreferenceSetting(
        preference = setting.preference.toPresencePreference(),
        expiresAt = setting.expiresAt,
    ),
)

internal fun String.toPresenceStatus(): PresenceStatus = when (this) {
    "online" -> PresenceStatus.Online
    "idle" -> PresenceStatus.Idle
    "away" -> PresenceStatus.Away
    "busy" -> PresenceStatus.Busy
    "offline" -> PresenceStatus.Offline
    else -> throw IllegalArgumentException("Unknown presence status")
}

internal fun String.toPresencePreference(): PresencePreference = when (this) {
    "automatic" -> PresencePreference.Automatic
    "away" -> PresencePreference.Away
    "busy" -> PresencePreference.Busy
    "invisible" -> PresencePreference.Invisible
    else -> throw IllegalArgumentException("Unknown presence preference")
}

internal fun PresencePreference.toWire(): String = name.lowercase()
