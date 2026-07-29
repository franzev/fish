package space.fishhub.android.feature.friends

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import space.fishhub.android.data.friends.FriendCandidateStatus
import space.fishhub.android.data.friends.FriendEvent
import space.fishhub.android.data.friends.FriendEventReason
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.FriendsRepository
import space.fishhub.android.data.friends.FriendsResult
import space.fishhub.android.data.friends.IncomingFriendRequest
import space.fishhub.android.data.friends.SendFriendRequestOutcome
import space.fishhub.android.feature.friends.logic.FriendsNotices
import space.fishhub.android.feature.friends.model.AddFriendUiState
import space.fishhub.android.feature.friends.model.FriendRequestsUiState

/**
 * Owns both friends surfaces and the one subscription behind them.
 *
 * Nothing here logs a username, a request id, or a profile id: who someone
 * looked for is theirs alone.
 */
class FriendsViewModel(
    private val repository: FriendsRepository,
    private val notices: FriendsNotices,
    private val friendsEnabled: Boolean,
    private val resolveAvatarUrls: suspend (List<String>) -> Map<String, String> = { emptyMap() },
) : ViewModel() {
    private data class Session(val userId: String, val isClient: Boolean)

    private var session: Session? = null
    private var eventsJob: Job? = null

    /** The request the add-friend pivot asked for, before the list has arrived. */
    private var pendingSelectionId: String? = null

    private val mutableEntryPointsVisible = MutableStateFlow(false)
    val entryPointsVisible: StateFlow<Boolean> = mutableEntryPointsVisible.asStateFlow()

    private val mutableIncomingRequestCount = MutableStateFlow(0)
    val incomingRequestCount: StateFlow<Int> = mutableIncomingRequestCount.asStateFlow()

    private val invalidations = MutableSharedFlow<Unit>(extraBufferCapacity = 8)

    /**
     * A friendship now exists, so whoever owns the conversation directory has
     * a new conversation to fetch. Friends never reaches into chat itself.
     */
    val directoryInvalidations: SharedFlow<Unit> = invalidations.asSharedFlow()

    private val mutableAddFriendVisible = MutableStateFlow(false)
    val addFriendVisible: StateFlow<Boolean> = mutableAddFriendVisible.asStateFlow()

    private val mutableRequestsVisible = MutableStateFlow(false)
    val requestsVisible: StateFlow<Boolean> = mutableRequestsVisible.asStateFlow()

    private val mutableAddFriendState = MutableStateFlow<AddFriendUiState>(AddFriendUiState.Input())
    val addFriendState: StateFlow<AddFriendUiState> = mutableAddFriendState.asStateFlow()

    private val mutableRequestsState =
        MutableStateFlow<FriendRequestsUiState>(FriendRequestsUiState.Loading)
    val requestsState: StateFlow<FriendRequestsUiState> = mutableRequestsState.asStateFlow()

    private val mutableSelectedRequest = MutableStateFlow<IncomingFriendRequest?>(null)
    val selectedRequest: StateFlow<IncomingFriendRequest?> = mutableSelectedRequest.asStateFlow()

    private val mutableAvatarUrls = MutableStateFlow<Map<String, String>>(emptyMap())
    val avatarUrls: StateFlow<Map<String, String>> = mutableAvatarUrls.asStateFlow()

    /**
     * Idempotent for the same person. A different signed-in user tears the old
     * subscription down before starting a new one; a coach account records the
     * session but subscribes to nothing, so a flag-off or coach build never
     * opens the channel.
     */
    fun start(userId: String, isClient: Boolean) {
        val next = Session(userId, isClient)
        if (session == next) return
        stop()
        session = next
        mutableEntryPointsVisible.value = friendsEnabled && isClient
        if (!friendsEnabled || !isClient) return
        eventsJob = viewModelScope.launch {
            repository.events(userId)
                .catch { }
                .collect(::onFriendEvent)
        }
        refreshIncomingRequestCount()
    }

    fun stop() {
        eventsJob?.cancel()
        eventsJob = null
        session = null
        pendingSelectionId = null
        mutableEntryPointsVisible.value = false
        mutableIncomingRequestCount.value = 0
        mutableAddFriendVisible.value = false
        mutableRequestsVisible.value = false
        mutableAddFriendState.value = AddFriendUiState.Input()
        mutableRequestsState.value = FriendRequestsUiState.Loading
        mutableSelectedRequest.value = null
        mutableAvatarUrls.value = emptyMap()
    }

    fun openAddFriend() {
        mutableAddFriendState.value = AddFriendUiState.Input()
        mutableAddFriendVisible.value = true
    }

    fun closeAddFriend() {
        mutableAddFriendVisible.value = false
        mutableAddFriendState.value = AddFriendUiState.Input()
    }

    fun openRequests() {
        pendingSelectionId = null
        mutableSelectedRequest.value = null
        mutableRequestsVisible.value = true
        loadRequests()
    }

    fun closeRequests() {
        pendingSelectionId = null
        mutableRequestsVisible.value = false
        mutableSelectedRequest.value = null
        mutableRequestsState.value = FriendRequestsUiState.Loading
    }

    fun selectRequest(request: IncomingFriendRequest) {
        mutableSelectedRequest.value = request
    }

    fun clearSelectedRequest() {
        pendingSelectionId = null
        mutableSelectedRequest.value = null
    }

    /**
     * They asked first. Leave add-a-friend and open their request so accepting
     * is the next tap rather than a hunt through the list.
     */
    fun reviewIncomingRequest(requestId: String) {
        closeAddFriend()
        pendingSelectionId = requestId
        mutableSelectedRequest.value = null
        mutableRequestsVisible.value = true
        loadRequests()
    }

    fun search(username: String) {
        val trimmed = username.trim()
        if (trimmed.isEmpty()) {
            mutableAddFriendState.value =
                AddFriendUiState.Input(fieldNotice = notices.emptyUsername)
            return
        }
        val current = mutableAddFriendState.value
        if (current is AddFriendUiState.Input && current.searching) return
        mutableAddFriendState.value = AddFriendUiState.Input(searching = true)
        viewModelScope.launch {
            when (val result = repository.searchCandidate(trimmed)) {
                is FriendsResult.Success -> {
                    mutableAddFriendState.value = AddFriendUiState.Candidate(
                        candidate = result.value,
                        clientRequestId = UUID.randomUUID().toString(),
                    )
                    resolveAvatars(listOfNotNull(result.value.profile?.id))
                }
                is FriendsResult.Failure ->
                    mutableAddFriendState.value =
                        AddFriendUiState.Input(notice = notices.searchFailed)
            }
        }
    }

    fun searchAgain() {
        mutableAddFriendState.value = AddFriendUiState.Input()
    }

    fun sendRequest() {
        val current = mutableAddFriendState.value as? AddFriendUiState.Candidate ?: return
        val profile = current.candidate.profile ?: return
        if (current.sending || current.sent) return
        if (current.candidate.status != FriendCandidateStatus.None) return
        mutableAddFriendState.value = current.copy(sending = true, notice = null)
        viewModelScope.launch {
            val result = repository.sendRequest(profile.id, current.clientRequestId)
            // A new search while this was in flight owns the screen now.
            val settled = (mutableAddFriendState.value as? AddFriendUiState.Candidate)
                ?.takeIf { it.clientRequestId == current.clientRequestId } ?: return@launch
            when (result) {
                is FriendsResult.Success -> when (val outcome = result.value) {
                    is SendFriendRequestOutcome.Requested ->
                        mutableAddFriendState.value = settled.settle(outcome)
                    SendFriendRequestOutcome.IncomingExists ->
                        pivotToIncomingRequest(profile.username, settled)
                }
                is FriendsResult.Failure ->
                    mutableAddFriendState.value =
                        settled.copy(sending = false, notice = result.message)
            }
        }
    }

    /**
     * The server owns the outcome, even for a replay: an immediately accepted
     * request means the two were already friends.
     */
    private fun AddFriendUiState.Candidate.settle(
        outcome: SendFriendRequestOutcome.Requested,
    ): AddFriendUiState.Candidate = when (outcome.request.status) {
        StatusPending -> copy(sending = false, sent = true, notice = null)
        StatusAccepted -> copy(
            candidate = candidate.copy(status = FriendCandidateStatus.Friends),
            sending = false,
            notice = null,
        )
        else -> copy(
            candidate = candidate.copy(status = FriendCandidateStatus.Unavailable),
            sending = false,
            notice = null,
        )
    }

    /**
     * They sent their own request between the search and the tap; a fresh
     * lookup recovers the request id so review is one step away.
     */
    private suspend fun pivotToIncomingRequest(
        username: String,
        settled: AddFriendUiState.Candidate,
    ) {
        val lookup = repository.searchCandidate(username)
        val found = (lookup as? FriendsResult.Success)?.value
        if (found != null && found.status == FriendCandidateStatus.IncomingPending) {
            mutableAddFriendState.value =
                settled.copy(candidate = found, sending = false, notice = null)
            resolveAvatars(listOfNotNull(found.profile?.id))
            return
        }
        mutableAddFriendState.value =
            settled.copy(sending = false, notice = notices.incomingRequestExists)
    }

    fun loadRequests() {
        mutableRequestsState.value = FriendRequestsUiState.Loading
        viewModelScope.launch {
            when (val result = repository.listIncomingRequests()) {
                is FriendsResult.Success -> {
                    mutableRequestsState.value = FriendRequestsUiState.Loaded(result.value)
                    pendingSelectionId?.let { requestId ->
                        pendingSelectionId = null
                        mutableSelectedRequest.value =
                            result.value.firstOrNull { it.requestId == requestId }
                    }
                    resolveAvatars(result.value.map { it.sender.id })
                }
                is FriendsResult.Failure ->
                    mutableRequestsState.value =
                        FriendRequestsUiState.Failed(notices.requestsLoadFailed)
            }
        }
    }

    fun respond(requestId: String, response: FriendRequestResponse) {
        val current = mutableRequestsState.value as? FriendRequestsUiState.Loaded ?: return
        if (requestId in current.busyRequestIds) return
        mutableRequestsState.value = current.copy(
            busyRequestIds = current.busyRequestIds + requestId,
            notice = null,
        )
        viewModelScope.launch {
            val result = repository.respondRequest(requestId, response)
            val settled = mutableRequestsState.value as? FriendRequestsUiState.Loaded
                ?: return@launch
            val freed = settled.busyRequestIds - requestId
            when (result) {
                is FriendsResult.Success -> {
                    val remaining = settled.requests.filterNot { it.requestId == requestId }
                    mutableRequestsState.value =
                        settled.copy(requests = remaining, busyRequestIds = freed)
                    if (mutableSelectedRequest.value?.requestId == requestId) {
                        mutableSelectedRequest.value = null
                    }
                    if (response == FriendRequestResponse.Accept) invalidations.tryEmit(Unit)
                    // Handling the last one is the whole errand: go back to chat.
                    if (remaining.isEmpty()) closeRequests()
                    refreshIncomingRequestCount()
                }
                is FriendsResult.Failure -> mutableRequestsState.value =
                    settled.copy(busyRequestIds = freed, notice = result.message)
            }
        }
    }

    /**
     * A broadcast is a wake-up hint and nothing more, so every event ends in a
     * refetch rather than a local edit.
     */
    private fun onFriendEvent(event: FriendEvent) {
        refreshIncomingRequestCount()
        when (event.reason) {
            FriendEventReason.FriendshipCreated,
            FriendEventReason.RequestAccepted,
            -> invalidations.tryEmit(Unit)
            else -> Unit
        }
    }

    private fun refreshIncomingRequestCount() {
        val active = session ?: return
        if (!friendsEnabled || !active.isClient) return
        viewModelScope.launch {
            val result = repository.countIncomingRequests()
            if (result is FriendsResult.Success) mutableIncomingRequestCount.value = result.value
        }
    }

    /** An avatar that will not resolve is not a failure; initials say the name. */
    private suspend fun resolveAvatars(profileIds: List<String>) {
        val wanted = profileIds.filterNot(mutableAvatarUrls.value::containsKey)
        if (wanted.isEmpty()) return
        val resolved = try {
            resolveAvatarUrls(wanted)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Throwable) {
            return
        }
        if (resolved.isNotEmpty()) mutableAvatarUrls.value += resolved
    }

    private companion object {
        // The server's own request statuses, mirrored the way the web mirrors
        // them; data/friends keeps its wire constants to itself.
        const val StatusPending = "pending"
        const val StatusAccepted = "accepted"
    }
}
