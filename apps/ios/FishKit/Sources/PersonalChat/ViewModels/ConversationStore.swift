import ChatCore
import ChatData
import Foundation
import Observation

@MainActor @Observable
public final class ConversationStore {
    public static let pageSize = 40

    public let conversationId: String
    public let currentUserId: String
    public let participantId: String
    public let participantName: String
    public let currentUserName: String
    public let currentUserRole: ChatUserRole

    public var draft = "" {
        didSet {
            guard draft != oldValue else { return }
            reduce(.draftChanged(conversationId: conversationId, draft: draft))
            scheduleTyping(for: draft)
        }
    }
    public var selection = ComposerSelection.none
    public var presence: PresenceUiModel?

    private let messaging: any ChatMessagingProviding
    private let commands: any ChatCommandProviding
    private let realtime: any ChatRealtimeProviding
    private let gifProvider: (any GifProviding)?
    private let now: @Sendable () -> Date
    private let sleep: @Sendable (Duration) async throws -> Void

    private var state = ChatState()
    private var phase = PersonalChatPhase.loading
    private var notice: String?
    private var participantTyping = false
    private var subscription: ChatRealtimeSubscription?
    private var eventTask: Task<Void, Never>?
    private var connectionTask: Task<Void, Never>?
    private var typingIdleTask: Task<Void, Never>?
    private var typingWatchdogTask: Task<Void, Never>?
    private var typingVersion = 0
    private var started = false
    private var pendingSends: [String: SendChatMessageRequest] = [:]
    private var draftBeforeEdit: String?
    private var readCommandInFlight = false
    private var queuedDeliveredMessageId: String?
    private var queuedReadMessageId: String?

    public init(
        conversationId: String,
        currentUserId: String,
        participantId: String,
        participantName: String,
        currentUserName: String = "You",
        currentUserRole: ChatUserRole = .client,
        messaging: any ChatMessagingProviding,
        commands: any ChatCommandProviding,
        realtime: any ChatRealtimeProviding,
        gifProvider: (any GifProviding)? = nil,
        presence: PresenceUiModel? = nil,
        now: @escaping @Sendable () -> Date = Date.init,
        sleep: @escaping @Sendable (Duration) async throws -> Void = {
            try await Task.sleep(for: $0)
        }
    ) {
        self.conversationId = conversationId
        self.currentUserId = currentUserId
        self.participantId = participantId
        self.participantName = participantName
        self.currentUserName = currentUserName
        self.currentUserRole = currentUserRole
        self.messaging = messaging
        self.commands = commands
        self.realtime = realtime
        self.gifProvider = gifProvider
        self.presence = presence
        self.now = now
        self.sleep = sleep
    }

    public var model: PersonalChatUiModel {
        let conversation = currentConversation
        return PersonalChatUiModel(
            participantName: participantName,
            presence: presence,
            phase: phase,
            connection: connectionModel(conversation.realtime.status),
            olderMessages: olderModel(conversation.pagination),
            messages: presentationMessages(conversation),
            unreadAfterMessageId: unreadMarker(conversation),
            isParticipantTyping: participantTyping,
            composerContext: composerContext(conversation),
            notice: notice
        )
    }

