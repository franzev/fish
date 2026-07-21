import Foundation

#if canImport(CryptoKit)
import CryptoKit
#endif

/// Small, atomic, account-scoped draft store. Drafts are intentionally kept
/// local: they are private composer state, not chat messages.
public actor FileChatDraftStore: ChatDraftProviding {
    private struct Payload: Codable {
        var drafts: [String: ChatDraft] = [:]
        var pendingTextSends: [String: ChatPendingTextSend] = [:]
    }

    private let fileURL: URL
    private var payload: Payload?

    public init(accountId: String, rootURL: URL? = nil) {
        let root = rootURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("FISH", isDirectory: true)
        self.fileURL = root.appendingPathComponent(
            "drafts-\(Self.accountKey(accountId)).json"
        )
    }

    public func drafts(for conversationIds: [String]) async throws -> [String: ChatDraft] {
        let wanted = Set(conversationIds)
        return try loaded().drafts.filter { wanted.contains($0.key) }
    }

    public func draft(for conversationId: String) async throws -> ChatDraft? {
        try loaded().drafts[conversationId]
    }

    public func saveDraft(_ body: String, conversationId: String) async throws {
        var value = try loaded()
        if body.isEmpty {
            value.drafts[conversationId] = nil
        } else {
            value.drafts[conversationId] = ChatDraft(
                conversationId: conversationId,
                body: body
            )
        }
        try persist(value)
    }

    public func removeDraft(conversationId: String) async throws {
        var value = try loaded()
        value.drafts[conversationId] = nil
        try persist(value)
    }

    public func removeAllDrafts() async throws {
        payload = Payload()
        try? FileManager.default.removeItem(at: fileURL)
    }

    public func pendingTextSends() async throws -> [ChatPendingTextSend] {
        Array(try loaded().pendingTextSends.values)
    }

    public func savePendingTextSend(_ send: ChatPendingTextSend) async throws {
        var value = try loaded()
        value.pendingTextSends[send.clientRequestId] = send
        try persist(value)
    }

    public func removePendingTextSend(clientRequestId: String) async throws {
        var value = try loaded()
        value.pendingTextSends[clientRequestId] = nil
        try persist(value)
    }

    private func loaded() throws -> Payload {
        if let payload { return payload }
        let value: Payload
        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(Payload.self, from: data) {
            value = decoded
        } else {
            value = Payload()
        }
        payload = value
        return value
    }

    private func persist(_ value: Payload) throws {
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(value)
        try data.write(to: fileURL, options: [.atomic])
        #if os(iOS)
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUnlessOpen],
            ofItemAtPath: fileURL.path
        )
        #endif
        payload = value
    }

    private static func accountKey(_ accountId: String) -> String {
        #if canImport(CryptoKit)
        let digest = SHA256.hash(data: Data(accountId.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
        #else
        return String(accountId.hashValue, radix: 16)
        #endif
    }
}
