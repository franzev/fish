import DesignSystem
import Foundation
import Testing
@testable import PersonalChat

private func date(_ value: String) -> Date {
    ISO8601DateFormatter().date(from: value)!
}

private let utc: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    return calendar
}()

private let enUS = Locale(identifier: "en_US")

private func message(
    _ id: String,
    from senderId: String,
    direction: MessageDirection,
    at value: String,
    body: String = "Hello",
    delivery: MessageDeliveryStatus? = nil
) -> MessageUiModel {
    MessageUiModel(
        id: id,
        direction: direction,
        senderId: senderId,
        senderName: senderId == "coach" ? "Sam Rivera" : "You",
        body: body,
        sentAt: date(value),
        delivery: delivery
    )
}

struct GroupingTests {
    @Test func groupsSameSenderWithinGapOnSameDay() {
        let first = message(
            "1",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T10:00:00Z"
        )
        let second = message(
            "2",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T10:04:59Z"
        )
        #expect(MessageGrouping.belongsToSameGroup(
            previous: first,
            current: second,
            calendar: utc
        ))
    }

    @Test func exactFiveMinuteBoundaryStillGroups() {
        let first = message(
            "1",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T10:00:00Z"
        )
        let boundary = message(
            "2",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T10:05:00Z"
        )
        #expect(MessageGrouping.belongsToSameGroup(
            previous: first,
            current: boundary,
            calendar: utc
        ))
    }

    @Test func breaksOnGapSenderDayAndDisorder() {
        let first = message(
            "1",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T10:00:00Z"
        )
        let late = message(
            "2",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T10:05:01Z"
        )
        let other = message(
            "3",
            from: "client",
            direction: .outgoing,
            at: "2026-07-16T10:01:00Z"
        )
        let nextDay = message(
            "4",
            from: "coach",
            direction: .incoming,
            at: "2026-07-17T00:01:00Z"
        )
        let earlier = message(
            "5",
            from: "coach",
            direction: .incoming,
            at: "2026-07-16T09:59:00Z"
        )
        for candidate in [late, other, nextDay, earlier] {
            #expect(!MessageGrouping.belongsToSameGroup(
                previous: first,
                current: candidate,
                calendar: utc
            ))
        }
        #expect(!MessageGrouping.belongsToSameGroup(
            previous: nil,
            current: first,
            calendar: utc
        ))
    }
}

struct DayLabelTests {
    private let now = date("2026-07-16T15:00:00Z")

    @Test func todayYesterdayAndLongDate() {
        #expect(ChatDayLabel.format(
            date("2026-07-16T01:00:00Z"),
            now: now,
            calendar: utc,
            locale: enUS
        ) == "Today")
        #expect(ChatDayLabel.format(
            date("2026-07-15T23:00:00Z"),
            now: now,
            calendar: utc,
            locale: enUS
        ) == "Yesterday")
        #expect(ChatDayLabel.format(
            date("2026-07-01T12:00:00Z"),
            now: now,
            calendar: utc,
            locale: enUS
        ) == "July 1, 2026")
    }
}

struct TranscriptBuilderTests {
    private let now = date("2026-07-16T15:00:00Z")

    private var conversation: [MessageUiModel] {
        [
            message("m1", from: "coach", direction: .incoming, at: "2026-07-15T09:00:00Z"),
            message("m2", from: "coach", direction: .incoming, at: "2026-07-15T09:02:00Z"),
            message("m3", from: "coach", direction: .incoming, at: "2026-07-15T09:03:00Z"),
            message("m4", from: "client", direction: .outgoing, at: "2026-07-16T10:00:00Z", delivery: .read),
            message("m5", from: "client", direction: .outgoing, at: "2026-07-16T10:01:00Z", delivery: .delivered),
        ]
    }

    private func build(_ unreadAfter: String? = nil) -> [TranscriptItem] {
        TranscriptBuilder.build(
            messages: conversation,
            unreadAfterMessageId: unreadAfter,
            calendar: utc,
            now: now,
            locale: enUS
        )
    }

    @Test func insertsDaySeparatorsAtLocalBoundaries() {
        let labels = build().compactMap { item -> String? in
            if case .daySeparator(_, let label) = item { return label }
            return nil
        }
        #expect(labels == ["Yesterday", "Today"])
    }

