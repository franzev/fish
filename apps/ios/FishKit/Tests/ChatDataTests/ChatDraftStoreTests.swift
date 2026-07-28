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

    @Test func pendingAttachmentsRoundTripReplaceAndRemoveByItemId() async throws {
        let root = try temporaryRoot()
        let store = FileChatDraftStore(accountId: "account-a", rootURL: root)
        let record = ChatPendingAttachment(
            conversationId: "conversation-a",
            itemId: "item-1",
            clientUploadId: "upload-1",
            stagedFileName: "abc.jpg",
            originalName: "Photo.jpg",
            sourceMimeType: "image/jpeg",
            uploadMimeType: "image/jpeg",
            sourceByteSize: 120,
            uploadByteSize: 90,
            width: 10,
            height: 8,
            sha256: String(repeating: "a", count: 64)
        )

        try await store.savePendingAttachment(record)
        var updated = record
        updated.serverAttachmentId = "server-1"
        try await store.savePendingAttachment(updated)

        let reloaded = FileChatDraftStore(accountId: "account-a", rootURL: root)
        let restored = try await reloaded.pendingAttachments()
        #expect(restored.count == 1)
        #expect(restored.first?.serverAttachmentId == "server-1")
        #expect(restored.first?.stagedFileName == "abc.jpg")

        try await reloaded.removePendingAttachment(itemId: "item-1")
        #expect(try await reloaded.pendingAttachments().isEmpty)
    }

    @Test func payloadsWrittenBeforePendingAttachmentsStillDecode() async throws {
        let root = try temporaryRoot()
        let store = FileChatDraftStore(accountId: "account-a", rootURL: root)
        try await store.saveDraft("draft", conversationId: "conversation-a")
        let file = try #require(
            FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
                .first
        )
        // Rewrite the payload in the shape older builds produced.
        let legacy = try JSONSerialization.jsonObject(
            with: Data(contentsOf: file)
        ) as! [String: Any]
        let trimmed = legacy.filter { $0.key != "pendingAttachments" }
        try JSONSerialization.data(withJSONObject: trimmed).write(to: file)

        let reloaded = FileChatDraftStore(accountId: "account-a", rootURL: root)
        #expect(try await reloaded.draft(for: "conversation-a")?.body == "draft")
        #expect(try await reloaded.pendingAttachments().isEmpty)
    }

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("fish-chat-drafts-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
