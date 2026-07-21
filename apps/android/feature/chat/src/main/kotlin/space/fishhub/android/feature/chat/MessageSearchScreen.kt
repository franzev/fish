package space.fishhub.android.feature.chat

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.KeyboardActionHandler
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import space.fishhub.android.core.designsystem.FishIcons
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishButton
import space.fishhub.android.core.designsystem.component.FishButtonVariant
import space.fishhub.android.core.designsystem.component.FishDivider
import space.fishhub.android.core.designsystem.component.FishEmptyState
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.core.designsystem.component.FishSkeleton
import space.fishhub.android.core.designsystem.component.FishStateTextField
import space.fishhub.android.core.designsystem.component.FishTopBar
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun MessageSearchScreen(
    state: MessageSearchUiState,
    onQueryChanged: (String) -> Unit,
    onSubmitQuery: () -> Unit,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onResultSelected: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onClose)
    val fieldState = rememberTextFieldState(state.query)
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current

    LaunchedEffect(fieldState) {
        snapshotFlow { fieldState.text.toString() }
            .distinctUntilChanged()
            .collect(onQueryChanged)
    }
    LaunchedEffect(focusRequester) {
        focusRequester.requestFocus()
        keyboardController?.show()
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        FishTopBar(
            title = stringResource(R.string.search_messages),
            showBack = true,
            onBack = onClose,
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .padding(horizontal = FishTheme.spacing.page),
        ) {
            FishStateTextField(
                state = fieldState,
                label = stringResource(R.string.search_messages),
                placeholder = stringResource(R.string.search_messages_placeholder),
                leadingIcon = {
                    Icon(
                        imageVector = FishIcons.Search,
                        contentDescription = null,
                        tint = FishTheme.colors.body,
                    )
                },
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Search,
                ),
                onKeyboardAction = KeyboardActionHandler {
                    onSubmitQuery()
                    keyboardController?.hide()
                },
                lineLimits = TextFieldLineLimits.SingleLine,
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester)
                    .padding(top = FishTheme.spacing.sm),
            )
            MessageSearchContent(
                state = state,
                onRetry = onRetry,
                onLoadMore = onLoadMore,
                onResultSelected = onResultSelected,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
            )
        }
    }
}

@Composable
private fun MessageSearchContent(
    state: MessageSearchUiState,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onResultSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    when {
        state.loading && state.results.isEmpty() -> MessageSearchLoading(modifier)
        state.results.isEmpty() && state.notice != null -> MessageSearchFailure(
            notice = state.notice,
            onRetry = onRetry,
            modifier = modifier,
        )
        state.results.isEmpty() && state.submittedQuery.isNotBlank() -> FishEmptyState(
            title = stringResource(R.string.no_message_search_results),
            description = stringResource(R.string.message_search_try_different),
            modifier = modifier,
        )
        state.results.isEmpty() -> Box(
            modifier = modifier.padding(top = FishTheme.spacing.lg),
            contentAlignment = Alignment.TopStart,
        ) {
            Text(
                text = stringResource(R.string.search_this_conversation),
                color = FishTheme.colors.body,
                style = FishTheme.typography.body,
            )
        }
        else -> MessageSearchResults(
            state = state,
            onRetry = onRetry,
            onLoadMore = onLoadMore,
            onResultSelected = onResultSelected,
            modifier = modifier,
        )
    }
}

@Composable
private fun MessageSearchLoading(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .padding(top = FishTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.md),
    ) {
        Text(
            text = stringResource(R.string.message_search_loading),
            color = FishTheme.colors.body,
            style = FishTheme.typography.caption,
        )
        repeat(4) {
            Column(verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.xs)) {
                Row(horizontalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm)) {
                    FishSkeleton(Modifier.fillMaxWidth(0.32f))
                    FishSkeleton(Modifier.fillMaxWidth(0.24f))
                }
                FishSkeleton()
                FishSkeleton(Modifier.fillMaxWidth(0.68f))
            }
        }
    }
}

@Composable
private fun MessageSearchFailure(
    notice: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .padding(top = FishTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
    ) {
        FishNotice(message = notice)
        FishButton(
            label = stringResource(R.string.message_search_retry),
            onClick = onRetry,
            variant = FishButtonVariant.Secondary,
        )
    }
}

@Composable
private fun MessageSearchResults(
    state: MessageSearchUiState,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onResultSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.padding(top = FishTheme.spacing.sm),
    ) {
        if (state.notice != null) {
            item(key = "search-notice") {
                Column(
                    modifier = Modifier
                        .semantics { liveRegion = LiveRegionMode.Polite }
                        .padding(bottom = FishTheme.spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.sm),
                ) {
                    FishNotice(message = state.notice)
                    FishButton(
                        label = stringResource(R.string.message_search_retry),
                        onClick = onRetry,
                        variant = FishButtonVariant.Secondary,
                    )
                }
            }
        }
        items(
            items = state.results,
            key = MessageSearchResultUiModel::id,
        ) { result ->
            MessageSearchResultRow(
                result = result,
                onClick = { onResultSelected(result.id) },
            )
        }
        if (state.nextCursor != null) {
            item(key = "search-more") {
                FishButton(
                    label = stringResource(R.string.message_search_show_more),
                    onClick = onLoadMore,
                    variant = FishButtonVariant.Secondary,
                    loading = state.loadingMore,
                    loadingDescription = stringResource(R.string.message_search_loading_more),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = FishTheme.spacing.sm),
                )
            }
        }
    }
}

@Composable
private fun MessageSearchResultRow(
    result: MessageSearchResultUiModel,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = FishTheme.sizes.touchTarget)
            .clickable(
                role = Role.Button,
                onClick = onClick,
            )
            .semantics(mergeDescendants = true) {
                contentDescription = result.accessibilityLabel
                role = Role.Button
            }
            .padding(vertical = FishTheme.spacing.sm),
        verticalArrangement = Arrangement.spacedBy(FishTheme.spacing.twoXs),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = result.senderLabel,
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.label,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = result.dateTimeLabel,
                color = FishTheme.colors.muted,
                style = FishTheme.typography.caption,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = result.excerpt,
            color = FishTheme.colors.body,
            style = FishTheme.typography.body,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
        )
        FishDivider()
    }
}
