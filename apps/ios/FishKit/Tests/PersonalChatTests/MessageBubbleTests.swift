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

    @MainActor @Test func actionStateSnapshots() {
        let date = Date(timeIntervalSince1970: 1_784_200_000)
        let strip = ScrollView {
            VStack(spacing: Spacing.sm) {
                MessageBubble(row: MessageRowUiModel(
                    message: MessageUiModel(
                        id: "reply",
                        direction: .outgoing,
                        senderId: "client",
                        senderName: "You",
                        body: "I’ll try that tomorrow.",
                        sentAt: date,
                        delivery: .read,
                        replyPreview: MessageReplyPreviewUiModel(
                            messageId: "original",
                            authorName: "Sam Rivera",
                            snippet: "Pause before the key point."
                        ),
                        reactions: [
                            MessageReactionUiModel(emoji: "👍", count: 2, byMe: true),
                            MessageReactionUiModel(emoji: "🎉", count: 1, byMe: false),
                            MessageReactionUiModel(emoji: "❤️", count: 12, byMe: false),
                            MessageReactionUiModel(emoji: "🙏", count: 3, byMe: true),
                            MessageReactionUiModel(emoji: "👩‍💻", count: 4, byMe: false),
                            MessageReactionUiModel(emoji: "🌊", count: 2, byMe: false),
                            MessageReactionUiModel(emoji: "🇵🇭", count: 1, byMe: false),
                        ],
                        isEdited: true
                    ),
                    groupPosition: .solo,
                    showsMeta: true,
                    showsDeliveryStatus: true
                ))
                MessageBubble(row: MessageRowUiModel(
                    message: MessageUiModel(
                        id: "deleted",
                        direction: .incoming,
                        senderId: "coach",
                        senderName: "Sam Rivera",
                        body: "Message deleted",
                        sentAt: date.addingTimeInterval(60),
                        isDeleted: true
                    ),
                    groupPosition: .solo,
                    showsMeta: true,
                    showsDeliveryStatus: false
                ))
                MessageBubble(row: MessageRowUiModel(
                    message: MessageUiModel(
                        id: "pending-reaction",
                        direction: .incoming,
                        senderId: "coach",
                        senderName: "Sam Rivera",
                        body: "This reaction is saving.",
                        sentAt: date.addingTimeInterval(120),
                        reactions: [
                            MessageReactionUiModel(emoji: "👍", count: 2, byMe: true),
                        ],
                        isReactionPending: true
                    ),
                    groupPosition: .solo,
                    showsMeta: true,
                    showsDeliveryStatus: false
                ))
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: strip, named: "message-action-states")
        assertAccessibilitySnapshots(of: strip, named: "message-action-states")
    }
}
