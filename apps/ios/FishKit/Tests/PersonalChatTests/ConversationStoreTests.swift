import ChatCore
import ChatData
import Foundation
import PersonalChat
import Testing

private actor StoreMessaging: ChatMessagingProviding {
    enum OlderResult: Sendable {
        case success(ChatMessagePage)
        case failure
    }

    var window: ChatNewestWindow
    var olderPages: [OlderResult] = []
    var backfills: [ChatBackfillPage] = []
    var messagesById: [String: ChatMessage] = [:]
    var sendFailures = 0
    var nextSendDelay: Duration?
    var sent: [SendChatMessageRequest] = []

    init(window: ChatNewestWindow) {
        self.window = window
        messagesById = Dictionary(uniqueKeysWithValues: window.messages.map { ($0.id, $0) })
    }

    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage {
        sent.append(request)
        if let delay = nextSendDelay {
            nextSendDelay = nil
            try await Task.sleep(for: delay)
        }
        if sendFailures > 0 {
            sendFailures -= 1
            throw ChatCommandFailure.sendUnavailable
        }
        return ChatMessage(
            id: "sent-\(request.clientRequestId)",
            conversationId: request.conversationId,
            senderId: "me",
            senderRole: "client",
            body: request.body,
            clientRequestId: request.clientRequestId,
            createdAt: Date(timeIntervalSince1970: 200),
            replyToMessageId: request.replyToMessageId,
            gif: request.gif,
            stickerId: request.stickerId
        )
    }

    func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit: Int
    ) async throws -> ChatMessagePage {
        guard !olderPages.isEmpty else {
            return ChatMessagePage(messages: [], hasMoreOlder: false, oldestCursor: nil)
        }
        switch olderPages.removeFirst() {
        case .success(let page): return page
        case .failure: throw StoreTestFailure()
        }
    }

    func newestWindow(conversationId: String, limit: Int) async throws -> ChatNewestWindow {
        window
    }

    func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit: Int
    ) async throws -> ChatBackfillPage {
        backfills.isEmpty
            ? ChatBackfillPage(messages: [], needsReset: false)
            : backfills.removeFirst()
    }

    func messages(ids: [String]) async throws -> [ChatMessage] {
        ids.compactMap { messagesById[$0] }
    }

    func failNextSends(_ count: Int) { sendFailures = count }
    func delayNextSend(_ duration: Duration) { nextSendDelay = duration }
    func setOlder(_ values: [OlderResult]) { olderPages = values }
    func setBackfills(_ values: [ChatBackfillPage]) { backfills = values }
    func setWindow(_ value: ChatNewestWindow) {
        window = value
        for message in value.messages { messagesById[message.id] = message }
    }
    func put(_ message: ChatMessage) { messagesById[message.id] = message }
    func requests() -> [SendChatMessageRequest] { sent }
}

private actor StoreCommands: ChatCommandProviding {
    struct ReadRequest: Sendable, Equatable {
        let delivered: String?
        let read: String?
    }

    var nextFailure: ChatCommandFailure?
    var executed: [ChatMessageCommand] = []
    var reads: [ReadRequest] = []
    var reports: [String] = []

    func execute(_ command: ChatMessageCommand) async throws -> ChatMessage {
        executed.append(command)
        if let failure = nextFailure {
            nextFailure = nil
            throw failure
        }
        switch command {
        case .edit(let id, let body):
            return message(id, body: body, editedAt: Date(timeIntervalSince1970: 300))
        case .delete(let id):
            return message(id, body: "", deletedAt: Date(timeIntervalSince1970: 300))
        case .toggleReaction(let id, let emoji):
            return message(id, body: "Hello", reactions: [ChatReaction(
                emoji: emoji,
                count: 1,
                byMe: true
            )])
        }
    }

    func reportGif(messageId: String) async throws {
        reports.append(messageId)
        if let failure = nextFailure {
            nextFailure = nil
            throw failure
        }
    }

    func markReadState(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?
    ) async throws -> ChatReadState {
        reads.append(ReadRequest(delivered: lastDeliveredMessageId, read: lastReadMessageId))
        return ChatReadState(
            userId: "me",
            lastDeliveredMessageId: lastDeliveredMessageId,
            deliveredAt: lastDeliveredMessageId == nil ? nil : "2026-07-18T00:00:10.000Z",
            lastReadMessageId: lastReadMessageId,
            readAt: lastReadMessageId == nil ? nil : "2026-07-18T00:00:10.000Z"
        )
    }

    func unreadSummary(conversationId: String) async throws -> ChatUnreadSummary {
        ChatUnreadSummary(count: 0, oldestUnreadAt: nil, latestUnreadMessageId: nil)
    }

    func failNext(_ failure: ChatCommandFailure = .unavailable) { nextFailure = failure }
    func readRequests() -> [ReadRequest] { reads }
    func commands() -> [ChatMessageCommand] { executed }

    private func message(
        _ id: String,
        body: String,
        editedAt: Date? = nil,
        deletedAt: Date? = nil,
        reactions: [ChatReaction] = []
    ) -> ChatMessage {
        ChatMessage(
            id: id,
            conversationId: "c1",
            senderId: "me",
            senderRole: "client",
            body: body,
            clientRequestId: "r-\(id)",
            createdAt: Date(timeIntervalSince1970: 100),
            editedAt: editedAt,
            deletedAt: deletedAt,
            reactions: reactions
        )
    }
}

