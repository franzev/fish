package space.fishhub.android.feature.chat.state

import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.LocalMessageStatus

fun reduceChatState(state: ChatState, event: ChatEvent): ChatState = when (event) {
    is ChatEvent.HydrateConversation -> {
        val conversation = state.conversation(event.conversationId)
        state.withConversation(
            conversation.copy(
                messages = mergeHydratedMessages(
                    conversation.messages,
                    event.messages.map { it.normalized(LocalMessageStatus.Sent) },
                ),
                readStates = event.readStates,
            ),
        )
    }
    is ChatEvent.DraftChanged -> state.updateConversation(event.conversationId) {
        copy(composer = composer.copy(draft = event.draft))
    }
    is ChatEvent.SendOptimisticMessage -> state.mergeMessage(
        event.message.normalized(LocalMessageStatus.Sending),
    )
    is ChatEvent.ConfirmSentMessage -> state.mergeMessage(
        event.message.stripFailure().normalized(LocalMessageStatus.Sent),
        event.localRequestId ?: event.message.clientRequestId,
    )
    is ChatEvent.MarkMessageFailed -> state.markMessageFailed(event)
    is ChatEvent.MergeRemoteMessage -> state.mergeMessage(
        event.message.stripFailure().normalized(LocalMessageStatus.Sent),
        event.localRequestId ?: event.message.clientRequestId,
    )
    is ChatEvent.MergeReadState -> state.updateConversation(event.conversationId) {
        copy(readStates = mergeReadState(readStates, event.readState))
    }
    is ChatEvent.SetReplyTarget -> state.updateConversation(event.conversationId) {
        copy(composer = composer.copy(replyTargetId = event.messageId))
    }
    is ChatEvent.SetEditTarget -> state.updateConversation(event.conversationId) {
        copy(composer = composer.copy(editTargetId = event.messageId))
    }
    is ChatEvent.SetRealtimeStatus -> state.updateConversation(event.conversationId) {
        val hasConnected = realtime.hasConnected || event.status == RealtimeConnectionStatus.Connected
        if (realtime.status == event.status && realtime.hasConnected == hasConnected) this else copy(
            realtime = realtime.copy(status = event.status, hasConnected = hasConnected),
        )
    }
    is ChatEvent.ClearComposer -> state.updateConversation(event.conversationId) {
        copy(composer = ChatComposerState())
    }
    is ChatEvent.HydrateWindow -> {
        val conversation = state.conversation(event.conversationId)
        state.withConversation(
            conversation.copy(
                messages = mergeHydratedMessages(
                    conversation.messages,
                    event.messages.map { it.normalized(LocalMessageStatus.Sent) },
                ),
                readStates = event.readStates,
                pagination = ChatPaginationState(
                    oldestLoadedCursor = event.oldestCursor,
                    hasMoreOlder = event.hasMoreOlder,
                ),
            ),
        )
    }
    is ChatEvent.OlderMessagesRequested -> state.updateConversation(event.conversationId) {
        if (pagination.isLoadingOlder) this else copy(
            pagination = pagination.copy(isLoadingOlder = true, hasLoadError = false),
        )
    }
    is ChatEvent.OlderPageLoaded -> state.updateConversation(event.conversationId) {
        copy(
            messages = event.messages.fold(messages) { current, message ->
                mergeChatMessage(current, message.normalized(LocalMessageStatus.Sent))
            },
            pagination = ChatPaginationState(
                oldestLoadedCursor = event.oldestCursor,
                hasMoreOlder = event.hasMoreOlder,
            ),
        )
    }
    is ChatEvent.OlderPageLoadFailed -> state.updateConversation(event.conversationId) {
        if (!pagination.isLoadingOlder) this else copy(
            pagination = pagination.copy(isLoadingOlder = false, hasLoadError = true),
        )
    }
}

fun applyChatEvents(state: ChatState, events: List<ChatEvent>): ChatState =
    events.fold(state, ::reduceChatState)

private fun ChatState.mergeMessage(
    message: ChatMessage,
    localRequestId: String = message.clientRequestId,
): ChatState = updateConversation(message.conversationId) {
    copy(messages = mergeChatMessage(messages, message, localRequestId))
}

private fun mergeHydratedMessages(
    existing: List<ChatMessage>,
    incoming: List<ChatMessage>,
): List<ChatMessage> {
    val unresolved = existing.filter {
        it.localStatus == LocalMessageStatus.Pending ||
            it.localStatus == LocalMessageStatus.Sending ||
            it.localStatus == LocalMessageStatus.Failed
    }
    return incoming.fold(unresolved) { current, message ->
        mergeChatMessage(current, message)
    }.sortedWith(ChatMessageComparator)
}

private fun ChatState.markMessageFailed(event: ChatEvent.MarkMessageFailed): ChatState =
    updateConversation(event.conversationId) {
        val failedMessage = messages.firstOrNull { it.clientRequestId == event.clientRequestId }
        if (failedMessage?.localStatus == LocalMessageStatus.Sent) return@updateConversation this
        val restoredDraft = if (composer.draft.isEmpty()) failedMessage?.body ?: composer.draft else {
            composer.draft
        }
        copy(
            messages = messages.map { message ->
                if (message.clientRequestId == event.clientRequestId) {
                    message.copy(
                        localStatus = LocalMessageStatus.Failed,
                        failureReason = event.reason,
                    )
                } else {
                    message
                }
            },
            composer = composer.copy(draft = restoredDraft),
        )
    }

private fun ChatState.updateConversation(
    conversationId: String,
    transform: ChatConversationState.() -> ChatConversationState,
): ChatState = withConversation(conversation(conversationId).transform())

private fun ChatState.withConversation(conversation: ChatConversationState): ChatState = copy(
    conversations = conversations + (conversation.conversationId to conversation),
)

private fun ChatState.conversation(conversationId: String): ChatConversationState =
    conversations[conversationId] ?: ChatConversationState(conversationId = conversationId)

private fun ChatMessage.normalized(status: LocalMessageStatus): ChatMessage = copy(
    reactions = reactions,
    localStatus = status,
)

private fun ChatMessage.stripFailure(): ChatMessage = copy(failureReason = null)
