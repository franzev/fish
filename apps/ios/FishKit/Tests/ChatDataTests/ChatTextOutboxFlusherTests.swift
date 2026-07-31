import ChatCore
import ChatData
import Foundation
import Testing

private actor OutboxMessaging: ChatMessagingProviding {
    private(set) var requests: [SendChatMessageRequest] = []
    var failuresRemaining = 0

    func send(_ request: SendChatMessageRequest) async throws -> ChatMessage {
        requests.append(request)
        if failuresRemaining > 0 {
            failuresRemaining -= 1
            throw OutboxFailure()
        }
        return ChatMessage(
            id: "server-\(request.clientRequestId)",
            conversationId: request.conversationId,
            senderId: "me",
            senderRole: "client",
            body: request.body,
            clientRequestId: request.clientRequestId,
            createdAt: Date(timeIntervalSince1970: 100)
        )
    }

    func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit: Int
    ) async throws -> ChatMessagePage { fatalError() }

    func newestWindow(conversationId: String, limit: Int) async throws -> ChatNewestWindow {
        fatalError()
    }

    func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit: Int
    ) async throws -> ChatBackfillPage { fatalError() }

    func messages(ids: [String]) async throws -> [ChatMessage] { fatalError() }

    func searchMessages(
        conversationId: String,
        query: String,
        before: ChatMessageSearchCursor?,
        limit: Int
    ) async throws -> ChatMessageSearchPage { fatalError() }

    func sentRequests() -> [SendChatMessageRequest] { requests }
}

private struct OutboxFailure: Error {}

@Suite("Chat text outbox")
struct ChatTextOutboxFlusherTests {
    @Test func flushesTextRowsWithStoredIdsAndLeavesAttachmentRowsForTheScreen() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-outbox-\(UUID().uuidString)", isDirectory: true)
        let drafts = FileChatDraftStore(accountId: "account-a", rootURL: root)
        let first = ChatPendingTextSend(
            conversationId: "conversation-a",
            clientRequestId: "request-1",
            body: "first",
            createdAt: Date(timeIntervalSince1970: 1)
        )
        let second = ChatPendingTextSend(
            conversationId: "conversation-a",
            clientRequestId: "request-2",
            body: "second",
            createdAt: Date(timeIntervalSince1970: 2)
        )
        let attachment = ChatPendingTextSend(
            conversationId: "conversation-a",
            clientRequestId: "request-with-file",
            body: "file",
            attachmentItemIds: ["upload-1"]
        )
        try await drafts.savePendingTextSend(first)
        try await drafts.savePendingTextSend(second)
        try await drafts.savePendingTextSend(attachment)

        let messaging = OutboxMessaging()
        #expect(await ChatTextOutboxFlusher(drafts: drafts, messaging: messaging).flush())
        #expect(await messaging.sentRequests().map(\.clientRequestId) == ["request-1", "request-2"])
        #expect(try await drafts.pendingTextSends() == [attachment])
    }

    @Test func aFailedHeadKeepsLaterRowsQueuedAndRetriesTheSameId() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-outbox-\(UUID().uuidString)", isDirectory: true)
        let drafts = FileChatDraftStore(accountId: "account-a", rootURL: root)
        let first = ChatPendingTextSend(
            conversationId: "conversation-a",
            clientRequestId: "request-1",
            body: "first",
            createdAt: Date(timeIntervalSince1970: 1)
        )
        let second = ChatPendingTextSend(
            conversationId: "conversation-a",
            clientRequestId: "request-2",
            body: "second",
            createdAt: Date(timeIntervalSince1970: 2)
        )
        try await drafts.savePendingTextSend(first)
        try await drafts.savePendingTextSend(second)

        let messaging = OutboxMessaging()
        await messaging.setFailures(1)
        #expect(!(await ChatTextOutboxFlusher(drafts: drafts, messaging: messaging).flush()))
        #expect(await messaging.sentRequests().map(\.clientRequestId) == ["request-1"])
        #expect(try await drafts.pendingTextSends().count == 2)

        #expect(await ChatTextOutboxFlusher(drafts: drafts, messaging: messaging).flush())
        #expect(await messaging.sentRequests().map(\.clientRequestId) == [
            "request-1", "request-1", "request-2"
        ])
        #expect(try await drafts.pendingTextSends().isEmpty)
    }
}

private extension OutboxMessaging {
    func setFailures(_ count: Int) { failuresRemaining = count }
}
