package space.fishhub.android.feature.friends.views

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishStateTextField
import space.fishhub.android.core.designsystem.component.FishTopBar
import space.fishhub.android.data.friends.FriendCandidateStatus
import space.fishhub.android.feature.friends.R
import space.fishhub.android.feature.friends.model.AddFriendUiState

/**
 * One username in, at most one person out. Never a list of people, and never a
 * reason why someone is out of reach.
 */
@Composable
fun AddFriendScreen(
    state: AddFriendUiState,
    avatarUrls: Map<String, String>,
    onSearch: (String) -> Unit,
    onSend: () -> Unit,
    onReviewRequest: (String?) -> Unit,
    onSearchAgain: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onClose)
    // Held above the candidate card so "Search again" comes back to the
    // username they typed, ready to correct rather than retype.
    val fieldState = rememberTextFieldState()
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        FishTopBar(
            title = stringResource(R.string.add_friend_title),
            showBack = true,
            onBack = onClose,
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = FishTheme.spacing.page)
                .padding(top = FishTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
        ) {
            when (state) {
                is AddFriendUiState.Input -> UsernameSearch(state, fieldState, onSearch)
                is AddFriendUiState.Candidate -> CandidateCard(
                    state = state,
                    avatarUrls = avatarUrls,
                    onSend = onSend,
                    onReviewRequest = onReviewRequest,
                    onSearchAgain = onSearchAgain,
                )
            }
        }
    }
}

@Composable
private fun UsernameSearch(
    state: AddFriendUiState.Input,
    fieldState: TextFieldState,
    onSearch: (String) -> Unit,
) {
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current

    LaunchedEffect(focusRequester) {
        focusRequester.requestFocus()
        keyboardController?.show()
    }

    state.notice?.let { notice ->
        FishNotice(
            title = notice,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
        FishStateTextField(
            state = fieldState,
            label = stringResource(R.string.add_friend_username_label),
            placeholder = stringResource(R.string.add_friend_username_placeholder),
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                keyboardType = KeyboardType.Text,
                imeAction = ImeAction.Search,
            ),
            onKeyboardAction = KeyboardActionHandler {
                keyboardController?.hide()
                onSearch(fieldState.text.toString())
            },
            lineLimits = TextFieldLineLimits.SingleLine,
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester),
        )
        Text(
            text = stringResource(R.string.add_friend_username_hint),
            color = FishTheme.colors.muted,
            style = FishTheme.typography.caption,
        )
        state.fieldNotice?.let { fieldNotice ->
            Text(
                text = fieldNotice,
                color = FishTheme.colors.notice,
                style = FishTheme.typography.label,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
    FishButton(
        label = stringResource(R.string.add_friend_search),
        onClick = {
            keyboardController?.hide()
            onSearch(fieldState.text.toString())
        },
        loading = state.searching,
        loadingDescription = stringResource(R.string.add_friend_searching),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun CandidateCard(
    state: AddFriendUiState.Candidate,
    avatarUrls: Map<String, String>,
    onSend: () -> Unit,
    onReviewRequest: (String?) -> Unit,
    onSearchAgain: () -> Unit,
) {
    val profile = state.candidate.profile
    state.notice?.let { notice ->
        FishNotice(
            title = notice,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
    }
    // Every reason someone cannot be added reads the same. Nothing here tells
    // a sender whether they were blocked, declined, or never existed.
    if (profile == null || state.candidate.status == FriendCandidateStatus.Unavailable) {
        FishNotice(
            title = stringResource(R.string.add_friend_unavailable),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
    } else {
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
                displayName = profile.displayName,
                username = profile.username,
                avatarUrl = avatarUrls[profile.id],
            )
            val sent = state.sent || state.candidate.status == FriendCandidateStatus.OutgoingPending
            val body = when {
                sent -> stringResource(R.string.add_friend_sent)
                state.candidate.status == FriendCandidateStatus.Friends ->
                    stringResource(R.string.add_friend_already_friends)
                state.candidate.status == FriendCandidateStatus.IncomingPending ->
                    stringResource(R.string.add_friend_incoming)
                else -> null
            }
            body?.let {
                Text(
                    text = it,
                    color = FishTheme.colors.body,
                    style = FishTheme.typography.body,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            // At most one primary action on the card, and never beside Search.
            when {
                sent || state.candidate.status == FriendCandidateStatus.Friends -> Unit
                // Told a request is waiting and given no way to it, someone is
                // stuck. Without an id the list still gets them there.
                state.candidate.status == FriendCandidateStatus.IncomingPending -> FishButton(
                    label = stringResource(R.string.add_friend_review_request),
                    onClick = { onReviewRequest(state.candidate.requestId) },
                    modifier = Modifier.fillMaxWidth(),
                )
                else -> FishButton(
                    label = stringResource(R.string.add_friend_send),
                    onClick = onSend,
                    loading = state.sending,
                    loadingDescription = stringResource(R.string.add_friend_sending),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
    FishButton(
        label = stringResource(R.string.add_friend_search_again),
        onClick = onSearchAgain,
        variant = FishButtonVariant.Ghost,
        modifier = Modifier.fillMaxWidth(),
    )
}
