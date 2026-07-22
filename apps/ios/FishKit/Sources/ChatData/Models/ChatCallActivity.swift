import Foundation

/// A completed call rendered inline with the direct-message timeline.
/// This is intentionally separate from messages so unread/search semantics stay
/// message-only while the conversation still preserves what happened.
public struct ChatCallActivity: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let kind: String
    public let status: String
    public let initiatedBy: String
    public let createdAt: Date
    public let connectedAt: Date?
    public let endedAt: Date?
    public let endReason: String?

    public init(
        id: String,
        kind: String,
        status: String,
        initiatedBy: String,
        createdAt: Date,
        connectedAt: Date? = nil,
        endedAt: Date? = nil,
        endReason: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.status = status
        self.initiatedBy = initiatedBy
        self.createdAt = createdAt
        self.connectedAt = connectedAt
        self.endedAt = endedAt
        self.endReason = endReason
    }

    public var occurredAt: Date { endedAt ?? createdAt }

    public var duration: TimeInterval? {
        guard let connectedAt, let endedAt else { return nil }
        let value = endedAt.timeIntervalSince(connectedAt)
        return value >= 0 ? value : nil
    }
}
