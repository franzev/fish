package space.fishhub.android.data.friends

import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.friends.remote.FriendsRemoteDataSource
import space.fishhub.android.data.friends.remote.RemoteFriendCommandException

class DefaultFriendsRepositoryTest {
    @Test
    fun aSentRequestKeepsTheServersRequestAndStatus() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = { FriendRequestOutcome(requestId = "request-1", status = "pending") },
            ),
        )

        val outcome = repository.sendRequest("client-2", "request-key-1").requireSuccess()

        assertEquals(
            SendFriendRequestOutcome.Requested(FriendRequestOutcome("request-1", "pending")),
            outcome,
        )
    }

    @Test
    fun aReplayedRequestThatWasAlreadyAcceptedReadsAsAccepted() = runTest {
        // The same clientRequestId replays the original request, which may have
        // been accepted since; the status is the truth, not the call.
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = { FriendRequestOutcome(requestId = "request-1", status = "accepted") },
            ),
        )

        val outcome = repository.sendRequest("client-2", "request-key-1").requireSuccess()

        assertEquals("accepted", (outcome as SendFriendRequestOutcome.Requested).request.status)
    }

    @Test
    fun anAlreadyPendingConflictIsSuccessWithAPendingStatus() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = { throw commandFailure("request_pending", "Your request is already on its way.") },
            ),
        )

        val outcome = repository.sendRequest("client-2", "request-key-1").requireSuccess()

        assertEquals("pending", (outcome as SendFriendRequestOutcome.Requested).request.status)
        assertNull(outcome.request.requestId)
    }

    @Test
    fun anAlreadyFriendsConflictIsSuccessWithAnAcceptedStatus() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = { throw commandFailure("already_friends", "You’re already friends.") },
            ),
        )

        val outcome = repository.sendRequest("client-2", "request-key-1").requireSuccess()

        assertEquals("accepted", (outcome as SendFriendRequestOutcome.Requested).request.status)
    }

    @Test
    fun aCrossedRequestAsksTheCallerToLookTheCandidateUpAgain() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = {
                    throw commandFailure(
                        "incoming_request_exists",
                        "They already sent you a request. Review it when you’re ready.",
                    )
                },
            ),
        )

        val outcome = repository.sendRequest("client-2", "request-key-1").requireSuccess()

        assertEquals(SendFriendRequestOutcome.IncomingExists, outcome)
    }

    @Test
    fun anyOtherCommandFailureKeepsTheServersCalmCopy() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = {
                    throw commandFailure(
                        "rate_limited",
                        "Pause for a moment before sending more requests.",
                    )
                },
            ),
        )

        val failure = repository.sendRequest("client-2", "request-key-1") as FriendsResult.Failure

        assertEquals("Pause for a moment before sending more requests.", failure.message)
        assertTrue(failure.recoverable)
    }

    @Test
    fun aSignedOutCallerGetsAnUnrecoverableFailure() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                sendResult = { throw commandFailure("not_authenticated", "Sign in to manage friends.") },
            ),
        )

        val failure = repository.sendRequest("client-2", "request-key-1") as FriendsResult.Failure

        assertEquals("Sign in to manage friends.", failure.message)
        assertEquals(false, failure.recoverable)
    }

    @Test
    fun aDroppedConnectionIsRecoverableAndSaysNothingAboutTheSearch() = runTest {
        val repository = repository(
            FakeFriendsRemoteDataSource(
                searchResult = { throw IOException("api.example.test: connection reset") },
            ),
        )

        val failure = repository.searchCandidate("sam_lee") as FriendsResult.Failure

        assertEquals("Friends is taking a break. Chat still works.", failure.message)
        assertTrue(failure.recoverable)
    }

    @Test
    fun respondingPassesTheAnswerThroughAndReturnsTheResolvedRequest() = runTest {
        val remote = FakeFriendsRemoteDataSource(
            respondResult = { FriendRequestOutcome(requestId = "request-1", status = "accepted") },
        )

        val outcome = repository(remote)
            .respondRequest("request-1", FriendRequestResponse.Accept)
            .requireSuccess()

        assertEquals(FriendRequestOutcome("request-1", "accepted"), outcome)
        assertEquals("request-1" to FriendRequestResponse.Accept, remote.responded)
    }

    @Test
    fun readsPassThroughUntouched() = runTest {
        val request = IncomingFriendRequest(
            requestId = "request-1",
            sender = FriendProfile("client-2", "Sam Lee", "sam_lee"),
            createdAt = "2026-07-29T00:00:00Z",
        )
        val repository = repository(
            FakeFriendsRemoteDataSource(
                searchResult = {
                    FriendCandidate(
                        status = FriendCandidateStatus.None,
                        profile = FriendProfile("client-2", "Sam Lee", "sam_lee"),
                    )
                },
                requests = listOf(request),
                count = 1,
            ),
        )

        assertEquals(
            FriendCandidateStatus.None,
            repository.searchCandidate("sam_lee").requireSuccess().status,
        )
        assertEquals(listOf(request), repository.listIncomingRequests().requireSuccess())
        assertEquals(1, repository.countIncomingRequests().requireSuccess())
    }

    private fun repository(remote: FriendsRemoteDataSource): FriendsRepository =
        DefaultFriendsRepository(remote)

    private fun commandFailure(code: String, message: String) =
        RemoteFriendCommandException(code, message)

    private fun <T> FriendsResult<T>.requireSuccess(): T =
        (this as FriendsResult.Success<T>).value
}

private class FakeFriendsRemoteDataSource(
    private val searchResult: () -> FriendCandidate = { FriendCandidate(FriendCandidateStatus.Unavailable) },
    private val requests: List<IncomingFriendRequest> = emptyList(),
    private val count: Int = 0,
    private val sendResult: () -> FriendRequestOutcome = {
        FriendRequestOutcome(requestId = "request-1", status = "pending")
    },
    private val respondResult: () -> FriendRequestOutcome = {
        FriendRequestOutcome(requestId = "request-1", status = "accepted")
    },
) : FriendsRemoteDataSource {
    var responded: Pair<String, FriendRequestResponse>? = null
        private set

    override suspend fun searchCandidate(username: String): FriendCandidate = searchResult()

    override suspend fun listIncomingRequests(): List<IncomingFriendRequest> = requests

    override suspend fun countIncomingRequests(): Int = count

    override suspend fun sendRequest(
        targetId: String,
        clientRequestId: String,
    ): FriendRequestOutcome = sendResult()

    override suspend fun respondRequest(
        requestId: String,
        response: FriendRequestResponse,
    ): FriendRequestOutcome {
        responded = requestId to response
        return respondResult()
    }

    override fun events(userId: String): Flow<FriendEvent> = emptyFlow()
}
