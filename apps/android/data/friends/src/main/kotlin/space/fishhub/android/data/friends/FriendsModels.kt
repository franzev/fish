package space.fishhub.android.data.friends

/**
 * Every reason a person cannot be added collapses into [Unavailable]. The
 * server deliberately refuses to distinguish "no such username" from "blocked
 * you" from "declined you recently", and neither may this client.
 */
enum class FriendCandidateStatus { None, Friends, OutgoingPending, IncomingPending, Unavailable }

data class FriendProfile(
    val id: String,
    val displayName: String,
    val username: String,
)

data class FriendCandidate(
    val status: FriendCandidateStatus,
    val profile: FriendProfile? = null,
    val requestId: String? = null,
)

/**
 * [createdAt] stays the server's ISO-8601 string, matching every other
 * timestamp that crosses an Android data-module boundary here.
 */
data class IncomingFriendRequest(
    val requestId: String,
    val sender: FriendProfile,
    val createdAt: String,
)

enum class FriendEventReason {
    RequestCreated,
    RequestAccepted,
    RequestDeclined,
    RequestCancelled,
    FriendshipCreated,
    FriendshipRemoved,
    Unknown,
}

/**
 * A wake-up hint, never state. Ids are carried so a consumer can tell which
 * surface to refetch; nothing may be rendered from an event directly.
 */
data class FriendEvent(
    val reason: FriendEventReason,
    val requestId: String? = null,
    val friendshipId: String? = null,
)

enum class FriendRequestResponse { Accept, Decline }

/**
 * The server's own view of one friend request after a command.
 *
 * [status] is the server's literal: `pending`, `accepted`, `declined`, or
 * `cancelled`. [requestId] is null when the server answered with a conflict
 * code instead of a row — "already on its way" and "already friends" carry a
 * status but no request to point at.
 */
data class FriendRequestOutcome(
    val requestId: String?,
    val status: String,
)

sealed interface SendFriendRequestOutcome {
    /** The request the server ended up with, whether freshly made or replayed. */
    data class Requested(val request: FriendRequestOutcome) : SendFriendRequestOutcome

    /**
     * They asked first, between the search and the tap. The candidate has to be
     * looked up again to recover the request id so review is one step away.
     */
    data object IncomingExists : SendFriendRequestOutcome
}