private final class StoreRealtime: ChatRealtimeProviding, @unchecked Sendable {
    private let eventStream = AsyncStream<ChatRealtimeEvent>.makeStream(
        bufferingPolicy: .unbounded
    )
    private let connectionStream = AsyncStream<ChatRealtimeConnection>.makeStream(
        bufferingPolicy: .unbounded
    )
    private let lock = NSLock()
    private var typingValues: [Bool] = []

    func subscribe(conversationId: String, currentUserId: String) -> ChatRealtimeSubscription {
        ChatRealtimeSubscription(
            events: eventStream.stream,
            connections: connectionStream.stream,
            sendTyping: { [weak self] value in
                self?.lock.withLock { self?.typingValues.append(value) }
            },
            cancel: {}
        )
    }

    func event(_ value: ChatRealtimeEvent) { eventStream.continuation.yield(value) }
    func connection(_ value: ChatRealtimeConnection) { connectionStream.continuation.yield(value) }
    var typing: [Bool] { lock.withLock { typingValues } }
}

private final class StoreDirectory: ConversationDirectoryProviding, @unchecked Sendable {
    private let stream = AsyncStream<String>.makeStream(bufferingPolicy: .unbounded)
    private let lock = NSLock()
    private var values: [[ChatConversationPreview]]
    private var callCount = 0

    init(values: [[ChatConversationPreview]]) {
        self.values = values
    }

    func conversations() async throws -> [ChatConversationPreview] {
        lock.withLock {
            defer { callCount += 1 }
            return values[min(callCount, values.count - 1)]
        }
    }

    func navigationAttention() async throws -> [ChatNavigationAttention] { [] }

    func attentionEvents(conversationIds: [String]) -> AsyncStream<String> {
        stream.stream
    }

    func attention(_ conversationId: String) {
        stream.continuation.yield(conversationId)
    }

    var calls: Int { lock.withLock { callCount } }
}

private actor StoreSleeper {
    private var continuations: [CheckedContinuation<Void, Never>] = []

    func sleep(_ duration: Duration) async throws {
        await withCheckedContinuation { continuations.append($0) }
    }

    func resumeAll() {
        let values = continuations
        continuations.removeAll()
        values.forEach { $0.resume() }
    }
}

private struct StoreTestFailure: Error {}

private func storeMessage(
    _ id: String,
    sender: String,
    body: String = "Hello",
    at seconds: TimeInterval,
    gif: ChatGif? = nil
) -> ChatMessage {
    ChatMessage(
        id: id,
        conversationId: "c1",
        senderId: sender,
        senderRole: sender == "me" ? "client" : "coach",
        body: body,
        clientRequestId: "r-\(id)",
        createdAt: Date(timeIntervalSince1970: seconds),
        gif: gif
    )
}

private func storeWindow(
    _ messages: [ChatMessage],
    reads: [ChatReadState] = [],
    hasMore: Bool = false
) -> ChatNewestWindow {
    ChatNewestWindow(
        messages: messages,
        readStates: reads,
        hasMoreOlder: hasMore,
        oldestCursor: messages.first.map {
            ChatMessageCursor(createdAt: ChatTimestamp.string($0.createdAt), id: $0.id)
        }
    )
}

