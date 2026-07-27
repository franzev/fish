import Foundation

#if canImport(CryptoKit)
import CryptoKit
#endif

/// Small, atomic, account-scoped cache store, modelled on
/// `FileChatDraftStore`. Presentation continuity only: a read that fails or
/// finds nothing returns an empty result rather than throwing.
public actor FileChatCacheStore: ChatDirectoryCaching {
    private let fileURL: URL
    private var conversationsCache: [ChatConversationPreview]?

    public init(accountId: String, rootURL: URL? = nil) {
        let root = rootURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("FISH", isDirectory: true)
        self.fileURL = root
            .appendingPathComponent("cache-\(Self.accountKey(accountId))", isDirectory: true)
            .appendingPathComponent("directory.json")
    }

    public func conversations() async throws -> [ChatConversationPreview] {
        loaded()
    }

    public func save(_ conversations: [ChatConversationPreview]) async throws {
        try persist(conversations)
    }

    public func removeAll() async throws {
        conversationsCache = []
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
    }

    private func loaded() -> [ChatConversationPreview] {
        if let conversationsCache { return conversationsCache }
        let value: [ChatConversationPreview]
        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([ChatConversationPreview].self, from: data) {
            value = decoded
        } else {
            value = []
        }
        conversationsCache = value
        return value
    }

    private func persist(_ value: [ChatConversationPreview]) throws {
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
        conversationsCache = value
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
