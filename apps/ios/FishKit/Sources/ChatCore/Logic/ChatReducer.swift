import Foundation

public enum ChatStateReducer {
    public static func createEmptyChatState() -> ChatState { ChatState() }

    public static func apply(_ events: [ChatEvent], to state: ChatState) -> ChatState {
        events.reduce(state, reduce)
    }

    public static func reduce(_ state: ChatState, _ event: ChatEvent) -> ChatState {
        switch event {
        case .hydrateConversation(let id, let messages, let readStates):
            var conversation = conversation(in: state, id: id)
            conversation.messages = mergeHydratedMessages(
                conversation.messages,
                messages.map { normalize($0, status: .sent) }
            )
            conversation.readStates = readStates
            return setting(conversation, in: state)

        case .draftChanged(let id, let draft):
            return updating(state, id: id) { $0.composer.draft = draft }

        case .sendOptimisticMessage(let message):
            return merging(normalize(message, status: .sending), into: state)

        case .confirmSentMessage(let message, let localRequestId):
            return merging(
                normalize(strippingFailure(message), status: .sent),
                into: state,
                localRequestId: localRequestId
            )

        case .markMessageFailed(let id, let requestId, let reason):
            return markFailed(state, conversationId: id, requestId: requestId, reason: reason)

        case .mergeRemoteMessage(let message, let localRequestId):
            return merging(
                normalize(strippingFailure(message), status: .sent),
                into: state,
                localRequestId: localRequestId
            )

        case .mergeReadState(let id, let readState):
            return updating(state, id: id) {
                $0.readStates = ChatSelectors.mergeReadState($0.readStates, readState)
            }

        case .setReplyTarget(let id, let messageId):
            return updating(state, id: id) { $0.composer.replyTargetId = messageId }

        case .setEditTarget(let id, let messageId):
            return updating(state, id: id) { $0.composer.editTargetId = messageId }

        case .setRealtimeStatus(let id, let status):
            return updating(state, id: id) { $0.realtime.status = status }

        case .clearComposer(let id):
            return updating(state, id: id) { $0.composer = ChatComposerState() }

        case .hydrateWindow(let id, let messages, let reads, let hasMore, let cursor):
            var conversation = conversation(in: state, id: id)
            conversation.messages = mergeHydratedMessages(
                conversation.messages,
                messages.map { normalize($0, status: .sent) }
            )
            conversation.readStates = reads
            conversation.pagination = ChatPaginationState(
                oldestLoadedCursor: cursor,
                hasMoreOlder: hasMore
            )
            return setting(conversation, in: state)

        case .olderMessagesRequested(let id):
            return updating(state, id: id) {
                guard !$0.pagination.isLoadingOlder else { return }
                $0.pagination.isLoadingOlder = true
                $0.pagination.hasLoadError = false
            }

        case .olderPageLoaded(let id, let messages, let hasMore, let cursor):
            return updating(state, id: id) { conversation in
                conversation.messages = messages.reduce(conversation.messages) {
                    ChatSelectors.mergeChatMessage($0, normalize($1, status: .sent))
                }
                conversation.pagination = ChatPaginationState(
                    oldestLoadedCursor: cursor,
                    hasMoreOlder: hasMore
                )
            }

        case .olderPageLoadFailed(let id):
            return updating(state, id: id) {
                guard $0.pagination.isLoadingOlder else { return }
                $0.pagination.isLoadingOlder = false
                $0.pagination.hasLoadError = true
            }
        }
    }

    private static func merging(
        _ message: ChatMessageState,
        into state: ChatState,
        localRequestId: String? = nil
    ) -> ChatState {
        updating(state, id: message.conversationId) {
            $0.messages = ChatSelectors.mergeChatMessage(
                $0.messages,
                message,
                localRequestId: localRequestId
            )
        }
    }

    private static func mergeHydratedMessages(
        _ existing: [ChatMessageState],
        _ incoming: [ChatMessageState]
    ) -> [ChatMessageState] {
        let unresolved = existing.filter {
            $0.localStatus == .pending || $0.localStatus == .sending || $0.localStatus == .failed
        }
        return incoming.reduce(unresolved) {
            ChatSelectors.mergeChatMessage($0, $1)
        }.sorted(
            by: ChatSelectors.compareChatMessages
        )
    }

    private static func markFailed(
        _ state: ChatState,
        conversationId: String,
        requestId: String,
        reason: String?
    ) -> ChatState {
        updating(state, id: conversationId) { conversation in
            let failed = conversation.messages.first { $0.clientRequestId == requestId }
            guard failed?.localStatus != .sent else { return }
            let restoreDraft = conversation.composer.draft.isEmpty
            conversation.messages = conversation.messages.map { message in
                guard message.clientRequestId == requestId else { return message }
                var next = message
                next.localStatus = .failed
                next.failureReason = reason
                return next
            }
            if restoreDraft { conversation.composer.draft = failed?.body ?? "" }
        }
    }

    private static func normalize(
        _ message: ChatMessageState,
        status: LocalMessageStatus
    ) -> ChatMessageState {
        var next = message
        next.reactions = message.reactions ?? []
        next.localStatus = status
        return next
    }

    private static func strippingFailure(_ message: ChatMessageState) -> ChatMessageState {
        var next = message
        next.failureReason = nil
        return next
    }

    private static func conversation(in state: ChatState, id: String) -> ChatConversationState {
        state.conversations[id] ?? ChatConversationState(conversationId: id)
    }

    private static func updating(
        _ state: ChatState,
        id: String,
        _ update: (inout ChatConversationState) -> Void
    ) -> ChatState {
        var conversation = conversation(in: state, id: id)
        let original = conversation
        update(&conversation)
        guard conversation != original || state.conversations[id] == nil else { return state }
        return setting(conversation, in: state)
    }

    private static func setting(_ conversation: ChatConversationState, in state: ChatState) -> ChatState {
        var next = state
        next.conversations[conversation.conversationId] = conversation
        return next
    }
}

public func createEmptyChatState() -> ChatState { ChatStateReducer.createEmptyChatState() }

public func applyChatEvents(_ state: ChatState, _ events: [ChatEvent]) -> ChatState {
    ChatStateReducer.apply(events, to: state)
}

public func reduceChatState(_ state: ChatState, _ event: ChatEvent) -> ChatState {
    ChatStateReducer.reduce(state, event)
}