    @Test func computesGroupPositionsAndMetaVisibility() {
        let rows = build().compactMap { item -> MessageRowUiModel? in
            if case .message(let row) = item { return row }
            return nil
        }
        #expect(rows.map(\.groupPosition) == [
            .first, .middle, .last, .first, .last,
        ])
        #expect(rows.map(\.showsMeta) == [true, false, false, true, false])
    }

    @Test func statusAppearsOnlyOnLatestOutgoingMessage() {
        let rows = build().compactMap { item -> MessageRowUiModel? in
            if case .message(let row) = item { return row }
            return nil
        }
        #expect(rows.map(\.showsDeliveryStatus) == [
            false, false, false, false, true,
        ])
    }

    @Test func unreadDividerFollowsTheMatchedMessageAndNewDayLabel() {
        #expect(build("m3").map(\.id) == [
            "day-m1", "m1", "m2", "m3", "day-m4",
            "unread-divider", "m4", "m5",
        ])
    }

    @Test func emptyAndUnknownUnreadInputsAddNoSyntheticRows() {
        #expect(TranscriptBuilder.build(
            messages: [],
            unreadAfterMessageId: "missing",
            calendar: utc,
            now: now,
            locale: enUS
        ).isEmpty)
        #expect(!build("missing").contains { item in
            if case .unreadDivider = item { return true }
            return false
        })
    }

    @Test func incomingOnlyConversationNeverShowsDeliveryStatus() {
        let items = TranscriptBuilder.build(
            messages: Array(conversation.prefix(3)),
            calendar: utc,
            now: now,
            locale: enUS
        )
        let rows = items.compactMap { item -> MessageRowUiModel? in
            if case .message(let row) = item { return row }
            return nil
        }
        #expect(rows.allSatisfy { !$0.showsDeliveryStatus })
    }
}

struct BubbleShapeTests {
    @Test func connectedCornersTightenTowardNeighbors() {
        let outgoing = BubbleShape.radii(
            direction: .outgoing,
            position: .first
        )
        #expect(outgoing.topTrailing == Radius.chat)
        #expect(outgoing.bottomTrailing == Radius.chatInner)
        #expect(outgoing.topLeading == Radius.chat)

        let incoming = BubbleShape.radii(
            direction: .incoming,
            position: .middle
        )
        #expect(incoming.topLeading == Radius.chatInner)
        #expect(incoming.bottomLeading == Radius.chatInner)
        #expect(incoming.topTrailing == Radius.chat)
    }
}

struct ComposerRulesTests {
    @Test func sendabilityRequiresVisibleTextWithinTheLimit() {
        #expect(ChatRules.isSendable("Hello"))
        #expect(!ChatRules.isSendable(""))
        #expect(!ChatRules.isSendable("   \n  "))
        #expect(ChatRules.isSendable(String(repeating: "a", count: 4_000)))
        #expect(!ChatRules.isSendable(String(repeating: "a", count: 4_001)))
    }

    @Test func counterAppearsNearTheLimitWithCalmGuidance() {
        #expect(ChatRules.counterGuidance(
            String(repeating: "a", count: 3_899)
        ) == nil)
        #expect(ChatRules.counterGuidance(
            String(repeating: "a", count: 3_900)
        ) == "3900 of 4000 characters")
        #expect(ChatRules.counterGuidance(
            String(repeating: "a", count: 4_001)
        ) == "Messages can hold 4000 characters. This one is 4001.")
    }
}

struct AccessibilityLabelTests {
    @Test func combinesSenderTimeBodyAndStatusWithoutDoublePunctuation() {
        let row = MessageRowUiModel(
            message: message(
                "m5",
                from: "client",
                direction: .outgoing,
                at: "2026-07-16T10:01:00Z",
                body: "See you then!",
                delivery: .delivered
            ),
            groupPosition: .solo,
            showsMeta: true,
            showsDeliveryStatus: true
        )
        let accessibilityLabel = MessageAccessibility.label(
            for: row,
            locale: enUS,
            timeZone: TimeZone(identifier: "UTC")!
        )

        // Date.FormatStyle uses a narrow no-break space before AM/PM on
        // newer Apple runtimes. Normalize it so this remains portable.
        #expect(
            accessibilityLabel.replacingOccurrences(of: "\u{202F}", with: " ")
                == "You, 10:01 AM: See you then! Delivered."
        )
    }
}
