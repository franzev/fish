package com.fish.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.fish.android.core.designsystem.FishTheme
import com.fish.android.core.designsystem.component.FishButton
import com.fish.android.feature.chat.component.ConversationRow
import com.fish.android.core.designsystem.component.FishDivider
import com.fish.android.core.designsystem.component.FishEmptyState
import com.fish.android.core.designsystem.component.FishSkeleton
import com.fish.android.core.designsystem.component.FishNotice

@Composable
fun ChatAdaptiveLayout(
    model: ChatUiModel,
    composerState: TextFieldState,
    onSend: () -> Unit,
    onBack: () -> Unit,
    onRetryEarlier: () -> Unit,
    onSelectConversation: (String) -> Unit,
    onRetryConversation: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
    ) {
        val showConversationList =
            maxWidth >= FishTheme.layout.twoPaneBreakpoint && model.conversations.size > 1
        if (showConversationList) {
            Row(Modifier.fillMaxSize()) {
                ConversationRail(
                    conversations = model.conversations,
                    selectedConversationId = model.selectedConversationId,
                    onSelect = onSelectConversation,
                    modifier = Modifier.width(FishTheme.sizes.conversationRail),
                )
                Box(Modifier.width(FishTheme.spacing.threeXs)) { FishDivider() }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    ChatScreen(
                        model = model.copy(hasPreviousDestination = false),
                        composerState = composerState,
                        onSend = onSend,
                        onBack = onBack,
                        onRetryEarlier = onRetryEarlier,
                        onRetryConversation = onRetryConversation,
                        modifier = Modifier
                            .fillMaxHeight()
                            .widthIn(max = FishTheme.sizes.chatContentMax),
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.TopCenter,
            ) {
                ChatScreen(
                    model = model,
                    composerState = composerState,
                    onSend = onSend,
                    onBack = onBack,
                    onRetryEarlier = onRetryEarlier,
                    onRetryConversation = onRetryConversation,
                    modifier = Modifier
                        .fillMaxSize()
                        .widthIn(max = FishTheme.sizes.chatContentMax),
                )
            }
        }
    }
}

@Composable
fun ChatScreen(
    model: ChatUiModel,
    composerState: TextFieldState,
    onSend: () -> Unit,
    onBack: () -> Unit,
    onRetryEarlier: () -> Unit,
    onRetryConversation: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
    ) {
        when (model.screenState) {
            ChatScreenState.Loading -> ChatLoading(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding(),
            )
            ChatScreenState.Unavailable -> ChatUnavailable(
                hasBack = model.hasPreviousDestination,
                onBack = onBack,
                onRetry = onRetryConversation,
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding(),
            )
            ChatScreenState.Available -> {
                val participant = checkNotNull(model.participant)
                ChatTopBar(
                    participant = participant,
                    showBack = model.hasPreviousDestination,
                    onBack = onBack,
                    modifier = Modifier.statusBarsPadding(),
                )
                if (model.connection != ChatConnectionUiState.Connected) {
                    ChatConnectionNotice(
                        state = model.connection,
                        modifier = Modifier.padding(
                            horizontal = FishTheme.spacing.page,
                            vertical = FishTheme.spacing.xs,
                        ),
                    )
                }
                if (model.notice != null) {
                    FishNotice(
                        message = model.notice,
                        modifier = Modifier.padding(
                            horizontal = FishTheme.spacing.page,
                            vertical = FishTheme.spacing.xs,
                        ),
                    )
                }
                ChatTranscript(
                    messages = model.messages,
                    pagination = model.pagination,
                    typingParticipantName = model.typingParticipantName,
                    onRetryEarlier = onRetryEarlier,
                    modifier = Modifier.weight(1f),
                )
                FishDivider()
                MessageComposer(
                    state = composerState,
                    onSend = onSend,
                    editable = true,
                    sendEnabled = model.connection != ChatConnectionUiState.Offline,
                    sending = model.isSending,
                    modifier = Modifier
                        .navigationBarsPadding()
                        .imePadding(),
                )
            }
        }
    }
}

