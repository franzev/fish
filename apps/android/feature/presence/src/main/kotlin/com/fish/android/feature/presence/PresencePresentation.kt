package com.fish.android.feature.presence

import androidx.compose.runtime.Immutable
import com.fish.android.data.presence.PresenceConnectionState
import com.fish.android.data.presence.PresenceDisplayStatus
import com.fish.android.data.presence.PresencePreference

@Immutable
data class PresencePresentation(
    val status: PresenceDisplayStatus = PresenceDisplayStatus.Offline,
    val label: String = "Offline",
    val detail: String? = null,
)

@Immutable
data class PresenceUiState(
    val currentUserId: String? = null,
    val own: PresencePresentation = PresencePresentation(),
    val ownPreference: PresencePreference = PresencePreference.Automatic,
    val subjects: Map<String, PresencePresentation> = emptyMap(),
    val connection: PresenceConnectionState = PresenceConnectionState.SignedOut,
    val updating: Boolean = false,
    val notice: String? = null,
) {
    fun presentationFor(userId: String?): PresencePresentation =
        userId?.let(subjects::get) ?: PresencePresentation()
}
