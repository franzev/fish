package space.fishhub.android.data.friends

import kotlinx.coroutines.flow.Flow

sealed interface FriendsResult<out T> {
    data class Success<T>(val value: T) : FriendsResult<T>

    /**
     * [message] is the server's own calm copy whenever the server sent any, so
     * friends never speaks in a voice the product did not author.
     */
    data class Failure(
        val message: String,
        val recoverable: Boolean,
    ) : FriendsResult<Nothing>
}

interface FriendsRepository {
    /** Exact-username lookup returning at most one candidate. */
    suspend fun searchCandidate(username: String): FriendsResult<FriendCandidate>

    suspend fun listIncomingRequests(): FriendsResult<List<IncomingFriendRequest>>

    suspend fun countIncomingRequests(): FriendsResult<Int>

    /**
     * [clientRequestId] makes the send idempotent: retrying the same candidate
     * with the same id replays the first request instead of making a second.
     */
    suspend fun sendRequest(
        targetId: String,
        clientRequestId: String,
    ): FriendsResult<SendFriendRequestOutcome>

    suspend fun respondRequest(
        requestId: String,
        response: FriendRequestResponse,
    ): FriendsResult<FriendRequestOutcome>

    /** Hints that something about this person's friends changed; refetch to learn what. */
    fun events(userId: String): Flow<FriendEvent>
}
