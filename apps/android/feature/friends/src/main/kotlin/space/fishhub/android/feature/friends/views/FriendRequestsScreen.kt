package space.fishhub.android.feature.friends.views

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.data.friends.FriendRequestResponse
import space.fishhub.android.data.friends.IncomingFriendRequest
import space.fishhub.android.feature.friends.R
import space.fishhub.android.feature.friends.model.FriendRequestsUiState

/**
 * The list and one request's review are the same screen: back walks review →
 * list → out, so there is never more than one decision on the page.
 */
@Composable
fun FriendRequestsScreen(
    state: FriendRequestsUiState,
    selectedRequest: IncomingFriendRequest?,
    avatarUrls: Map<String, String>,
    onSelectRequest: (IncomingFriendRequest) -> Unit,
    onClearSelection: () -> Unit,
    onAccept: (String) -> Unit,
    onDecline: (String) -> Unit,
    onRetry: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val goBack = { if (selectedRequest != null) onClearSelection() else onClose() }
    BackHandler(onBack = goBack)
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        FishTopBar(
            title = stringResource(R.string.friend_requests_title),
            showBack = true,
            onBack = goBack,
        )
        if (selectedRequest != null) {
            RequestReview(
                request = selectedRequest,
                respondingWith = (state as? FriendRequestsUiState.Loaded)
                    ?.respondingWith
                    ?.get(selectedRequest.requestId),
                notice = (state as? FriendRequestsUiState.Loaded)?.notice,
                avatarUrl = avatarUrls[selectedRequest.sender.id],
                onAccept = { onAccept(selectedRequest.requestId) },
                onDecline = { onDecline(selectedRequest.requestId) },
            )
        } else {
            RequestList(
                state = state,
                avatarUrls = avatarUrls,
                onSelectRequest = onSelectRequest,
                onRetry = onRetry,
            )
        }
    }
}

@Composable
private fun RequestList(
    state: FriendRequestsUiState,
    avatarUrls: Map<String, String>,
    onSelectRequest: (IncomingFriendRequest) -> Unit,
    onRetry: () -> Unit,
) {
    val contentModifier = Modifier
        .fillMaxSize()
        .padding(horizontal = FishTheme.spacing.page)
        .padding(top = FishTheme.spacing.md)
    when (state) {
        FriendRequestsUiState.Loading -> Column(
            modifier = contentModifier.semantics { liveRegion = LiveRegionMode.Polite },
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            Text(
                text = stringResource(R.string.friend_requests_loading),
                color = FishTheme.colors.body,
                style = FishTheme.typography.caption,
            )
            // Shaped like the rows that are coming, so nothing jumps when they
            // arrive.
            Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
                repeat(3) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
                            .background(
                                color = FishTheme.colors.surfaceAlt,
                                shape = RoundedCornerShape(FishTheme.radii.control),
                            )
                            .padding(
                                horizontal = FishTheme.spacing.md,
                                vertical = FishTheme.spacing.sm,
                            ),
                        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
                    ) {
                        FishSkeleton(Modifier.fillMaxWidth(0.44f))
                        FishSkeleton(Modifier.fillMaxWidth(0.28f))
                    }
                }
            }
        }
        is FriendRequestsUiState.Failed -> Column(
            modifier = contentModifier,
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            FishNotice(
                title = state.notice,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
            FishButton(
                label = stringResource(R.string.friend_requests_try_again),
                onClick = onRetry,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        is FriendRequestsUiState.Loaded -> if (state.requests.isEmpty()) {
            Text(
                text = stringResource(R.string.friend_requests_empty),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
                modifier = contentModifier,
            )
        } else {
            LazyColumn(
                modifier = contentModifier,
                verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs),
            ) {
                state.notice?.let { notice ->
                    item(key = "requests-notice") {
                        FishNotice(
                            title = notice,
                            modifier = Modifier
                                .padding(bottom = FishTheme.spacing.xs)
                                .semantics { liveRegion = LiveRegionMode.Polite },
                        )
                    }
                }
                items(items = state.requests, key = IncomingFriendRequest::requestId) { request ->
                    RequestRow(
                        request = request,
                        avatarUrl = avatarUrls[request.sender.id],
                        onClick = { onSelectRequest(request) },
                    )
                }
            }
        }
    }
}

@Composable
private fun RequestRow(
    request: IncomingFriendRequest,
    avatarUrl: String?,
    onClick: () -> Unit,
) {
    val label = "${request.sender.displayName}, @${request.sender.username}"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = FishTheme.sizes.touchTarget)
            .background(
                color = FishTheme.colors.surfaceAlt,
                shape = RoundedCornerShape(FishTheme.radii.control),
            )
            .clickable(role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = label
                role = Role.Button
            }
            .padding(horizontal = FishTheme.spacing.md, vertical = FishTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FriendIdentity(
            displayName = request.sender.displayName,
            username = request.sender.username,
            avatarUrl = avatarUrl,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = FishIcons.ChevronRight,
            contentDescription = null,
            tint = FishTheme.colors.muted,
            modifier = Modifier
                .padding(start = FishTheme.spacing.sm)
                .size(FishTheme.sizes.iconGlyph),
        )
    }
}

@Composable
private fun RequestReview(
    request: IncomingFriendRequest,
    respondingWith: FriendRequestResponse?,
    notice: String?,
    avatarUrl: String?,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = FishTheme.spacing.page)
            .padding(top = FishTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
    ) {
        notice?.let {
            FishNotice(
                title = it,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = FishTheme.colors.surfaceAlt,
                    shape = RoundedCornerShape(FishTheme.radii.card),
                )
                .padding(FishTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            FriendIdentity(
                displayName = request.sender.displayName,
                username = request.sender.username,
                avatarUrl = avatarUrl,
            )
            Text(
                text = stringResource(R.string.friend_request_review_body),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
            // The spinner belongs on the button they tapped: watching Accept
            // spin after choosing Decline is the app telling them the wrong
            // thing about their own choice.
            FishButton(
                label = stringResource(R.string.friend_request_accept),
                onClick = onAccept,
                enabled = respondingWith == null,
                loading = respondingWith == FriendRequestResponse.Accept,
                loadingDescription = stringResource(R.string.friend_request_accepting),
                modifier = Modifier.fillMaxWidth(),
            )
            FishButton(
                label = stringResource(R.string.friend_request_decline),
                onClick = onDecline,
                variant = FishButtonVariant.Ghost,
                enabled = respondingWith == null,
                loading = respondingWith == FriendRequestResponse.Decline,
                loadingDescription = stringResource(R.string.friend_request_declining),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
