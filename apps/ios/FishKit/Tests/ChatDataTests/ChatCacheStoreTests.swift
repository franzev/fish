import ChatCore
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

    @Test func roundTripsATranscriptWindow() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)
        let window = transcriptWindow()

        try await store.saveWindow(window, conversationId: "c1")

        #expect(try await store.window(conversationId: "c1") == window)
    }

    @Test func missingWindowReturnsNil() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)

        #expect(try await store.window(conversationId: "c1") == nil)
    }

    @Test func windowsAreScopedPerConversation() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)

        try await store.saveWindow(transcriptWindow(), conversationId: "c1")

        #expect(try await store.window(conversationId: "c2") == nil)
    }

    @Test func removeAllClearsWindowsToo() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)
        try await store.saveWindow(transcriptWindow(), conversationId: "c1")

        try await store.removeAll()

        #expect(try await store.window(conversationId: "c1") == nil)
    }

    @Test func corruptWindowPayloadFailsSoftly() async throws {
        let root = try temporaryRoot()
        let store = FileChatCacheStore(accountId: "account-a", rootURL: root)
        try await store.saveWindow(transcriptWindow(), conversationId: "c1")

        let accountDirectory = try #require(
            FileManager.default.contentsOfDirectory(
                at: root,
                includingPropertiesForKeys: nil
            ).first
        )
        let transcriptFile = try #require(
            FileManager.default.contentsOfDirectory(
                at: accountDirectory,
                includingPropertiesForKeys: nil
            ).first
        )
        try Data("not json".utf8).write(to: transcriptFile)

        let reloaded = FileChatCacheStore(accountId: "account-a", rootURL: root)
        #expect(try await reloaded.window(conversationId: "c1") == nil)
    }

    private func transcriptWindow() -> ChatCachedWindow {
        ChatCachedWindow(
            messages: [
                ChatMessageState(
                    id: "m1",
                    conversationId: "c1",
                    senderId: "them",
                    senderRole: .coach,
                    body: "Hello",
                    clientRequestId: "r-m1",
                    createdAt: ChatTimestamp.string(Date(timeIntervalSince1970: 100))
                ),
            ],
            readStates: [
                ChatReadState(
                    userId: "me",
                    lastDeliveredMessageId: "m1",
                    deliveredAt: ChatTimestamp.string(Date(timeIntervalSince1970: 100)),
                    lastReadMessageId: nil,
                    readAt: nil
                ),
            ],
            hasMoreOlder: true,
            oldestCursor: ChatMessageCursor(
                createdAt: ChatTimestamp.string(Date(timeIntervalSince1970: 100)),
                id: "m1"
            )
        )
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
