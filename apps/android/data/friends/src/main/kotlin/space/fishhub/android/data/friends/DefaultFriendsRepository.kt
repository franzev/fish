package space.fishhub.android.data.friends

import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.exceptions.UnauthorizedRestException
import io.ktor.client.plugins.HttpRequestTimeoutException
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import space.fishhub.android.data.friends.remote.DefaultFriendsError
import space.fishhub.android.data.friends.remote.FriendCommandCode
import space.fishhub.android.data.friends.remote.FriendRequestStatus
import space.fishhub.android.data.friends.remote.FriendsRemoteDataSource
import space.fishhub.android.data.friends.remote.RemoteFriendCommandException

internal class DefaultFriendsRepository(
    private val remote: FriendsRemoteDataSource,
    private val eventRetryDelayMs: Long = DefaultEventRetryDelayMs,
) : FriendsRepository {
    override suspend fun searchCandidate(username: String): FriendsResult<FriendCandidate> =
        resultOf { remote.searchCandidate(username) }

    override suspend fun listIncomingRequests(): FriendsResult<List<IncomingFriendRequest>> =
        resultOf { remote.listIncomingRequests() }

    override suspend fun countIncomingRequests(): FriendsResult<Int> =
        resultOf { remote.countIncomingRequests() }

    /**
     * Two of the server's conflicts are really the answer the person wanted:
     * the request is already on its way, or they are already friends. The
     * third means the other person asked first, which is a re-search, not a
     * failure.
     */
    override suspend fun sendRequest(
        targetId: String,
        clientRequestId: String,
    ): FriendsResult<SendFriendRequestOutcome> = resultOf {
        try {
            SendFriendRequestOutcome.Requested(remote.sendRequest(targetId, clientRequestId))
        } catch (failure: RemoteFriendCommandException) {
            when (failure.code) {
                FriendCommandCode.RequestPending -> SendFriendRequestOutcome.Requested(
                    FriendRequestOutcome(requestId = null, status = FriendRequestStatus.Pending),
                )
                FriendCommandCode.AlreadyFriends -> SendFriendRequestOutcome.Requested(
                    FriendRequestOutcome(requestId = null, status = FriendRequestStatus.Accepted),
                )
                FriendCommandCode.IncomingRequestExists -> SendFriendRequestOutcome.IncomingExists
                else -> throw failure
            }
        }
    }

    override suspend fun respondRequest(
        requestId: String,
        response: FriendRequestResponse,
    ): FriendsResult<FriendRequestOutcome> = resultOf { remote.respondRequest(requestId, response) }

    /**
     * Keeps subscribing for as long as anyone is listening. A channel that
     * failed to open, dropped, or simply ended is the one failure this feature
     * cannot afford to sit on: it is the only thing that tells a sender their
     * new conversation exists. Mirrors the chat realtime loop
     * ([DefaultChatRepository.observeConnectedRealtime]).
     */
    override fun events(userId: String): Flow<FriendEvent> = flow {
        while (true) {
            currentCoroutineContext().ensureActive()
            try {
                remote.events(userId).collect(::emit)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                // Nothing to report and nothing to log: who someone is friends
                // with never reaches diagnostics. Coming back is the answer.
            }
            delay(eventRetryDelayMs)
        }
    }

    /**
     * Nothing here records what was searched for or who was asked: usernames,
     * request ids, and profile ids stay out of diagnostics entirely.
     */
    private suspend fun <T> resultOf(block: suspend () -> T): FriendsResult<T> = try {
        FriendsResult.Success(block())
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (error: Throwable) {
        FriendsResult.Failure(
            message = (error as? RemoteFriendCommandException)?.message ?: DefaultFriendsError,
            recoverable = error.category() != FailureCategory.Authentication,
        )
    }
}

private const val DefaultEventRetryDelayMs = 2_000L

private enum class FailureCategory { Authentication, Network, Remote, Local }

private fun Throwable.category(): FailureCategory = when {
    this is RemoteFriendCommandException && code == FriendCommandCode.NotAuthenticated ->
        FailureCategory.Authentication
    this is UnauthorizedRestException -> FailureCategory.Authentication
    this is HttpRequestException ||
        this is HttpRequestTimeoutException ||
        this is IOException -> FailureCategory.Network
    this is RestException || this is RemoteFriendCommandException -> FailureCategory.Remote
    else -> FailureCategory.Local
}
