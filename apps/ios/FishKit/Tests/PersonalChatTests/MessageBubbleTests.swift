import DesignSystem
import Foundation
import SwiftUI
import Testing
import TestSupport
@testable import PersonalChat

private func row(
    _ id: String,
    direction: MessageDirection,
    body: String,
    media: MessageMedia? = nil,
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
            media: media,
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

    /// Transcript media rows: sticker, GIF (playing state — the video layer
    /// renders as the stable surface fill in snapshots), both unavailable
    /// fallbacks, and an enlarged emoji-only body.
    @MainActor @Test func mediaSnapshots() {
        let strip = ScrollView {
            VStack(spacing: Spacing.xs) {
                MessageBubble(row: row(
                    "s1",
                    direction: .outgoing,
                    body: "",
                    media: .sticker(id: "aquatic-great-job-sea-star"),
                    at: 0,
                    position: .solo,
                    showsMeta: true,
                    delivery: .read,
                    showsStatus: true
                ))
                MessageBubble(row: row(
                    "g1",
                    direction: .incoming,
                    body: "This is how the pause felt:",
                    media: .gif(ChatMediaFixtures.gifs[0]),
                    at: 60,
                    position: .solo,
                    showsMeta: true
                ))
                MessageBubble(row: row(
                    "s2",
                    direction: .incoming,
                    body: "",
                    media: .sticker(id: "aquatic-not-in-this-pack"),
                    at: 120,
                    position: .solo,
                    showsMeta: false
                ))
                MessageBubble(row: row(
                    "g2",
                    direction: .incoming,
                    body: "",
                    media: .gifUnavailable,
                    at: 180,
                    position: .solo,
                    showsMeta: false
                ))
                MessageBubble(row: row(
                    "e1",
                    direction: .outgoing,
                    body: "🎉",
                    at: 240,
                    position: .solo,
                    showsMeta: true,
                    delivery: .delivered,
                    showsStatus: true
                ))
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: strip, named: "message-bubbles-media")
        assertAccessibilitySnapshots(of: strip, named: "message-bubbles-media")
    }
}
