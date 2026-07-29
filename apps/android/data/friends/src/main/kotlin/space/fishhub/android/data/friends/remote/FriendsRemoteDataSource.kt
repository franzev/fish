package space.fishhub.android.data.friends.remote

import kotlinx.coroutines.flow.Flow
import space.fishhub.android.data.friends.FriendCandidate
import space.fishhub.android.data.friends.FriendEvent
import space.fishhub.android.data.friends.FriendRequestOutcome
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.IncomingFriendRequest

internal interface FriendsRemoteDataSource {
    suspend fun searchCandidate(username: String): FriendCandidate
    suspend fun listIncomingRequests(): List<IncomingFriendRequest>
    suspend fun countIncomingRequests(): Int
    suspend fun sendRequest(targetId: String, clientRequestId: String): FriendRequestOutcome
    suspend fun respondRequest(
        requestId: String,
        response: FriendRequestResponse,
    ): FriendRequestOutcome
    fun events(userId: String): Flow<FriendEvent>
}

/**
 * Carries the server's `code` so the repository can branch on the two
 * conflicts that are really successes, plus the server's calm `error` copy as
 * the message.
 */
internal class RemoteFriendCommandException(
    val code: String,
    override val message: String,
) : IllegalStateException(message)