@MainActor
private func makeStore(
    window: ChatNewestWindow,
    sleeper: StoreSleeper? = nil
) -> (ConversationStore, StoreMessaging, StoreCommands, StoreRealtime) {
    let messaging = StoreMessaging(window: window)
    let commands = StoreCommands()
    let realtime = StoreRealtime()
    let store = ConversationStore(
        conversationId: "c1",
        currentUserId: "me",
        participantId: "them",
        participantName: "Coach Mina",
        messaging: messaging,
        commands: commands,
        realtime: realtime,
        now: { Date(timeIntervalSince1970: 400) },
        sleep: { duration in
            if let sleeper { try await sleeper.sleep(duration) }
        }
    )
    return (store, messaging, commands, realtime)
}

@MainActor
private func eventually(
    _ condition: @escaping @MainActor () -> Bool
) async -> Bool {
    for _ in 0..<100 {
        if condition() { return true }
        try? await Task.sleep(for: .milliseconds(10))
    }
    return condition()
}

@Suite(.serialized)
@MainActor
struct ConversationStoreTests {
    @Test func hydrateReceiveEnrichDeliverAndReadWithoutDuplicates() async throws {
        let first = storeMessage("m1", sender: "them", at: 100)
        let (store, messaging, commands, realtime) = makeStore(window: storeWindow([first]))
        await store.start()
        #expect(store.model.phase == .ready)
        #expect(store.model.messages.map(\.id) == ["m1"])
        #expect(store.model.unreadAfterMessageId == TranscriptBuilder.unreadBeforeFirstMarker)

        let second = storeMessage("m2", sender: "them", body: "New", at: 200)
        await messaging.put(second)
        realtime.event(.messageChanged(second))
        realtime.event(.messageChanged(second))
        #expect(await eventually { store.model.messages.map(\.id) == ["m1", "m2"] })

        store.visibleMessage("m2")
        #expect(await eventually { store.model.unreadAfterMessageId == nil })
        #expect(await commands.readRequests().contains { $0.read == "m2" })
        store.stop()
    }