    public func start() async {
        guard !started else { return }
        started = true
        phase = .loading
        reduce(.setRealtimeStatus(conversationId: conversationId, status: .connecting))
        do {
            let window = try await messaging.newestWindow(
                conversationId: conversationId,
                limit: Self.pageSize
            )
            reduce(.hydrateWindow(
                conversationId: conversationId,
                messages: window.messages.map(\.coreState),
                readStates: window.readStates,
                hasMoreOlder: window.hasMoreOlder,
                oldestCursor: window.oldestCursor
            ))
            phase = .ready
            subscribe()
            if let incoming = latestIncomingMessageId() {
                await acknowledge(deliveredMessageId: incoming, readMessageId: nil)
            }
        } catch {
            phase = .unavailable
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .disconnected))
        }
    }

    public func stop() {
        typingIdleTask?.cancel()
        typingWatchdogTask?.cancel()
        eventTask?.cancel()
        connectionTask?.cancel()
        if let subscription {
            Task { await subscription.sendTyping(false) }
            subscription.cancel()
        }
        subscription = nil
        participantTyping = false
        started = false
    }

    public func send(_ payload: ChatSendPayload) async {
        if currentConversation.composer.editTargetId != nil {
            await saveEdit(payload.body)
            return
        }
        guard payload.selectionIsCompatibleWithAttachments else {
            notice = "Send the expression or the attachments in a separate message."
            return
        }
        let requestId = UUID().uuidString.lowercased()
        let request = makeRequest(payload, clientRequestId: requestId)
        let optimistic = optimisticMessage(
            payload,
            requestId: requestId,
            replyToMessageId: request.replyToMessageId
        )
        pendingSends[requestId] = request
        reduce(.sendOptimisticMessage(message: optimistic))
        clearComposerAfterSend()
        await send(request)
    }

    public func retry(messageId: String) async {
        guard
            let message = currentConversation.messages.first(where: { $0.id == messageId }),
            let request = pendingSends[message.clientRequestId]
        else { return }
        reduce(.sendOptimisticMessage(message: message))
        await send(request)
    }

    public func loadOlder() async {
        let pagination = currentConversation.pagination
        guard pagination.hasMoreOlder,
              !pagination.isLoadingOlder,
              let cursor = pagination.oldestLoadedCursor
        else { return }
        reduce(.olderMessagesRequested(conversationId: conversationId))
        do {
            let page = try await messaging.messages(
                conversationId: conversationId,
                before: cursor,
                limit: Self.pageSize
            )
            reduce(.olderPageLoaded(
                conversationId: conversationId,
                messages: page.messages.map(\.coreState),
                hasMoreOlder: page.hasMoreOlder,
                oldestCursor: page.oldestCursor
            ))
        } catch {
            reduce(.olderPageLoadFailed(conversationId: conversationId))
        }
    }

    public func visibleMessage(_ messageId: String) {
        let messages = currentConversation.messages
        guard let visibleIndex = messages.firstIndex(where: { $0.id == messageId }) else { return }
        guard let incoming = messages[...visibleIndex].last(where: {
            $0.senderId != currentUserId && $0.localStatus == .sent
        }) else { return }
        Task {
            await acknowledge(
                deliveredMessageId: incoming.id,
                readMessageId: incoming.id
            )
        }
    }

    public func composerFocusChanged(_ isFocused: Bool) {
        guard !isFocused else { return }
        typingIdleTask?.cancel()
        typingVersion += 1
        Task { await subscription?.sendTyping(false) }
    }

    public func perform(_ action: MessageAction) {
        switch action {
        case .reply(let id): beginReply(to: id)
        case .edit(let id): beginEdit(id)
        case .delete(let id): Task { await delete(id) }
        case .toggleReaction(let id, let emoji):
            Task { await toggleReaction(messageId: id, emoji: emoji) }
        case .reportGif(let id): Task { await reportGif(id) }
        }
    }

    public func cancelComposerContext() {
        let wasEditing = currentConversation.composer.editTargetId != nil
        reduce(.setReplyTarget(conversationId: conversationId, messageId: nil))
        reduce(.setEditTarget(conversationId: conversationId, messageId: nil))
        if wasEditing, let restored = draftBeforeEdit {
            draft = restored
        }
        draftBeforeEdit = nil
    }

    // MARK: - Realtime

    private func subscribe() {
        let subscription = realtime.subscribe(
            conversationId: conversationId,
            currentUserId: currentUserId
        )
        self.subscription = subscription
        eventTask = Task { [weak self] in
            for await event in subscription.events {
                guard let self, !Task.isCancelled else { return }
                await self.receive(event)
            }
        }
        connectionTask = Task { [weak self] in
            for await connection in subscription.connections {
                guard let self, !Task.isCancelled else { return }
                await self.receive(connection)
            }
        }
    }

    private func receive(_ connection: ChatRealtimeConnection) async {
        switch connection {
        case .connecting:
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .connecting))
        case .connected:
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .connected))
            await backfillGap()
        case .reconnected:
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .connecting))
            await backfillGap()
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .connected))
        case .disconnected:
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .disconnected))
        }
    }

    private func receive(_ event: ChatRealtimeEvent) async {
        switch event {
        case .messageChanged(let raw):
            let message = (try? await messaging.messages(ids: [raw.id]).first) ?? raw
            reduce(.mergeRemoteMessage(
                message: message.coreState,
                localRequestId: message.clientRequestId
            ))
            if message.senderId != currentUserId {
                await acknowledge(deliveredMessageId: message.id, readMessageId: nil)
            }
        case .readStateChanged(let read):
            mergeReadStateMonotonically(read)
        case .reactionsChanged(let messageId):
            if let refreshed = try? await messaging.messages(ids: [messageId]).first {
                reduce(.mergeRemoteMessage(
                    message: refreshed.coreState,
                    localRequestId: refreshed.clientRequestId
                ))
            }
        case .typingChanged(let userId, let isTyping):
            guard userId == participantId else { return }
            receiveTyping(isTyping)
        }
    }

    private func backfillGap() async {
        guard let newest = currentConversation.messages.last(where: { $0.localStatus == .sent }) else {
            return
        }
        let cursor = ChatMessageCursor(createdAt: newest.createdAt, id: newest.id)
        do {
            let page = try await messaging.messages(
                conversationId: conversationId,
                after: cursor,
                limit: Self.pageSize
            )
            if page.needsReset {
                let window = try await messaging.newestWindow(
                    conversationId: conversationId,
                    limit: Self.pageSize
                )
                reduce(.hydrateWindow(
                    conversationId: conversationId,
                    messages: window.messages.map(\.coreState),
                    readStates: window.readStates,
                    hasMoreOlder: window.hasMoreOlder,
                    oldestCursor: window.oldestCursor
                ))
            } else {
                for message in page.messages {
                    reduce(.mergeRemoteMessage(
                        message: message.coreState,
                        localRequestId: message.clientRequestId
                    ))
                }
            }
        } catch {
            reduce(.setRealtimeStatus(conversationId: conversationId, status: .disconnected))
        }
    }

    // MARK: - Sends and actions

    private func send(_ request: SendChatMessageRequest) async {
        do {
            let sent = try await messaging.send(request)
            reduce(.confirmSentMessage(
                message: sent.coreState,
                localRequestId: request.clientRequestId
            ))
            pendingSends[request.clientRequestId] = nil
            if let gif = request.gif {
                await gifProvider?.registerShare(gif: gif, query: "")
            }
            notice = nil
        } catch let failure as ChatCommandFailure {
            handleSendFailure(request, failure: failure)
        } catch {
            handleSendFailure(request, failure: .sendUnavailable)
        }
    }

    private func handleSendFailure(
        _ request: SendChatMessageRequest,
        failure: ChatCommandFailure
    ) {
        reduce(.markMessageFailed(
            conversationId: conversationId,
            clientRequestId: request.clientRequestId,
            reason: failure.notice
        ))
        guard currentConversation.messages.contains(where: {
            $0.clientRequestId == request.clientRequestId && $0.localStatus == .failed
        }) else {
            pendingSends[request.clientRequestId] = nil
            return
        }
        if draft.isEmpty { draft = request.body }
        notice = failure.notice
    }

    private func beginReply(to id: String) {
        guard message(id)?.deletedAt == nil else { return }
        draftBeforeEdit = nil
        reduce(.setEditTarget(conversationId: conversationId, messageId: nil))
        reduce(.setReplyTarget(conversationId: conversationId, messageId: id))
    }

    private func beginEdit(_ id: String) {
        guard let message = message(id),
              message.senderId == currentUserId,
              message.deletedAt == nil,
              !message.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return }
        draftBeforeEdit = draft
        reduce(.setReplyTarget(conversationId: conversationId, messageId: nil))
        reduce(.setEditTarget(conversationId: conversationId, messageId: id))
        draft = message.body
    }

    private func saveEdit(_ body: String) async {
        guard let id = currentConversation.composer.editTargetId else { return }
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            notice = "Add a message before saving."
            return
        }
        do {
            let confirmed = try await commands.execute(.edit(messageId: id, body: trimmed))
            reduce(.mergeRemoteMessage(
                message: confirmed.coreState,
                localRequestId: confirmed.clientRequestId
            ))
            draftBeforeEdit = nil
            draft = ""
            reduce(.setEditTarget(conversationId: conversationId, messageId: nil))
            notice = nil
        } catch let failure as ChatCommandFailure {
            notice = failure.notice
        } catch {
            notice = ChatCommandFailure.unavailable.notice
        }
    }

    private func delete(_ id: String) async {
        guard let original = message(id),
              original.senderId == currentUserId,
              original.deletedAt == nil
        else { return }
        var tombstone = original
        let optimisticDeletedAt = ChatTimestamp.string(now())
        tombstone.deletedAt = optimisticDeletedAt
        tombstone.body = ""
        tombstone.gif = nil
        tombstone.stickerId = nil
        tombstone.attachments = []
        tombstone.images = []
        reduce(.mergeRemoteMessage(message: tombstone, localRequestId: original.clientRequestId))
        do {
            let confirmed = try await commands.execute(.delete(messageId: id))
            reduce(.mergeRemoteMessage(
                message: confirmed.coreState,
                localRequestId: confirmed.clientRequestId
            ))
            notice = nil
        } catch let failure as ChatCommandFailure {
            await reconcileFailedMutation(messageId: id, original: original) {
                $0.deletedAt == optimisticDeletedAt
            }
            notice = failure.notice
        } catch {
            await reconcileFailedMutation(messageId: id, original: original) {
                $0.deletedAt == optimisticDeletedAt
            }
            notice = ChatCommandFailure.unavailable.notice
        }
    }

    private func toggleReaction(messageId: String, emoji: String) async {
        guard ["👍", "❤️", "🎉", "🙏"].contains(emoji),
              let original = message(messageId),
              original.deletedAt == nil
        else { return }
        var optimistic = original
        var reactions = optimistic.reactions ?? []
        if let index = reactions.firstIndex(where: { $0.emoji == emoji }) {
            let reaction = reactions[index]
            if reaction.byMe {
                if reaction.count == 1 {
                    reactions.remove(at: index)
                } else {
                    reactions[index] = ChatReactionState(
                        emoji: emoji,
                        count: reaction.count - 1,
                        byMe: false
                    )
                }
            } else {
                reactions[index] = ChatReactionState(
                    emoji: emoji,
                    count: reaction.count + 1,
                    byMe: true
                )
            }
        } else {
            reactions.append(ChatReactionState(emoji: emoji, count: 1, byMe: true))
        }
        optimistic.reactions = reactions
        reduce(.mergeRemoteMessage(message: optimistic, localRequestId: original.clientRequestId))
        do {
            let confirmed = try await commands.execute(
                .toggleReaction(messageId: messageId, emoji: emoji)
            )
            reduce(.mergeRemoteMessage(
                message: confirmed.coreState,
                localRequestId: confirmed.clientRequestId
            ))
            notice = nil
        } catch let failure as ChatCommandFailure {
            await reconcileFailedMutation(messageId: messageId, original: original) {
                $0.reactions == reactions
            }
            notice = failure.notice
        } catch {
            await reconcileFailedMutation(messageId: messageId, original: original) {
                $0.reactions == reactions
            }
            notice = ChatCommandFailure.unavailable.notice
        }
    }

    private func reconcileFailedMutation(
        messageId: String,
        original: ChatMessageState,
        stillOptimistic: (ChatMessageState) -> Bool
    ) async {
        if let refreshed = try? await messaging.messages(ids: [messageId]).first {
            reduce(.mergeRemoteMessage(
                message: refreshed.coreState,
                localRequestId: refreshed.clientRequestId
            ))
        } else if let current = message(messageId), stillOptimistic(current) {
            reduce(.mergeRemoteMessage(
                message: original,
                localRequestId: original.clientRequestId
            ))
        }
    }

    private func reportGif(_ id: String) async {
        guard message(id)?.gif != nil else { return }
        do {
            try await commands.reportGif(messageId: id)
            notice = "Thanks. We’ll review this GIF."
        } catch let failure as ChatCommandFailure {
            notice = failure.notice
        } catch {
            notice = "That report did not send yet. Try again."
        }
    }

    // MARK: - Typing and receipts

    private func scheduleTyping(for draft: String) {
        typingVersion += 1
        let version = typingVersion
        typingIdleTask?.cancel()
        guard !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            Task { await subscription?.sendTyping(false) }
            return
        }
        Task { await subscription?.sendTyping(true) }
        typingIdleTask = Task { [sleep] in
            do { try await sleep(.seconds(3)) } catch { return }
            guard !Task.isCancelled, version == self.typingVersion else { return }
            await self.subscription?.sendTyping(false)
        }
    }

    private func receiveTyping(_ value: Bool) {
        typingWatchdogTask?.cancel()
        participantTyping = value
        guard value else { return }
        typingWatchdogTask = Task { [sleep] in
            do { try await sleep(.seconds(4)) } catch { return }
            guard !Task.isCancelled else { return }
            self.participantTyping = false
        }
    }

    private func acknowledge(deliveredMessageId: String?, readMessageId: String?) async {
        guard deliveredMessageId != nil || readMessageId != nil else { return }
        if readCommandInFlight {
            if let deliveredMessageId {
                queuedDeliveredMessageId = laterMarker(
                    queuedDeliveredMessageId,
                    deliveredMessageId
                )
            }
            if let readMessageId { queuedReadMessageId = laterMarker(queuedReadMessageId, readMessageId) }
            return
        }
        let current = readState(for: currentUserId)
        let delivered = laterMarker(current?.lastDeliveredMessageId, deliveredMessageId)
        let read = laterMarker(current?.lastReadMessageId, readMessageId)
        guard delivered != current?.lastDeliveredMessageId || read != current?.lastReadMessageId else {
            return
        }
        let stamp = ChatTimestamp.string(now())
        mergeReadStateMonotonically(ChatReadState(
            userId: currentUserId,
            lastDeliveredMessageId: delivered,
            deliveredAt: delivered == current?.lastDeliveredMessageId ? current?.deliveredAt : stamp,
            lastReadMessageId: read,
            readAt: read == current?.lastReadMessageId ? current?.readAt : stamp
        ))
        readCommandInFlight = true
        do {
            let confirmed = try await commands.markReadState(
                conversationId: conversationId,
                lastDeliveredMessageId: delivered,
                lastReadMessageId: read
            )
            mergeReadStateMonotonically(confirmed)
            notice = nil
        } catch let failure as ChatCommandFailure {
            notice = failure.notice
        } catch {
            notice = ChatCommandFailure.markReadUnavailable.notice
        }
        readCommandInFlight = false
        if queuedDeliveredMessageId != nil || queuedReadMessageId != nil {
            let delivered = queuedDeliveredMessageId
            let read = queuedReadMessageId
            queuedDeliveredMessageId = nil
            queuedReadMessageId = nil
            await acknowledge(deliveredMessageId: delivered, readMessageId: read)
        }
    }

    private func mergeReadStateMonotonically(_ incoming: ChatReadState) {
        guard let current = readState(for: incoming.userId) else {
            reduce(.mergeReadState(conversationId: conversationId, readState: incoming))
            return
        }
        let delivered = monotonicMarker(
            currentId: current.lastDeliveredMessageId,
            currentTimestamp: current.deliveredAt,
            incomingId: incoming.lastDeliveredMessageId,
            incomingTimestamp: incoming.deliveredAt
        )
        let read = monotonicMarker(
            currentId: current.lastReadMessageId,
            currentTimestamp: current.readAt,
            incomingId: incoming.lastReadMessageId,
            incomingTimestamp: incoming.readAt
        )
        let merged = ChatReadState(
            userId: incoming.userId,
            lastDeliveredMessageId: delivered.id,
            deliveredAt: delivered.timestamp,
            lastReadMessageId: read.id,
            readAt: read.timestamp
        )
        reduce(.mergeReadState(conversationId: conversationId, readState: merged))
    }

    // MARK: - Mapping

    private var currentConversation: ChatConversationState {
        state.conversations[conversationId] ?? ChatConversationState(conversationId: conversationId)
    }

    private func reduce(_ event: ChatEvent) {
        state = ChatStateReducer.reduce(state, event)
    }

    private func message(_ id: String) -> ChatMessageState? {
        currentConversation.messages.first { $0.id == id }
    }

    private func readState(for userId: String) -> ChatReadState? {
        currentConversation.readStates.first { $0.userId == userId }
    }

    private func laterMarker(_ first: String?, _ second: String?) -> String? {
        guard let first else { return second }
        guard let second else { return first }
        let messages = currentConversation.messages
        guard let firstIndex = messages.firstIndex(where: { $0.id == first }) else {
            return second
        }
        guard let secondIndex = messages.firstIndex(where: { $0.id == second }) else {
            return first
        }
        return secondIndex > firstIndex ? second : first
    }

    private func monotonicMarker(
        currentId: String?,
        currentTimestamp: String?,
        incomingId: String?,
        incomingTimestamp: String?
    ) -> (id: String?, timestamp: String?) {
        let currentDate = ChatTimestamp.date(currentTimestamp)
        let incomingDate = ChatTimestamp.date(incomingTimestamp)
        if let incomingDate {
            if let currentDate {
                if incomingDate < currentDate {
                    return (currentId, currentTimestamp)
                }
                if incomingDate > currentDate {
                    return (incomingId ?? currentId, incomingTimestamp)
                }
            } else {
                return (incomingId ?? currentId, incomingTimestamp)
            }
        }
        let id = laterMarker(currentId, incomingId)
        let timestamp = id == incomingId
            ? incomingTimestamp ?? currentTimestamp
            : currentTimestamp
        return (id, timestamp)
    }

    private func latestIncomingMessageId() -> String? {
        currentConversation.messages.last { $0.senderId != currentUserId }?.id
    }

    private func makeRequest(
        _ payload: ChatSendPayload,
        clientRequestId: String
    ) -> SendChatMessageRequest {
        let media: (ChatGif?, String?) = switch payload.selection {
        case .none: (nil, nil)
        case .gif(let gif, _): (gif, nil)
        case .sticker(let sticker): (nil, sticker.id)
        }
        return SendChatMessageRequest(
            conversationId: conversationId,
            body: payload.body,
            clientRequestId: clientRequestId,
            replyToMessageId: currentConversation.composer.replyTargetId,
            attachmentIds: payload.attachmentIds,
            gif: media.0,
            stickerId: media.1
        )
    }

    private func optimisticMessage(
        _ payload: ChatSendPayload,
        requestId: String,
        replyToMessageId: String?
    ) -> ChatMessageState {
        let gif: ChatStateGif?
        let stickerId: String?
        switch payload.selection {
        case .none:
            gif = nil
            stickerId = nil
        case .gif(let value, _):
            gif = ChatStateGif(
                provider: value.provider.rawValue,
                providerId: value.providerId,
                title: value.title,
                description: value.description,
                sourceUrl: value.sourceUrl.absoluteString,
                posterUrl: value.posterUrl.absoluteString,
                previewUrl: value.previewUrl.absoluteString,
                mediaUrl: value.mediaUrl.absoluteString,
                width: value.width,
                height: value.height
            )
            stickerId = nil
        case .sticker(let value):
            gif = nil
            stickerId = value.id
        }
        let attachments = payload.optimisticAttachments.map { attachment in
            ChatStateAttachment(
                id: attachment.id,
                kind: attachment.kind.rawValue,
                originalName: attachment.originalName,
                mimeType: attachment.mimeType,
                byteSize: attachment.byteSize,
                width: attachment.width,
                height: attachment.height,
                thumbnailPath: attachment.thumbnailPath,
                displayPath: attachment.displayPath,
                thumbnailUrl: attachment.localPreviewUrl?.absoluteString
                    ?? attachment.thumbnailUrl?.absoluteString,
                displayUrl: attachment.localPreviewUrl?.absoluteString
                    ?? attachment.displayUrl?.absoluteString
            )
        }
        return ChatMessageState(
            id: "pending-\(requestId)",
            conversationId: conversationId,
            senderId: currentUserId,
            senderRole: currentUserRole,
            senderDisplayName: currentUserName,
            body: payload.body,
            gif: gif,
            stickerId: stickerId,
            attachments: attachments,
            images: attachments,
            clientRequestId: requestId,
            createdAt: ChatTimestamp.string(now()),
            replyToMessageId: replyToMessageId,
            reactions: [],
            localStatus: .sending
        )
    }

    private func clearComposerAfterSend() {
        typingIdleTask?.cancel()
        typingVersion += 1
        Task { await subscription?.sendTyping(false) }
        draft = ""
        selection = .none
        reduce(.clearComposer(conversationId: conversationId))
        draftBeforeEdit = nil
    }

    private func presentationMessages(_ conversation: ChatConversationState) -> [MessageUiModel] {
        let participantRead = conversation.readStates.first { $0.userId == participantId }
        return conversation.messages.map { message in
            let outgoing = message.senderId == currentUserId
            let delivery: MessageDeliveryStatus? = if outgoing {
                switch message.localStatus {
                case .sending, .pending: .sending
                case .failed: .failed
                case .sent, .none:
                    switch ChatSelectors.getOutgoingMessageStatus(
                        message,
                        messages: conversation.messages,
                        participantReadState: participantRead
                    ) {
                    case .sent: .sent
                    case .delivered: .delivered
                    case .read: .read
                    }
                }
            } else { nil }
            let reply = message.replyToMessageId.flatMap { targetId in
                conversation.messages.first { $0.id == targetId }
            }.map {
                let preview = ChatSelectors.toReplyPreview(
                    $0,
                    currentUserId: currentUserId,
                    participantName: participantName,
                    currentUserName: currentUserName
                )
                return MessageReplyPreviewUiModel(
                    messageId: preview.id,
                    authorName: preview.authorName,
                    snippet: preview.snippet
                )
            }
            let deleted = message.deletedAt != nil
            return MessageUiModel(
                id: message.id,
                direction: outgoing ? .outgoing : .incoming,
                senderId: message.senderId,
                senderName: outgoing
                    ? currentUserName
                    : message.senderDisplayName ?? participantName,
                body: deleted ? "Message deleted" : message.body,
                media: deleted ? nil : media(message),
                attachments: deleted ? [] : (message.attachments ?? message.images ?? []).map {
                    MessageAttachmentUiModel(attachment: $0.domainAttachment)
                },
                sentAt: ChatTimestamp.date(message.createdAt) ?? .distantPast,
                delivery: delivery,
                replyPreview: deleted ? nil : reply,
                reactions: deleted ? [] : (message.reactions ?? []).map {
                    MessageReactionUiModel(emoji: $0.emoji, count: $0.count, byMe: $0.byMe)
                },
                isEdited: message.editedAt != nil,
                isDeleted: deleted
            )
        }
    }

    private func media(_ message: ChatMessageState) -> MessageMedia? {
        if let stickerId = message.stickerId { return .sticker(id: stickerId) }
        guard let gif = message.gif else { return nil }
        guard
            let provider = ChatGifProvider(rawValue: gif.provider),
            let source = URL(string: gif.sourceUrl),
            let poster = URL(string: gif.posterUrl),
            let preview = URL(string: gif.previewUrl),
            let media = URL(string: gif.mediaUrl)
        else { return .gifUnavailable }
        return .gif(ChatGif(
            provider: provider,
            providerId: gif.providerId,
            title: gif.title,
            description: gif.description,
            sourceUrl: source,
            posterUrl: poster,
            previewUrl: preview,
            mediaUrl: media,
            width: gif.width,
            height: gif.height
        ))
    }

    private func unreadMarker(_ conversation: ChatConversationState) -> String? {
        let read = conversation.readStates.first { $0.userId == currentUserId }
        let summary = ChatSelectors.getUnreadMessageSummary(
            conversation.messages,
            currentUserId: currentUserId,
            currentUserReadState: read
        )
        guard summary.count > 0 else { return nil }
        if let marker = read?.lastReadMessageId,
           conversation.messages.contains(where: { $0.id == marker }) {
            return marker
        }
        return TranscriptBuilder.unreadBeforeFirstMarker
    }

    private func composerContext(_ conversation: ChatConversationState) -> ComposerContextUiModel? {
        if conversation.composer.editTargetId != nil { return .edit }
        guard
            let targetId = conversation.composer.replyTargetId,
            let target = conversation.messages.first(where: { $0.id == targetId })
        else { return nil }
        let preview = ChatSelectors.toReplyPreview(
            target,
            currentUserId: currentUserId,
            participantName: participantName,
            currentUserName: currentUserName
        )
        return .reply(authorName: preview.authorName, snippet: preview.snippet)
    }

    private func connectionModel(_ status: RealtimeConnectionState) -> ChatConnectionState {
        switch status {
        case .connected: .connected
        case .connecting: .reconnecting
        case .disconnected: .offline
        case .idle: .connecting
        }
    }

    private func olderModel(_ pagination: ChatPaginationState) -> OlderMessagesState {
        if pagination.isLoadingOlder { return .loading }
        if pagination.hasLoadError { return .failed }
        return pagination.hasMoreOlder ? .idle : .hidden
    }
}

private extension ChatSendPayload {
    var selectionIsCompatibleWithAttachments: Bool {
        attachmentIds.isEmpty || selection == .none
    }
}

private extension ChatStateAttachment {
    var domainAttachment: ChatAttachment {
        ChatAttachment(
            id: id,
            status: status,
            kind: kind == "file" ? .file : .image,
            originalName: originalName,
            mimeType: mimeType,
            byteSize: byteSize,
            width: width,
            height: height,
            thumbnailPath: thumbnailPath,
            displayPath: displayPath,
            thumbnailUrl: thumbnailUrl.flatMap(URL.init(string:)),
            displayUrl: displayUrl.flatMap(URL.init(string:))
        )
    }
}
