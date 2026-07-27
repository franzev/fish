import Foundation

#if canImport(CryptoKit)
import CryptoKit
#endif

/// Small, atomic, account-scoped cache store, modelled on
/// `FileChatDraftStore`. Presentation continuity only: a read that fails or
/// finds nothing returns an empty or `nil` result rather than throwing.
public actor FileChatCacheStore: ChatDirectoryCaching {
    private let directoryURL: URL
    private var conversationsCache: [ChatConversationPreview]?
    private var windowCache: [String: ChatCachedWindow] = [:]

    public init(accountId: String, rootURL: URL? = nil) {
        let root = rootURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appendingPathComponent("FISH", isDirectory: true)
        self.directoryURL = root.appendingPathComponent(
            "cache-\(Self.hashedKey(accountId))", isDirectory: true
        )
    }

    public func conversations() async throws -> [ChatConversationPreview] {
        loadedConversations()
    }

    public func save(_ conversations: [ChatConversationPreview]) async throws {
        try persist(conversations, to: directoryFileURL)
        conversationsCache = conversations
    }

    public func window(conversationId: String) async throws -> ChatCachedWindow? {
        if let cached = windowCache[conversationId] { return cached }
        guard
            let data = try? Data(contentsOf: transcriptFileURL(conversationId)),
            let decoded = try? JSONDecoder().decode(ChatCachedWindow.self, from: data)
        else { return nil }
        windowCache[conversationId] = decoded
        return decoded
    }

    public func saveWindow(_ window: ChatCachedWindow, conversationId: String) async throws {
        try persist(window, to: transcriptFileURL(conversationId))
        windowCache[conversationId] = window
    }

    public func removeAll() async throws {
        conversationsCache = []
        windowCache = [:]
        try? FileManager.default.removeItem(at: directoryURL)
    }

    private var directoryFileURL: URL {
        directoryURL.appendingPathComponent("directory.json")
    }

    private func transcriptFileURL(_ conversationId: String) -> URL {
        directoryURL.appendingPathComponent(
            "transcript-\(Self.hashedKey(conversationId)).json"
        )
    }

    private func loadedConversations() -> [ChatConversationPreview] {
        if let conversationsCache { return conversationsCache }
        let value: [ChatConversationPreview]
        if let data = try? Data(contentsOf: directoryFileURL),
           let decoded = try? JSONDecoder().decode([ChatConversationPreview].self, from: data) {
            value = decoded
        } else {
            value = []
        }
        conversationsCache = value
        return value
    }

    private func persist(_ value: some Encodable, to url: URL) throws {
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(value)
        try data.write(to: url, options: [.atomic])
        #if os(iOS)
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUnlessOpen],
            ofItemAtPath: url.path
        )
        #endif
    }

    private static func hashedKey(_ value: String) -> String {
        #if canImport(CryptoKit)
        let digest = SHA256.hash(data: Data(value.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
        #else
        return String(value.hashValue, radix: 16)
        #endif
    }
}
