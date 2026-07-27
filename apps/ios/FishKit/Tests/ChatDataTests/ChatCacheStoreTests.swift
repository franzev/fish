import Foundation
import Testing
@testable import ChatData

@Suite("Chat directory cache persistence")
struct ChatCacheStoreTests {
    @Test func roundTripsTheConversationList() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)
        let previews = [
            preview(id: "c1", unreadCount: 2),
            preview(id: "c2", unreadCount: 0),
        ]

        try await store.save(previews)

        #expect(try await store.conversations() == previews)
    }

    @Test func emptyCacheReturnsNoConversations() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)

        #expect(try await store.conversations().isEmpty)
    }

    @Test func accountFilesAreIsolated() async throws {
        let root = try temporaryRoot()
        let first = FileChatCacheStore(accountId: "account-a", rootURL: root)
        let second = FileChatCacheStore(accountId: "account-b", rootURL: root)

        try await first.save([preview(id: "c1")])

        #expect(try await second.conversations().isEmpty)
        #expect(try await first.conversations().count == 1)
    }

    @Test func removeAllClearsTheCache() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)
        try await store.save([preview(id: "c1")])

        try await store.removeAll()

        #expect(try await store.conversations().isEmpty)
    }

    @Test func corruptPayloadFailsSoftly() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)
        try await store.save([preview(id: "c1")])

        let accountDirectory = try #require(
            FileManager.default.contentsOfDirectory(
                at: root,
                includingPropertiesForKeys: nil
            ).first
        )
        let directoryFile = try #require(
            FileManager.default.contentsOfDirectory(
                at: accountDirectory,
                includingPropertiesForKeys: nil
            ).first
        )
        try Data("not json".utf8).write(to: directoryFile)

        let reloaded = FileChatCacheStore(accountId: "account-a", rootURL: root)
        #expect(try await reloaded.conversations().isEmpty)
    }

    private func preview(
        id: String,
        unreadCount: Int = 0
    ) -> ChatConversationPreview {
        ChatConversationPreview(
            conversationId: id,
            participantId: "them-\(id)",
            participantRole: "coach",
            participantDisplayName: "Coach Mina",
            latestMessageSenderId: "them-\(id)",
            latestMessageText: "Hello",
            latestMessageCreatedAt: Date(timeIntervalSince1970: 200),
            unreadCount: unreadCount
        )
    }

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-chat-cache-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
