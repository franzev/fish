import Foundation

/// Flushes durable text sends without requiring a conversation screen to be
/// open. The stored client request id is reused for every attempt so a retry
/// remains idempotent at the server.
public struct ChatTextOutboxFlusher: Sendable {
    private let drafts: any ChatDraftProviding
    private let messaging: any ChatMessagingProviding

    public init(
        drafts: any ChatDraftProviding,
        messaging: any ChatMessagingProviding
    ) {
        self.drafts = drafts
        self.messaging = messaging
    }

    /// Sends text-only rows in creation order per conversation. Attachment
    /// rows remain owned by the live conversation store, which has the upload
    /// resolver needed to turn their local item ids into server ids.
    @discardableResult
    public func flush() async -> Bool {
        guard let pending = try? await drafts.pendingTextSends() else { return false }

        var sentAny = false
        let byConversation = Dictionary(
            grouping: pending.filter { $0.attachmentItemIds.isEmpty },
            by: \.conversationId
        )
        for sends in byConversation.values {
            for item in sends.sorted(by: { $0.createdAt < $1.createdAt }) {
                do {
                    _ = try await messaging.send(
                        SendChatMessageRequest(
                            conversationId: item.conversationId,
                            body: item.body,
                            clientRequestId: item.clientRequestId,
                            replyToMessageId: item.replyToMessageId
                        )
                    )
                    // If this local cleanup fails, the next run repeats the
                    // same idempotent request rather than losing the send.
                    try? await drafts.removePendingTextSend(
                        clientRequestId: item.clientRequestId
                    )
                    sentAny = true
                } catch {
                    // Preserve ordering within a conversation. A later row
                    // may depend on the failed row being accepted first.
                    break
                }
            }
        }
        return sentAny
    }
}
