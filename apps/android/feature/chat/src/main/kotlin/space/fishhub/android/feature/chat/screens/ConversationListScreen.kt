package space.fishhub.android.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import space.fishhub.android.core.designsystem.FishTheme
import space.fishhub.android.core.designsystem.component.FishNotice
import space.fishhub.android.feature.chat.R
import space.fishhub.android.feature.chat.views.ConversationRow
import space.fishhub.android.feature.chat.model.ConversationPreviewUiModel

@Composable
fun ConversationListScreen(
    currentUserDisplayName: String,
    conversations: List<ConversationPreviewUiModel>,
    selectedConversationId: String?,
    notice: String?,
    onSelectConversation: (String) -> Unit,
    accountContent: (@Composable () -> Unit)? = null,
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(R.string.personal_messages),
                    modifier = Modifier.weight(1f),
                    color = FishTheme.colors.foreground,
                    style = FishTheme.typography.heading,
                )
                accountContent?.invoke()
            }
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
                        snippet = if (conversation.hasDraft) {
                            "Draft · ${conversation.snippet}"
                        } else conversation.snippet,
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