@Composable
fun ChatTranscript(
    messages: List<MessageUiModel>,
    pagination: OlderMessagesUiState,
    typingParticipantName: String?,
    onRetryEarlier: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (messages.isEmpty() && pagination == OlderMessagesUiState.Idle) {
        Box(modifier = modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            FishEmptyState(
                title = stringResource(R.string.no_messages_title),
                description = stringResource(R.string.no_messages_description),
            )
        }
        return
    }

    val listState = rememberLazyListState()
    var previousLastMessageId by remember { mutableStateOf<String?>(null) }
    val lastMessageId = messages.lastOrNull()?.id
    LaunchedEffect(lastMessageId) {
        val lastVisibleIndex = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
        val nearLatest = lastVisibleIndex >= listState.layoutInfo.totalItemsCount - 3
        val sentByCurrentUser = messages.lastOrNull()?.isOutgoing == true
        if (messages.isNotEmpty() &&
            (previousLastMessageId == null || nearLatest || sentByCurrentUser)
        ) {
            listState.scrollToItem(messages.lastIndex + 1)
        }
        previousLastMessageId = lastMessageId
    }
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        state = listState,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            horizontal = FishTheme.spacing.page,
            vertical = FishTheme.spacing.xs,
        ),
    ) {
        item(key = "older-state", contentType = "older-state") {
            OlderMessagesState(state = pagination, onRetry = onRetryEarlier)
        }
        items(
            items = messages,
            key = { it.id },
            contentType = { "message" },
        ) { message ->
            if (message.dateLabel != null) {
                MessageDateSeparator(message.dateLabel)
            }
            if (message.startsUnread) {
                UnreadMessageDivider()
            }
            MessageBubble(
                message = message,
                modifier = Modifier.padding(
                    bottom = if (message.groupedWithNext) {
                        FishTheme.spacing.nudge
                    } else {
                        FishTheme.spacing.sm
                    },
                ),
            )
        }
        if (typingParticipantName != null) {
            item(key = "typing", contentType = "typing") {
                TypingIndicator(typingParticipantName)
            }
        }
    }
}

@Composable
private fun ConversationRail(
    conversations: List<ConversationPreviewUiModel>,
    selectedConversationId: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.surface)
            .statusBarsPadding()
            .padding(FishTheme.spacing.sm),
    ) {
        Text(
            text = stringResource(R.string.personal_messages),
            modifier = Modifier.padding(
                start = FishTheme.spacing.sm,
                top = FishTheme.spacing.sm,
                bottom = FishTheme.spacing.md,
            ),
            color = FishTheme.colors.foreground,
            style = FishTheme.typography.heading,
        )
        LazyColumn {
            items(conversations, key = { it.conversationId }) { conversation ->
                ConversationRow(
                    name = conversation.participantName,
                    snippet = conversation.snippet,
                    time = conversation.timeLabel,
                    unreadCount = conversation.unreadCount,
                    selected = conversation.conversationId == selectedConversationId,
                    onClick = { onSelect(conversation.conversationId) },
                )
                Spacer(Modifier.height(FishTheme.spacing.xs))
            }
        }
    }
}

@Composable
fun ConversationListScreen(
    conversations: List<ConversationPreviewUiModel>,
    selectedConversationId: String?,
    notice: String?,
    onSelectConversation: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FishTheme.colors.background),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = FishTheme.sizes.chatContentMax)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(FishTheme.spacing.page),
        ) {
            Text(
                text = stringResource(R.string.personal_messages),
                color = FishTheme.colors.foreground,
                style = FishTheme.typography.heading,
            )
            Text(
                text = stringResource(R.string.conversation_list_description),
                modifier = Modifier.padding(top = FishTheme.spacing.xs),
                color = FishTheme.colors.body,
                style = FishTheme.typography.ui,
            )
            if (notice != null) {
                FishNotice(
                    message = notice,
                    modifier = Modifier.padding(top = FishTheme.spacing.md),
                )
            }
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = FishTheme.spacing.lg),
            ) {
                items(conversations, key = { it.conversationId }) { conversation ->
                    ConversationRow(
                        name = conversation.participantName,
                        snippet = conversation.snippet,
                        time = conversation.timeLabel,
                        unreadCount = conversation.unreadCount,
                        selected = conversation.conversationId == selectedConversationId,
                        onClick = { onSelectConversation(conversation.conversationId) },
                    )
                    Spacer(Modifier.height(FishTheme.spacing.xs))
                }
            }
        }
    }
}

@Composable
private fun ChatLoading(modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(FishTheme.spacing.page)) {
        FishSkeleton(width = FishTheme.sizes.conversationRail)
        Spacer(Modifier.height(FishTheme.spacing.xl))
        repeat(4) {
            FishSkeleton()
            Spacer(Modifier.height(FishTheme.spacing.md))
        }
    }
}

@Composable
private fun ChatUnavailable(
    hasBack: Boolean,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        FishEmptyState(
            title = stringResource(R.string.conversation_unavailable_title),
            description = stringResource(R.string.conversation_unavailable_description),
            action = {
                FishButton(
                    label = stringResource(
                        if (hasBack) R.string.back else R.string.retry_conversation,
                    ),
                    onClick = if (hasBack) onBack else onRetry,
                    variant = com.fish.android.core.designsystem.component.FishButtonVariant.Secondary,
                )
            },
        )
    }
}
