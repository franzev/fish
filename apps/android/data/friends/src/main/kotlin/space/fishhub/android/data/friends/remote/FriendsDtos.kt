package space.fishhub.android.data.friends.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import space.fishhub.android.data.friends.FriendCandidate
import space.fishhub.android.data.friends.FriendCandidateStatus
import space.fishhub.android.data.friends.FriendEvent
import space.fishhub.android.data.friends.FriendEventReason
import space.fishhub.android.data.friends.FriendProfile
import space.fishhub.android.data.friends.FriendRequestOutcome
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.IncomingFriendRequest

// Reads come from `security definer` RPCs and keep the database's snake_case.

@Serializable
internal data class FriendProfileDto(
    val id: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    val username: String? = null,
)

@Serializable
internal data class FriendCandidateDto(
    val status: String? = null,
    @SerialName("request_id") val requestId: String? = null,
    val profile: FriendProfileDto? = null,
)

@Serializable
internal data class IncomingFriendRequestDto(
    @SerialName("request_id") val requestId: String,
    @SerialName("sender_id") val senderId: String,
    @SerialName("display_name") val displayName: String,
    val username: String,
    @SerialName("created_at") val createdAt: String,
)

// Writes go through the `friend-command` Edge Function, which speaks camelCase.

@Serializable
internal data class SendFriendRequestBody(
    val action: String = "send-request",
    val targetId: String,
    val clientRequestId: String,
)

@Serializable
internal data class RespondFriendRequestBody(
    val action: String = "respond-request",
    val requestId: String,
    val response: String,
)

@Serializable
internal data class FriendCommandResponseDto(val request: FriendRequestDto? = null)

@Serializable
internal data class FriendCommandFailureDto(
    val code: String? = null,
    val error: String? = null,
)

@Serializable
internal data class FriendRequestDto(
    val id: String,
    val status: String,
)

@Serializable
internal data class FriendEventDto(
    val reason: String? = null,
    val requestId: String? = null,
    val friendshipId: String? = null,
)

/** Codes the repository branches on; every other code is just a calm message. */
internal object FriendCommandCode {
    const val RequestPending = "request_pending"
    const val AlreadyFriends = "already_friends"
    const val IncomingRequestExists = "incoming_request_exists"
    const val NotAuthenticated = "not_authenticated"
    const val FriendsUnavailable = "friends_unavailable"
}

internal object FriendRequestStatus {
    const val Pending = "pending"
    const val Accepted = "accepted"
}

/**
 * Mirrors the web mapping: an unrecognised status and a missing profile both
 * land on [FriendCandidateStatus.Unavailable], so a client can never infer why
 * someone is out of reach.
 */
internal fun FriendCandidateDto.toDomain(): FriendCandidate {
    val profile = profile?.toDomainOrNull()
    val status = when (status) {
        "none" -> FriendCandidateStatus.None
        "friends" -> FriendCandidateStatus.Friends
        "outgoing_pending" -> FriendCandidateStatus.OutgoingPending
        "incoming_pending" -> FriendCandidateStatus.IncomingPending
        else -> FriendCandidateStatus.Unavailable
    }
    return FriendCandidate(
        status = if (profile == null) FriendCandidateStatus.Unavailable else status,
        profile = profile,
        requestId = requestId,
    )
}

internal fun FriendProfileDto.toDomainOrNull(): FriendProfile? {
    val id = id ?: return null
    val displayName = displayName ?: return null
    val username = username ?: return null
    return FriendProfile(id = id, displayName = displayName, username = username)
}

internal fun IncomingFriendRequestDto.toDomain(): IncomingFriendRequest = IncomingFriendRequest(
    requestId = requestId,
    sender = FriendProfile(id = senderId, displayName = displayName, username = username),
    createdAt = createdAt,
)

internal fun FriendRequestDto.toDomain(): FriendRequestOutcome = FriendRequestOutcome(
    requestId = id,
    status = status,
)

internal fun FriendEventDto.toDomain(): FriendEvent = FriendEvent(
    reason = when (reason) {
        "request_created" -> FriendEventReason.RequestCreated
        "request_accepted" -> FriendEventReason.RequestAccepted
        "request_declined" -> FriendEventReason.RequestDeclined
        "request_cancelled" -> FriendEventReason.RequestCancelled
        "friendship_created" -> FriendEventReason.FriendshipCreated
        "friendship_removed" -> FriendEventReason.FriendshipRemoved
        else -> FriendEventReason.Unknown
    },
    requestId = requestId,
    friendshipId = friendshipId,
)

internal fun FriendRequestResponse.toWire(): String = name.lowercase()
