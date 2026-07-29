package space.fishhub.android.feature.friends.views

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import space.fishhub.android.data.friends.FriendCandidate
import space.fishhub.android.data.friends.FriendCandidateStatus
import space.fishhub.android.data.friends.FriendProfile
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.IncomingFriendRequest
import space.fishhub.android.feature.friends.R
import space.fishhub.android.feature.friends.model.AddFriendUiState
import space.fishhub.android.feature.friends.model.FriendRequestsUiState

/**
 * Every friends state a person can land on, rendered from plain values so the
 * screenshot and accessibility suites never need a repository.
 */
@Composable
internal fun FriendsPreviewContent(page: String = "input") {
    when (page) {
        "requests",
        "requests-loading",
        "requests-empty",
        "requests-failed",
        "review",
        "review-declining",
        -> RequestsPreview(page)
        else -> AddFriendPreview(page)
    }
}

@Composable
private fun AddFriendPreview(page: String) {
    val profile = FriendProfile(id = "sam", displayName = "Sam Lee", username = "sam_lee")
    val state = when (page) {
        "candidate" -> AddFriendUiState.Candidate(
            candidate = FriendCandidate(FriendCandidateStatus.None, profile),
            clientRequestId = PreviewClientRequestId,
        )
        "sent" -> AddFriendUiState.Candidate(
            candidate = FriendCandidate(FriendCandidateStatus.None, profile),
            clientRequestId = PreviewClientRequestId,
            sent = true,
        )
        "friends" -> AddFriendUiState.Candidate(
            candidate = FriendCandidate(FriendCandidateStatus.Friends, profile),
            clientRequestId = PreviewClientRequestId,
        )
        "incoming" -> AddFriendUiState.Candidate(
            candidate = FriendCandidate(
                status = FriendCandidateStatus.IncomingPending,
                profile = profile,
                requestId = "request-1",
            ),
            clientRequestId = PreviewClientRequestId,
        )
        "unavailable" -> AddFriendUiState.Candidate(
            candidate = FriendCandidate(FriendCandidateStatus.Unavailable),
            clientRequestId = PreviewClientRequestId,
        )
        else -> AddFriendUiState.Input()
    }
    AddFriendScreen(
        state = state,
        avatarUrls = emptyMap(),
        onSearch = {},
        onSend = {},
        onReviewRequest = {},
        onSearchAgain = {},
        onClose = {},
    )
}

@Composable
private fun RequestsPreview(page: String) {
    val requests = listOf(
        IncomingFriendRequest(
            requestId = "request-1",
            sender = FriendProfile(id = "sam", displayName = "Sam Lee", username = "sam_lee"),
            createdAt = "2026-07-29T09:00:00Z",
        ),
        IncomingFriendRequest(
            requestId = "request-2",
            sender = FriendProfile(id = "noor", displayName = "Noor Haddad", username = "noor_h"),
            createdAt = "2026-07-28T18:30:00Z",
        ),
    )
    val state = when (page) {
        "requests-loading" -> FriendRequestsUiState.Loading
        "requests-empty" -> FriendRequestsUiState.Loaded(emptyList())
        "requests-failed" -> FriendRequestsUiState.Failed(
            stringResource(R.string.friend_requests_load_failed),
        )
        "review-declining" -> FriendRequestsUiState.Loaded(
            requests = requests,
            respondingWith = mapOf(requests.first().requestId to FriendRequestResponse.Decline),
        )
        else -> FriendRequestsUiState.Loaded(requests)
    }
    FriendRequestsScreen(
        state = state,
        selectedRequest = requests.first().takeIf { page.startsWith("review") },
        avatarUrls = emptyMap(),
        onSelectRequest = {},
        onClearSelection = {},
        onAccept = {},
        onDecline = {},
        onRetry = {},
        onClose = {},
    )
}

private const val PreviewClientRequestId = "00000000-0000-4000-8000-000000000000"
