import DesignSystem
import Foundation
import SwiftUI
import Testing
@testable import PersonalChat

private func row(
    _ id: String,
    direction: MessageDirection,
    body: String,
    at seconds: TimeInterval,
    position: MessageGroupPosition,
    showsMeta: Bool,
    delivery: MessageDeliveryStatus? = nil,
    showsStatus: Bool = false
) -> MessageRowUiModel {
    MessageRowUiModel(
        message: MessageUiModel(
            id: id,
            direction: direction,
            senderId: direction == .incoming ? "coach" : "client",
            senderName: "Sam Rivera",
            body: body,
            sentAt: Date(timeIntervalSince1970: 1_784_200_000 + seconds),
            delivery: delivery
        ),
        groupPosition: position,
        showsMeta: showsMeta,
        showsDeliveryStatus: showsStatus
    )
}

struct MessageBubbleTests {
    @MainActor @Test func snapshots() {
        let strip = ScrollView {
            VStack(spacing: Spacing.xs) {
                MessageBubble(row: row(
                    "1",
                    direction: .incoming,
                    body: "How did the presentation go?",
                    at: 0,
                    position: .first,
                    showsMeta: true
                ))
                MessageBubble(row: row(
                    "2",
                    direction: .incoming,
                    body: "Remember — pause before the key point. It gives your listeners time to catch up.",
                    at: 60,
                    position: .last,
                    showsMeta: false
                ))
                MessageBubble(row: row(
                    "3",
                    direction: .outgoing,
                    body: "It went really well!",
                    at: 120,
                    position: .first,
                    showsMeta: true,
                    delivery: .read
                ))
                MessageBubble(row: row(
                    "4",
                    direction: .outgoing,
                    body: "I used the pause twice 😊",
                    at: 150,
                    position: .last,
                    showsMeta: false,
                    delivery: .delivered,
                    showsStatus: true
                ))
                MessageBubble(
                    row: row(
                        "5",
                        direction: .outgoing,
                        body: "And this one didn't go through.",
                        at: 400,
                        position: .solo,
                        showsMeta: true,
                        delivery: .failed,
                        showsStatus: true
                    ),
                    onRetry: { _ in }
                )
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: strip, named: "message-bubbles")
        assertAccessibilitySnapshots(of: strip, named: "message-bubbles")
    }
}
