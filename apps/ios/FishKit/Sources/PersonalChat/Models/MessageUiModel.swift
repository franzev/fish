import Foundation

public enum MessageDirection: Sendable, Equatable {
    case incoming
    case outgoing
}

public enum MessageDeliveryStatus: Sendable, Equatable {
    case sending
    case sent
    case delivered
    case read
    case failed
}

/// Provider-free presentation model. Future state and data layers adapt into
/// this value without changing views.
public struct MessageUiModel: Identifiable, Equatable, Sendable {
    public let id: String
    public let direction: MessageDirection
    public let senderId: String
    public let senderName: String
    public let body: String
    public let sentAt: Date
    public let delivery: MessageDeliveryStatus?

    public init(
        id: String,
        direction: MessageDirection,
        senderId: String,
        senderName: String,
        body: String,
        sentAt: Date,
        delivery: MessageDeliveryStatus? = nil
    ) {
        self.id = id
        self.direction = direction
        self.senderId = senderId
        self.senderName = senderName
        self.body = body
        self.sentAt = sentAt
        self.delivery = delivery
    }
}
