import Foundation

public enum MessageGroupPosition: Sendable, Equatable {
    case solo
    case first
    case middle
    case last
}

public struct MessageRowUiModel: Identifiable, Equatable, Sendable {
    public let message: MessageUiModel
    public let groupPosition: MessageGroupPosition
    public let showsMeta: Bool
    public let showsDeliveryStatus: Bool

    public var id: String { message.id }

    public init(
        message: MessageUiModel,
        groupPosition: MessageGroupPosition,
        showsMeta: Bool,
        showsDeliveryStatus: Bool
    ) {
        self.message = message
        self.groupPosition = groupPosition
        self.showsMeta = showsMeta
        self.showsDeliveryStatus = showsDeliveryStatus
    }
}

public enum TranscriptItem: Identifiable, Equatable, Sendable {
    case daySeparator(id: String, label: String)
    case unreadDivider(id: String)
    case message(MessageRowUiModel)

    public var id: String {
        switch self {
        case .daySeparator(let id, _): id
        case .unreadDivider(let id): id
        case .message(let row): row.id
        }
    }
}

public enum TranscriptBuilder {
    /// Messages are accepted oldest to newest. Ordering is a store contract;
    /// the presentation layer does not silently repair it.
    public static func build(
        messages: [MessageUiModel],
        unreadAfterMessageId: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date(),
        locale: Locale = .current
    ) -> [TranscriptItem] {
        var items: [TranscriptItem] = []
        items.reserveCapacity(messages.count + 4)
        let lastOutgoingId = messages.last {
            $0.direction == .outgoing
        }?.id

        for (index, message) in messages.enumerated() {
            let previous = index > 0 ? messages[index - 1] : nil
            let next = index + 1 < messages.count ? messages[index + 1] : nil

            let startsNewDay = previous.map {
                !calendar.isDate($0.sentAt, inSameDayAs: message.sentAt)
            } ?? true
            if startsNewDay {
                items.append(.daySeparator(
                    id: "day-\(message.id)",
                    label: ChatDayLabel.format(
                        message.sentAt,
                        now: now,
                        calendar: calendar,
                        locale: locale
                    )
                ))
            }
            if let unreadAfterMessageId, previous?.id == unreadAfterMessageId {
                items.append(.unreadDivider(id: "unread-divider"))
            }

            let previousMatches = MessageGrouping.belongsToSameGroup(
                previous: previous,
                current: message,
                calendar: calendar
            )
            let nextMatches = next.map {
                MessageGrouping.belongsToSameGroup(
                    previous: message,
                    current: $0,
                    calendar: calendar
                )
            } ?? false
            let position: MessageGroupPosition = switch (
                previousMatches,
                nextMatches
            ) {
            case (false, false): .solo
            case (false, true): .first
            case (true, true): .middle
            case (true, false): .last
            }

            items.append(.message(MessageRowUiModel(
                message: message,
                groupPosition: position,
                showsMeta: !previousMatches,
                showsDeliveryStatus: message.id == lastOutgoingId
            )))
        }
        return items
    }
}
