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
    case callActivity(CallActivityUiModel)

    public var id: String {
        switch self {
        case .daySeparator(let id, _): id
        case .unreadDivider(let id): id
        case .message(let row): row.id
        case .callActivity(let activity): activity.id
        }
    }
}

public enum TranscriptBuilder {
    public static let unreadBeforeFirstMarker = "__fish_before_first__"
    /// Messages are accepted oldest to newest. Ordering is a store contract;
    /// the presentation layer does not silently repair it.
    public static func build(
        messages: [MessageUiModel],
        callActivities: [CallActivityUiModel] = [],
        unreadAfterMessageId: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date(),
        locale: Locale = .current
    ) -> [TranscriptItem] {
        var items: [TranscriptItem] = []
        items.reserveCapacity(messages.count + callActivities.count + 4)
        let lastOutgoingId = messages.last {
            $0.direction == .outgoing
        }?.id

        let timeline = (messages.enumerated().map { index, message in
            TimelineElement.message(index: index, value: message)
        } + callActivities.map { TimelineElement.call($0) })
            .sorted {
                if $0.date != $1.date { return $0.date < $1.date }
                return $0.order < $1.order
            }
        var previousDate: Date?

        for (timelineIndex, element) in timeline.enumerated() {
            guard case .message(let index, let message) = element else {
                if let activity = element.activity {
                    let startsNewDay = previousDate.map {
                        !calendar.isDate($0, inSameDayAs: activity.occurredAt)
                    } ?? true
                    if startsNewDay {
                        items.append(.daySeparator(
                            id: "day-\(activity.id)",
                            label: ChatDayLabel.format(
                                activity.occurredAt,
                                now: now,
                                calendar: calendar,
                                locale: locale
                            )
                        ))
                    }
                    items.append(.callActivity(activity))
                    previousDate = activity.occurredAt
                }
                continue
            }
            // A call activity is a deliberate visual break in the transcript.
            // Only adjacent message elements can belong to the same bubble group.
            let previous: MessageUiModel? = if timelineIndex > 0 {
                if case .message(_, let value) = timeline[timelineIndex - 1] {
                    value
                } else {
                    nil
                }
            } else {
                nil
            }
            let next: MessageUiModel? = if timelineIndex + 1 < timeline.count {
                if case .message(_, let value) = timeline[timelineIndex + 1] {
                    value
                } else {
                    nil
                }
            } else {
                nil
            }

            let startsNewDay = previousDate.map {
                !calendar.isDate($0, inSameDayAs: message.sentAt)
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
            if unreadAfterMessageId == unreadBeforeFirstMarker,
               index == 0 {
                items.append(.unreadDivider(id: "unread-divider"))
            } else if let unreadAfterMessageId, previous?.id == unreadAfterMessageId {
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
            previousDate = message.sentAt
        }
        return items
    }
}

private enum TimelineElement {
    case message(index: Int, value: MessageUiModel)
    case call(CallActivityUiModel)

    var date: Date {
        switch self {
        case .message(_, let value): value.sentAt
        case .call(let value): value.occurredAt
        }
    }

    var order: Int {
        switch self {
        case .message: 0
        case .call: 1
        }
    }

    var activity: CallActivityUiModel? {
        if case .call(let value) = self { return value }
        return nil
    }
}
