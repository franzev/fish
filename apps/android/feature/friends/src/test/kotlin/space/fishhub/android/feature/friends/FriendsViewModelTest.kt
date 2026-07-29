package space.fishhub.android.feature.friends

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import space.fishhub.android.data.friends.FriendCandidate
import space.fishhub.android.data.friends.FriendCandidateStatus
import space.fishhub.android.data.friends.FriendEvent
import space.fishhub.android.data.friends.FriendEventReason
import space.fishhub.android.data.friends.FriendProfile
import space.fishhub.android.data.friends.FriendRequestOutcome
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.FriendsRepository
import space.fishhub.android.data.friends.FriendsResult
import space.fishhub.android.data.friends.IncomingFriendRequest
import space.fishhub.android.data.friends.SendFriendRequestOutcome
import space.fishhub.android.feature.friends.logic.FriendsNotices
import space.fishhub.android.feature.friends.model.AddFriendUiState
import space.fishhub.android.feature.friends.model.FriendRequestsUiState

@OptIn(ExperimentalCoroutinesApi::class)
class FriendsViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `a blank username never reaches the server`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeFriendsRepository()
        val viewModel = startedViewModel(repository)

        viewModel.search("   ")

        assertEquals(emptyList<String>(), repository.searches)
        val state = viewModel.addFriendState.value as AddFriendUiState.Input
        assertEquals(TestNotices.emptyUsername, state.fieldNotice)
        assertNull(state.notice)
    }

    @Test
    fun `a lookup that never lands keeps the field and explains itself`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.candidate = FriendsResult.Failure("unused", recoverable = true)
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")

            val state = viewModel.addFriendState.value as AddFriendUiState.Input
            assertEquals(TestNotices.searchFailed, state.notice)
            assertFalse(state.searching)
        }

    @Test
    fun `an already pending request reads as sent`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeFriendsRepository()
        repository.sendOutcome = requested(status = "pending")
        val viewModel = startedViewModel(repository)

        viewModel.search("sam_lee")
        viewModel.sendRequest()

        val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
        assertTrue(state.sent)
        assertNull(state.notice)
        assertEquals(FriendCandidateStatus.None, state.candidate.status)
    }

    @Test
    fun `a request the server answers as accepted reads as already friends`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.sendOutcome = requested(status = "accepted")
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            viewModel.sendRequest()

            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals(FriendCandidateStatus.Friends, state.candidate.status)
            assertFalse(state.sent)
        }

    @Test
    fun `a replayed request that came back accepted reads as already friends`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.sendOutcome = requested(requestId = "request-1", status = "accepted")
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            viewModel.sendRequest()

            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals(FriendCandidateStatus.Friends, state.candidate.status)
        }

    @Test
    fun `a crossed request pivots to the review they can act on`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.sendOutcome =
                FriendsResult.Success(SendFriendRequestOutcome.IncomingExists)
            repository.scriptedCandidates += FriendsResult.Success(
                FriendCandidate(FriendCandidateStatus.None, Sam),
            )
            repository.scriptedCandidates += FriendsResult.Success(
                FriendCandidate(
                    status = FriendCandidateStatus.IncomingPending,
                    profile = Sam,
                    requestId = "request-1",
                ),
            )
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            viewModel.sendRequest()

            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals(FriendCandidateStatus.IncomingPending, state.candidate.status)
            assertEquals("request-1", state.candidate.requestId)
            assertEquals(listOf("sam_lee", "sam_lee"), repository.searches)
        }

    @Test
    fun `a crossed request whose lookup fails still says who asked first`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.sendOutcome =
                FriendsResult.Success(SendFriendRequestOutcome.IncomingExists)
            repository.scriptedCandidates += FriendsResult.Success(
                FriendCandidate(FriendCandidateStatus.None, Sam),
            )
            repository.scriptedCandidates += FriendsResult.Failure("unused", recoverable = true)
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            viewModel.sendRequest()

            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals(TestNotices.incomingRequestExists, state.notice)
        }

    @Test
    fun `a failed send shows the server's own words and stays retryable`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.sendOutcome =
                FriendsResult.Failure("Pause for a moment before sending more requests.", true)
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            viewModel.sendRequest()

            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals("Pause for a moment before sending more requests.", state.notice)
            assertFalse(state.sending)
        }

    @Test
    fun `retrying one person reuses their request id and a new search mints another`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.sendOutcome = FriendsResult.Failure("Try again soon.", recoverable = true)
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            val firstId =
                (viewModel.addFriendState.value as AddFriendUiState.Candidate).clientRequestId
            viewModel.sendRequest()
            viewModel.sendRequest()
            viewModel.search("sam_lee")
            val secondId =
                (viewModel.addFriendState.value as AddFriendUiState.Candidate).clientRequestId

            assertEquals(listOf(firstId, firstId), repository.sends.map { it.second })
            assertNotEquals(firstId, secondId)
        }

    @Test
    fun `an unavailable person carries no profile to render`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.candidate =
                FriendsResult.Success(FriendCandidate(FriendCandidateStatus.Unavailable))
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            viewModel.sendRequest()

            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals(FriendCandidateStatus.Unavailable, state.candidate.status)
            assertEquals(emptyList<Pair<String, String>>(), repository.sends)
        }

    @Test
    fun `requests load into a list and a failure explains itself`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam, RequestFromNoor))
            val viewModel = startedViewModel(repository)

            viewModel.openRequests()
            assertEquals(
                listOf(RequestFromSam, RequestFromNoor),
                (viewModel.requestsState.value as FriendRequestsUiState.Loaded).requests,
            )

            repository.requests = FriendsResult.Failure("unused", recoverable = true)
            viewModel.loadRequests()
            assertEquals(
                TestNotices.requestsLoadFailed,
                (viewModel.requestsState.value as FriendRequestsUiState.Failed).notice,
            )
        }

    @Test
    fun `answering a request removes its row and clears the review`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam, RequestFromNoor))
            val viewModel = startedViewModel(repository)

            viewModel.openRequests()
            viewModel.selectRequest(RequestFromSam)
            viewModel.respond(RequestFromSam.requestId, FriendRequestResponse.Accept)

            assertEquals(
                listOf(RequestFromNoor),
                (viewModel.requestsState.value as FriendRequestsUiState.Loaded).requests,
            )
            assertNull(viewModel.selectedRequest.value)
            assertTrue(viewModel.requestsVisible.value)
        }

    @Test
    fun `handling the last request returns to chat`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeFriendsRepository()
        repository.requests = FriendsResult.Success(listOf(RequestFromSam))
        val viewModel = startedViewModel(repository)

        viewModel.openRequests()
        viewModel.respond(RequestFromSam.requestId, FriendRequestResponse.Decline)

        assertFalse(viewModel.requestsVisible.value)
        assertNull(viewModel.selectedRequest.value)
    }

    @Test
    fun `a request already being answered is not answered twice`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam, RequestFromNoor))
            repository.holdRespond = true
            val viewModel = startedViewModel(repository)

            viewModel.openRequests()
            viewModel.respond(RequestFromSam.requestId, FriendRequestResponse.Accept)
            viewModel.respond(RequestFromSam.requestId, FriendRequestResponse.Accept)

            assertEquals(1, repository.responses.size)
            assertEquals(
                mapOf(RequestFromSam.requestId to FriendRequestResponse.Accept),
                (viewModel.requestsState.value as FriendRequestsUiState.Loaded).respondingWith,
            )
        }

    @Test
    fun `a refused answer keeps the row and shows the server's own words`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam))
            repository.respondOutcome =
                FriendsResult.Failure("This request was already handled.", recoverable = true)
            val viewModel = startedViewModel(repository)

            viewModel.openRequests()
            viewModel.respond(RequestFromSam.requestId, FriendRequestResponse.Accept)

            val state = viewModel.requestsState.value as FriendRequestsUiState.Loaded
            assertEquals(listOf(RequestFromSam), state.requests)
            assertEquals("This request was already handled.", state.notice)
            assertEquals(emptyMap<String, FriendRequestResponse>(), state.respondingWith)
        }

    @Test
    fun `accepting invalidates the conversation directory and declining does not`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam, RequestFromNoor))
            val viewModel = startedViewModel(repository)
            val invalidations = mutableListOf<Unit>()
            val collector = launch { viewModel.directoryInvalidations.collect(invalidations::add) }

            viewModel.openRequests()
            viewModel.respond(RequestFromNoor.requestId, FriendRequestResponse.Decline)
            assertEquals(0, invalidations.size)

            viewModel.respond(RequestFromSam.requestId, FriendRequestResponse.Accept)
            assertEquals(1, invalidations.size)

            collector.cancel()
        }

    @Test
    fun `the review pivot opens the request the sender pointed at`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam, RequestFromNoor))
            val viewModel = startedViewModel(repository)

            viewModel.openAddFriend()
            viewModel.reviewIncomingRequest(RequestFromNoor.requestId)

            assertFalse(viewModel.addFriendVisible.value)
            assertTrue(viewModel.requestsVisible.value)
            assertEquals(RequestFromNoor, viewModel.selectedRequest.value)
        }

    @Test
    fun `every friend event refetches the count and only the friendship ones refresh`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.count = FriendsResult.Success(2)
            val viewModel = viewModel(repository)
            val invalidations = mutableListOf<Unit>()
            val collector = launch { viewModel.directoryInvalidations.collect(invalidations::add) }

            viewModel.start(userId = "client-1", isClient = true)
            assertEquals(1, repository.countCalls)
            assertEquals(2, viewModel.incomingRequestCount.value)

            val quiet = listOf(
                FriendEventReason.RequestCreated,
                FriendEventReason.RequestDeclined,
                FriendEventReason.RequestCancelled,
                FriendEventReason.FriendshipRemoved,
                FriendEventReason.Unknown,
            )
            quiet.forEach { repository.emit(FriendEvent(it)) }
            assertEquals(1 + quiet.size, repository.countCalls)
            assertEquals(0, invalidations.size)

            val refreshing = listOf(
                FriendEventReason.RequestAccepted,
                FriendEventReason.FriendshipCreated,
                FriendEventReason.StreamResumed,
            )
            refreshing.forEach { repository.emit(FriendEvent(it)) }
            assertEquals(1 + quiet.size + refreshing.size, repository.countCalls)
            assertEquals(refreshing.size, invalidations.size)

            collector.cancel()
        }

    @Test
    fun `a stream that comes back refetches the count and the directory`() =
        runTest(mainDispatcherRule.dispatcher) {
            // Whatever happened while the channel was down was never delivered,
            // so both surfaces are due a refetch: an accept inside the outage
            // would otherwise leave a conversation nobody ever sees.
            val repository = FakeFriendsRepository()
            val viewModel = viewModel(repository)
            val invalidations = mutableListOf<Unit>()
            val collector = launch { viewModel.directoryInvalidations.collect(invalidations::add) }

            viewModel.start(userId = "client-1", isClient = true)
            repository.count = FriendsResult.Success(4)
            repository.emit(FriendEvent(FriendEventReason.StreamResumed))

            assertEquals(2, repository.countCalls)
            assertEquals(4, viewModel.incomingRequestCount.value)
            assertEquals(1, invalidations.size)

            collector.cancel()
        }

    @Test
    fun `starting twice for the same person subscribes once and a new person restarts`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            val viewModel = viewModel(repository)

            viewModel.start(userId = "client-1", isClient = true)
            viewModel.start(userId = "client-1", isClient = true)
            assertEquals(listOf("client-1"), repository.subscribedUserIds)
            assertEquals(1, repository.countCalls)
            assertEquals(1, repository.liveSubscriptions())

            viewModel.start(userId = "client-2", isClient = true)
            assertEquals(listOf("client-1", "client-2"), repository.subscribedUserIds)
            assertEquals(2, repository.countCalls)
            assertEquals(1, repository.liveSubscriptions())
        }

    @Test
    fun `signing out tears the subscription down and zeroes the count`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.count = FriendsResult.Success(3)
            val viewModel = viewModel(repository)

            viewModel.start(userId = "client-1", isClient = true)
            viewModel.openRequests()
            assertEquals(3, viewModel.incomingRequestCount.value)

            viewModel.stop()

            assertEquals(0, repository.liveSubscriptions())
            assertEquals(0, viewModel.incomingRequestCount.value)
            assertFalse(viewModel.entryPointsVisible.value)
            assertFalse(viewModel.requestsVisible.value)
        }

    @Test
    fun `a coach never opens the channel`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeFriendsRepository()
        val viewModel = viewModel(repository)

        viewModel.start(userId = "coach-1", isClient = false)

        assertFalse(viewModel.entryPointsVisible.value)
        assertEquals(emptyList<String>(), repository.subscribedUserIds)
        assertEquals(0, repository.countCalls)
    }

    @Test
    fun `a build with friends off opens nothing`() = runTest(mainDispatcherRule.dispatcher) {
        val repository = FakeFriendsRepository()
        val viewModel = viewModel(repository, friendsEnabled = false)

        viewModel.start(userId = "client-1", isClient = true)

        assertFalse(viewModel.entryPointsVisible.value)
        assertEquals(emptyList<String>(), repository.subscribedUserIds)
        assertEquals(0, repository.countCalls)
    }

    @Test
    fun `an avatar that will not resolve leaves the initials alone`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.requests = FriendsResult.Success(listOf(RequestFromSam))
            val viewModel = startedViewModel(repository) { error("avatar service is down") }

            viewModel.search("sam_lee")
            viewModel.openRequests()

            assertTrue(viewModel.addFriendState.value is AddFriendUiState.Candidate)
            assertTrue(viewModel.requestsState.value is FriendRequestsUiState.Loaded)
            assertEquals(emptyMap<String, String>(), viewModel.avatarUrls.value)
        }

    @Test
    fun `a resolved avatar is remembered for the person it belongs to`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            val viewModel = startedViewModel(repository) { ids ->
                ids.associateWith { "https://avatars.test/$it" }
            }

            viewModel.search("sam_lee")

            assertEquals(
                mapOf(Sam.id to "https://avatars.test/${Sam.id}"),
                viewModel.avatarUrls.value,
            )
        }

    @Test
    fun `a count still on its way when they sign out never lands`() =
        runTest(mainDispatcherRule.dispatcher) {
            // Worst case this shows one person's waiting requests to the next
            // person to sign in on the same phone.
            val repository = FakeFriendsRepository()
            repository.count = FriendsResult.Success(7)
            repository.countGate = CompletableDeferred()
            val viewModel = viewModel(repository)

            viewModel.start(userId = "client-1", isClient = true)
            viewModel.stop()
            repository.countGate?.complete(Unit)
            advanceUntilIdle()

            assertEquals(0, viewModel.incomingRequestCount.value)
        }

    @Test
    fun `a search still on its way when they sign out never lands`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.searchGate = CompletableDeferred()
            val viewModel = viewModel(repository)

            viewModel.start(userId = "client-1", isClient = true)
            viewModel.search("sam_lee")
            viewModel.stop()
            repository.searchGate?.complete(Unit)
            advanceUntilIdle()

            assertEquals(AddFriendUiState.Input(), viewModel.addFriendState.value)
        }

    @Test
    fun `a send that lands after a new search leaves the new person alone`() =
        runTest(mainDispatcherRule.dispatcher) {
            val repository = FakeFriendsRepository()
            repository.scriptedCandidates += FriendsResult.Success(
                FriendCandidate(FriendCandidateStatus.None, Sam),
            )
            repository.scriptedCandidates += FriendsResult.Success(
                FriendCandidate(FriendCandidateStatus.None, Noor),
            )
            repository.sendOutcome = requested(status = "pending")
            repository.sendGate = CompletableDeferred()
            val viewModel = startedViewModel(repository)

            viewModel.search("sam_lee")
            val first = viewModel.addFriendState.value as AddFriendUiState.Candidate
            viewModel.sendRequest()
            viewModel.search("noor_h")
            repository.sendGate?.complete(Unit)
            advanceUntilIdle()

            // Sam's answer must not mark Noor as asked.
            val state = viewModel.addFriendState.value as AddFriendUiState.Candidate
            assertEquals(Noor, state.candidate.profile)
            assertNotEquals(first.clientRequestId, state.clientRequestId)
            assertFalse(state.sent)
        }

    /** These screens only exist for a signed-in client, so most tests start there. */
    private fun startedViewModel(
        repository: FriendsRepository,
        resolveAvatarUrls: suspend (List<String>) -> Map<String, String> = { emptyMap() },
    ) = viewModel(repository, resolveAvatarUrls = resolveAvatarUrls)
        .also { it.start(userId = "client-1", isClient = true) }

    private fun viewModel(
        repository: FriendsRepository,
        friendsEnabled: Boolean = true,
        resolveAvatarUrls: suspend (List<String>) -> Map<String, String> = { emptyMap() },
    ) = FriendsViewModel(
        repository = repository,
        notices = TestNotices,
        friendsEnabled = friendsEnabled,
        resolveAvatarUrls = resolveAvatarUrls,
    )

    private fun requested(requestId: String? = null, status: String) =
        FriendsResult.Success<SendFriendRequestOutcome>(
            SendFriendRequestOutcome.Requested(FriendRequestOutcome(requestId, status)),
        )
}

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(
    val dispatcher: TestDispatcher = UnconfinedTestDispatcher(),
) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)
    override fun finished(description: Description) = Dispatchers.resetMain()
}

