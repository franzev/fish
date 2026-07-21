import Foundation
import Testing
@testable import ChatData

@Suite("Chat notification reply persistence")
struct ChatNotificationReplyStoreTests {
    @Test func queuesSortsAndRemovesReplies() async throws {
        let root = try temporaryRoot()
        let store = FileChatNotificationReplyStore(rootURL: root)
        let older = ChatNotificationReply(
            id: "older",
            conversationId: "conversation-a",
            body: "First",
            createdAt: Date(timeIntervalSince1970: 10)
        )
        let newer = ChatNotificationReply(
            id: "newer",
            conversationId: "conversation-b",
            body: "Second",
            createdAt: Date(timeIntervalSince1970: 20)
        )

        try await store.enqueue(newer)
        try await store.enqueue(older)

        #expect(try await store.pendingReplies() == [older, newer])
        try await store.remove(id: older.id)
        #expect(try await store.pendingReplies() == [newer])
    }

    @Test func removeAllClearsTheDurableInbox() async throws {
        let root = try temporaryRoot()
        let store = FileChatNotificationReplyStore(rootURL: root)
        try await store.enqueue(
            ChatNotificationReply(
                conversationId: "conversation-a",
                body: "Keep this until sign out"
            )
        )

        try await store.removeAll()

        #expect(try await store.pendingReplies().isEmpty)
    }

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-notification-replies-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
