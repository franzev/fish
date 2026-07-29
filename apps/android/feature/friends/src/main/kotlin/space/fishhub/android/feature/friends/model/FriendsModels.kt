package space.fishhub.android.feature.friends.model

import androidx.compose.runtime.Immutable
import space.fishhub.android.data.friends.FriendCandidate
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.IncomingFriendRequest

/**
 * Add a friend is a two-step screen, never a results list: a username goes in
 * and at most one person comes back.
 */
@Immutable
sealed interface AddFriendUiState {
    /**
     * [fieldNotice] belongs beside the field (an empty username); [notice]
     * belongs to the whole screen (the lookup never reached the server).
     */
    data class Input(
        val notice: String? = null,
        val fieldNotice: String? = null,
        val searching: Boolean = false,
    ) : AddFriendUiState

    /**
     * [clientRequestId] is minted once per found person so a retried tap
     * replays the first request instead of sending a second one.
     */
    data class Candidate(
        val candidate: FriendCandidate,
        val clientRequestId: String,
        val sending: Boolean = false,
        val sent: Boolean = false,
        val notice: String? = null,
    ) : AddFriendUiState
}

@Immutable
sealed interface FriendRequestsUiState {
    data object Loading : FriendRequestsUiState

    /**
     * [respondingWith] keeps each request single-flight and remembers which
     * answer is on its way, so the spinner sits on the button they tapped.
     */
    data class Loaded(
        val requests: List<IncomingFriendRequest>,
        val respondingWith: Map<String, FriendRequestResponse> = emptyMap(),
        val notice: String? = null,
    ) : FriendRequestsUiState

    data class Failed(val notice: String) : FriendRequestsUiState
}