private val Sam = FriendProfile(id = "sam", displayName = "Sam Lee", username = "sam_lee")
private val Noor = FriendProfile(id = "noor", displayName = "Noor Haddad", username = "noor_h")

private val RequestFromSam = IncomingFriendRequest(
    requestId = "request-1",
    sender = Sam,
    createdAt = "2026-07-29T09:00:00Z",
)
private val RequestFromNoor = IncomingFriendRequest(
    requestId = "request-2",
    sender = Noor,
    createdAt = "2026-07-28T18:30:00Z",
)

private object TestNotices : FriendsNotices {
    override val emptyUsername = "Add a username to search."
    override val searchFailed = "The search didn’t go through. Give it a moment and try again."
    override val incomingRequestExists = "They already sent you a request."
    override val requestsLoadFailed = "Could not load friend requests."
}

private class FakeFriendsRepository : FriendsRepository {
    var candidate: FriendsResult<FriendCandidate> =
        FriendsResult.Success(FriendCandidate(FriendCandidateStatus.None, Sam))

    /** Consumed in order when a test needs one lookup to differ from the next. */
    val scriptedCandidates = ArrayDeque<FriendsResult<FriendCandidate>>()
    var requests: FriendsResult<List<IncomingFriendRequest>> = FriendsResult.Success(emptyList())
    var count: FriendsResult<Int> = FriendsResult.Success(0)
    var sendOutcome: FriendsResult<SendFriendRequestOutcome> = FriendsResult.Success(
        SendFriendRequestOutcome.Requested(FriendRequestOutcome("request-1", "pending")),
    )
    var respondOutcome: FriendsResult<FriendRequestOutcome> =
        FriendsResult.Success(FriendRequestOutcome("request-1", "accepted"))

