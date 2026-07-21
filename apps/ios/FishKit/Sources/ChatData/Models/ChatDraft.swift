import Foundation

public struct ChatDraft: Codable, Equatable, Sendable {
    public let conversationId: String
    public let body: String
    public let updatedAt: Date

    public init(conversationId: String, body: String, updatedAt: Date = Date()) {
        self.conversationId = conversationId
        self.body = body
        self.updatedAt = updatedAt
    }
}

/// A text send that has been accepted by the UI but has not yet been
/// confirmed by the server.
public struct ChatPendingTextSend: Codable, Equatable, Sendable {
    public let conversationId: String
    public let clientRequestId: String
    public let body: String
    public let createdAt: Date

    public init(
        conversationId: String,
        clientRequestId: String,
        body: String,
        createdAt: Date = Date()
    ) {
        self.conversationId = conversationId
        self.clientRequestId = clientRequestId
        self.body = body
        self.createdAt = createdAt
    }
}

/// Local-only composer continuity. Implementations must scope all reads and
/// writes to the account that created them.
public protocol ChatDraftProviding: Sendable {
    func drafts(for conversationIds: [String]) async throws -> [String: ChatDraft]
    func draft(for conversationId: String) async throws -> ChatDraft?
    func saveDraft(_ body: String, conversationId: String) async throws
    func removeDraft(conversationId: String) async throws
    func removeAllDrafts() async throws
    func pendingTextSends() async throws -> [ChatPendingTextSend]
    func savePendingTextSend(_ send: ChatPendingTextSend) async throws
    func removePendingTextSend(clientRequestId: String) async throws
}

public extension ChatDraftProviding {
    func pendingTextSends() async throws -> [ChatPendingTextSend] { [] }
    func savePendingTextSend(_ send: ChatPendingTextSend) async throws {}
    func removePendingTextSend(clientRequestId: String) async throws {}
}
