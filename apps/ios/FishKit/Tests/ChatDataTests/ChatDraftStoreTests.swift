import Foundation
import Testing
@testable import ChatData

@Suite("Chat draft persistence")
struct ChatDraftStoreTests {
    @Test func savesAndRestoresUnicodeComposerText() async throws {
        let root = try temporaryRoot()
        let store = FileChatDraftStore(accountId: "account-a", rootURL: root)
        let body = "  I’ll send this later 🌊\n"

        try await store.saveDraft(body, conversationId: "conversation-a")

        let restored = try await store.draft(for: "conversation-a")
        #expect(restored?.body == body)
        #expect(restored?.conversationId == "conversation-a")
    }

    @Test func accountFilesAreIsolated() async throws {
        let root = try temporaryRoot()
        let first = FileChatDraftStore(accountId: "account-a", rootURL: root)
        let second = FileChatDraftStore(accountId: "account-b", rootURL: root)

        try await first.saveDraft("private draft", conversationId: "conversation-a")

        #expect(try await second.drafts(for: ["conversation-a"]).isEmpty)
        #expect(try await first.drafts(for: ["conversation-a"]).count == 1)
    }

    @Test func emptyBodyRemovesDraftAndRemoveAllClearsFile() async throws {
        let root = try temporaryRoot()
        let store = FileChatDraftStore(accountId: "account-a", rootURL: root)

        try await store.saveDraft("draft", conversationId: "conversation-a")
        try await store.saveDraft("", conversationId: "conversation-a")
        #expect(try await store.draft(for: "conversation-a") == nil)

        try await store.saveDraft("another", conversationId: "conversation-b")
        try await store.removeAllDrafts()
        #expect(try await store.drafts(for: ["conversation-b"]).isEmpty)
    }

    @Test func corruptPayloadFailsSoftly() async throws {
        let root = try temporaryRoot()
        let store = FileChatDraftStore(accountId: "account-a", rootURL: root)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

        try await store.saveDraft("draft", conversationId: "conversation-a")
        let file = try #require(
            FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
                .first
        )
        try Data("not json".utf8).write(to: file)

        let reloaded = FileChatDraftStore(accountId: "account-a", rootURL: root)
        #expect(try await reloaded.drafts(for: ["conversation-a"]).isEmpty)
    }

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-chat-drafts-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