    @Test func newerOutOfWindowReadMarkerSurvivesMessageReadRace() async {
        let first = storeMessage("m1", sender: "me", at: 100)
        let initialRead = ChatReadState(
            userId: "them",
            lastDeliveredMessageId: "m0",
            deliveredAt: "2026-07-18T00:00:01.000Z",
            lastReadMessageId: "m0",
            readAt: "2026-07-18T00:00:01.000Z"
        )
        let (store, messaging, _, realtime) = makeStore(
            window: storeWindow([first], reads: [initialRead])
        )
        await store.start()

        realtime.event(.readStateChanged(ChatReadState(
            userId: "them",
            lastDeliveredMessageId: "m2",
            deliveredAt: "2026-07-18T00:00:20.000Z",
            lastReadMessageId: "m2",
            readAt: "2026-07-18T00:00:20.000Z"
        )))
        let second = storeMessage("m2", sender: "me", at: 200)
        await messaging.put(second)
        realtime.event(.messageChanged(second))

        #expect(await eventually {
            store.model.messages.map(\.delivery) == [.read, .read]
        })
        store.stop()
    }

    @Test func olderPageFailureRequiresManualRetryAndThenMerges() async throws {
        let current = storeMessage("m2", sender: "them", at: 200)
        let older = storeMessage("m1", sender: "them", at: 100)
        let (store, messaging, _, _) = makeStore(window: storeWindow([current], hasMore: true))
        await messaging.setOlder([
            .failure,
            .success(ChatMessagePage(
                messages: [older],
                hasMoreOlder: false,
                oldestCursor: ChatMessageCursor(
                    createdAt: ChatTimestamp.string(older.createdAt),
                    id: older.id
                )
            )),
        ])
        await store.start()
        await store.loadOlder()
        #expect(store.model.olderMessages == .failed)
        #expect(store.model.messages.map(\.id) == ["m2"])
        await store.loadOlder()
        #expect(store.model.olderMessages == .hidden)
        #expect(store.model.messages.map(\.id) == ["m1", "m2"])
        store.stop()
    }

    @Test func failedAttachmentSendRetriesTheExactIdempotencyRequest() async throws {
        let (store, messaging, _, _) = makeStore(window: storeWindow([]))
        await messaging.failNextSends(1)
        await store.start()
        let attachment = ChatAttachment(
            id: "a1",
            kind: .file,
            originalName: "notes.txt",
            displayPath: "c/a1/notes.txt"
        )
        await store.send(ChatSendPayload(
            body: "Notes",
            selection: .none,
            attachmentIds: ["a1"],
            optimisticAttachments: [MessageAttachmentUiModel(
                attachment: attachment,
                isOptimistic: true
            )]
        ))
        let failed = try #require(store.model.messages.first)
        #expect(failed.delivery == .failed)
        #expect(store.draft == "Notes")
        await store.retry(messageId: failed.id)
        let requests = await messaging.requests()
        #expect(requests.count == 2)
        #expect(requests[0].clientRequestId == requests[1].clientRequestId)
        #expect(requests[0].attachmentIds == ["a1"])
        #expect(store.model.messages.count == 1)
        #expect(store.model.messages[0].delivery == .sent)
        store.stop()
    }

    @Test func lateSendFailureCannotRestoreDraftAfterRealtimeConfirmation() async {
        let (store, messaging, _, realtime) = makeStore(window: storeWindow([]))
        await messaging.failNextSends(1)
        await messaging.delayNextSend(.milliseconds(200))
        await store.start()
        let sendTask = Task {
            await store.send(ChatSendPayload(
                body: "Already arrived",
                selection: .none,
                attachmentIds: [],
                optimisticAttachments: []
            ))
        }
        var request: SendChatMessageRequest?
        for _ in 0..<100 where request == nil {
            request = await messaging.requests().first
            if request == nil { try? await Task.sleep(for: .milliseconds(5)) }
        }
        guard let request else {
            Issue.record("Expected the send request")
            return
        }
        let confirmed = ChatMessage(
            id: "server-message",
            conversationId: request.conversationId,
            senderId: "me",
            senderRole: "client",
            body: request.body,
            clientRequestId: request.clientRequestId,
            createdAt: Date(timeIntervalSince1970: 200)
        )
        await messaging.put(confirmed)
        realtime.event(.messageChanged(confirmed))
        #expect(await eventually { store.model.messages.first?.delivery == .sent })

        await sendTask.value

        #expect(store.model.messages.first?.delivery == .sent)
        #expect(store.draft.isEmpty)
        #expect(store.model.notice == nil)
        store.stop()
    }

    @Test func editReactionAndDeleteRollbackConvergeThroughCommands() async throws {
        let own = storeMessage("m1", sender: "me", at: 100)
        let (store, _, commands, _) = makeStore(window: storeWindow([own]))
        await store.start()

        store.perform(.edit("m1"))
        #expect(store.model.composerContext == .edit)
        #expect(store.draft == "Hello")
        await store.send(ChatSendPayload(
            body: "Updated",
            selection: .none,
            attachmentIds: [],
            optimisticAttachments: []
        ))
        #expect(store.model.messages[0].body == "Updated")
        #expect(store.model.messages[0].isEdited)

        store.perform(.toggleReaction(messageId: "m1", emoji: "👍"))
        #expect(await eventually { store.model.messages[0].reactions.first?.byMe == true })

        await commands.failNext()
        store.perform(.delete("m1"))
        #expect(await eventually { store.model.notice != nil })
        #expect(!store.model.messages[0].isDeleted)
        #expect(await commands.commands().contains(.delete(messageId: "m1")))
        store.stop()
    }

    @Test func attachmentOnlyMessagesCannotEnterTextEditing() async {
        let attachmentOnly = storeMessage("m1", sender: "me", body: "", at: 100)
        let (store, _, _, _) = makeStore(window: storeWindow([attachmentOnly]))
        await store.start()

        store.perform(.edit("m1"))

        #expect(store.model.composerContext == nil)
        #expect(store.draft.isEmpty)
        store.stop()
    }

    @Test func failedReactionReconcilesCanonicalServerStateBeforeRollback() async {
        let own = storeMessage("m1", sender: "me", at: 100)
        let (store, messaging, commands, _) = makeStore(window: storeWindow([own]))
        await store.start()
        let canonical = ChatMessage(
            id: own.id,
            conversationId: own.conversationId,
            senderId: own.senderId,
            senderRole: own.senderRole,
            body: own.body,
            clientRequestId: own.clientRequestId,
            createdAt: own.createdAt,
            reactions: [ChatReaction(emoji: "👍", count: 1, byMe: true)]
        )
        await messaging.put(canonical)
        await commands.failNext()

        store.perform(.toggleReaction(messageId: "m1", emoji: "👍"))

        #expect(await eventually { store.model.notice != nil })
        #expect(store.model.messages[0].reactions == [
            MessageReactionUiModel(emoji: "👍", count: 1, byMe: true),
        ])
        store.stop()
    }

    @Test func typingStartsStopsAfterIdleAndRemoteTypingHasWatchdog() async throws {
        let sleeper = StoreSleeper()
        let (store, _, _, realtime) = makeStore(window: storeWindow([]), sleeper: sleeper)
        await store.start()
        store.draft = "Hello"
        #expect(await eventually { realtime.typing == [true] })
        store.composerFocusChanged(false)
        #expect(await eventually { realtime.typing.last == false })
        await sleeper.resumeAll()
        #expect(await eventually { realtime.typing.last == false })

        realtime.event(.typingChanged(userId: "them", typing: true))
        #expect(await eventually { store.model.isParticipantTyping })
        await sleeper.resumeAll()
        #expect(await eventually { !store.model.isParticipantTyping })
        store.stop()
    }

    @Test func reconnectGapBeyondOnePageResetsToNewestWindow() async throws {
        let first = storeMessage("m1", sender: "them", at: 100)
        let newest = storeMessage("m9", sender: "them", at: 900)
        let (store, messaging, _, realtime) = makeStore(window: storeWindow([first]))
        await store.start()
        await messaging.setBackfills([ChatBackfillPage(messages: [], needsReset: true)])
        await messaging.setWindow(storeWindow([newest]))
        realtime.connection(.reconnected)
        #expect(await eventually { store.model.messages.map(\.id) == ["m9"] })
        #expect(store.model.connection == .connected)
        store.stop()
    }

    @Test func oneAuthorizedConversationRoutesDirectlyWithoutAList() {
        let preview = ChatConversationPreview(
            conversationId: "c1",
            participantId: "them",
            participantRole: "coach",
            participantDisplayName: "Coach Mina",
            latestMessageSenderId: nil,
            latestMessageText: "",
            latestMessageCreatedAt: nil,
            unreadCount: 0
        )
        #expect(ConversationRouting.route(for: []) == .empty)
        #expect(ConversationRouting.route(for: [preview]) == .direct(conversationId: "c1"))
        #expect(ConversationRouting.route(for: [preview, preview]) == .list)
    }

    @Test func directoryAttentionCoalescesIntoOneRefresh() async {
        let initial = ChatConversationPreview(
            conversationId: "c1",
            participantId: "them",
            participantRole: "coach",
            participantDisplayName: "Coach Mina",
            latestMessageSenderId: nil,
            latestMessageText: "",
            latestMessageCreatedAt: nil,
            unreadCount: 0
        )
        let updated = ChatConversationPreview(
            conversationId: "c1",
            participantId: "them",
            participantRole: "coach",
            participantDisplayName: "Coach Mina",
            latestMessageSenderId: "them",
            latestMessageText: "A new message",
            latestMessageCreatedAt: Date(timeIntervalSince1970: 200),
            unreadCount: 1
        )
        let directory = StoreDirectory(values: [[initial], [updated]])
        let sleeper = StoreSleeper()
        let store = ConversationDirectoryStore(
            directory: directory,
            sleep: { try await sleeper.sleep($0) }
        )
        await store.start()
        #expect(store.route == .direct(conversationId: "c1"))
        directory.attention("c1")
        directory.attention("c1")
        directory.attention("c1")
        try? await Task.sleep(for: .milliseconds(20))
        await sleeper.resumeAll()
        #expect(await eventually { store.conversations.first?.unreadCount == 1 })
        #expect(directory.calls == 2)
        store.stop()
    }
}
