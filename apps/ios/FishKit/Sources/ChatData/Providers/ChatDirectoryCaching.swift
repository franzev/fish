import Foundation

/// Local-only continuity for the conversation list. Implementations must
/// scope all reads and writes to the account that created them. The cache is
/// never authoritative: a read may return nothing and a write may silently
/// fail without disrupting chat.
public protocol ChatDirectoryCaching: Sendable {
    func conversations() async throws -> [ChatConversationPreview]
    func save(_ conversations: [ChatConversationPreview]) async throws
    func window(conversationId: String) async throws -> ChatCachedWindow?
    func saveWindow(_ window: ChatCachedWindow, conversationId: String) async throws
    func removeAll() async throws
}