    /** Leaves a response in flight so single-flight behavior is observable. */
    var holdRespond: Boolean = false

    /** Gates hold an answer until a test decides it comes back. */
    var countGate: CompletableDeferred<Unit>? = null
    var searchGate: CompletableDeferred<Unit>? = null
    var sendGate: CompletableDeferred<Unit>? = null

    val searches = mutableListOf<String>()
    val sends = mutableListOf<Pair<String, String>>()
    val responses = mutableListOf<Pair<String, FriendRequestResponse>>()
    val subscribedUserIds = mutableListOf<String>()
    var countCalls = 0

    private val broadcasts = MutableSharedFlow<FriendEvent>(extraBufferCapacity = 16)

    fun emit(event: FriendEvent) {
        check(broadcasts.tryEmit(event)) { "friend event was dropped" }
    }

    fun liveSubscriptions(): Int = broadcasts.subscriptionCount.value

    override suspend fun searchCandidate(username: String): FriendsResult<FriendCandidate> {
        searches += username
        val answer = if (scriptedCandidates.isEmpty()) candidate else scriptedCandidates.removeFirst()
        searchGate?.await()
        return answer
    }

    override suspend fun listIncomingRequests(): FriendsResult<List<IncomingFriendRequest>> =
        requests

    override suspend fun countIncomingRequests(): FriendsResult<Int> {
        countCalls += 1
        countGate?.await()
        return count
    }

    override suspend fun sendRequest(
        targetId: String,
        clientRequestId: String,
    ): FriendsResult<SendFriendRequestOutcome> {
        sends += targetId to clientRequestId
        sendGate?.await()
        return sendOutcome
    }

    override suspend fun respondRequest(
        requestId: String,
        response: FriendRequestResponse,
    ): FriendsResult<FriendRequestOutcome> {
        responses += requestId to response
        if (holdRespond) kotlinx.coroutines.awaitCancellation()
        return respondOutcome
    }

    override fun events(userId: String): Flow<FriendEvent> {
        subscribedUserIds += userId
        return broadcasts
    }
}
