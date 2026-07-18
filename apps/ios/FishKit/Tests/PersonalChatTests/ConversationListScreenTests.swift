import ChatData
import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct ConversationListScreenTests {
    private let now = Date(timeIntervalSince1970: 1_784_200_000)

    @Test func relativeTimeIsCompactAndAccessible() {
        #expect(ConversationRelativeTime.make(
            from: now.addingTimeInterval(-20),
            relativeTo: now
        ) == ConversationRelativeTime(shortLabel: "Now", accessibilityLabel: "Now"))
        #expect(ConversationRelativeTime.make(
            from: now.addingTimeInterval(-60),
            relativeTo: now
        ).accessibilityLabel == "1 minute ago")
        #expect(ConversationRelativeTime.make(
            from: now.addingTimeInterval(-7_200),
            relativeTo: now
        ).shortLabel == "2h")
        #expect(ConversationRelativeTime.make(
            from: now.addingTimeInterval(-172_800),
            relativeTo: now
        ).accessibilityLabel == "2 days ago")
        #expect(ConversationRelativeTime.make(
            from: now.addingTimeInterval(60),
            relativeTo: now
        ).shortLabel == "Now")
    }

    @MainActor @Test func listSnapshots() {
        let view = ConversationListScreen(
            conversations: previews,
            currentUserId: "me",
            onOpen: { _ in },
            now: now
        )
        assertThemedSnapshots(of: view, named: "conversation-list")
        assertAccessibilitySnapshots(of: view, named: "conversation-list")
    }

    @MainActor @Test func emptyAndFailureSnapshots() {
        assertThemedSnapshots(
            of: ConversationListScreen(
                conversations: [],
                currentUserId: "me",
                onOpen: { _ in },
                now: now
            ),
            named: "conversation-list-empty"
        )
        assertThemedSnapshots(
            of: ConversationListScreen(
                conversations: [],
                currentUserId: "me",
                notice: "Conversations aren’t available yet. Try again.",
                onOpen: { _ in },
                onRetry: {},
                now: now
            ),
            named: "conversation-list-failed"
        )
    }

    private var previews: [ChatConversationPreview] {
        [
            ChatConversationPreview(
                conversationId: "c1",
                participantId: "coach-1",
                participantRole: "coach",
                participantDisplayName: "Sam Rivera",
                latestMessageSenderId: "me",
                latestMessageText: "I used the pause twice 😊",
                latestMessageCreatedAt: now.addingTimeInterval(-240),
                unreadCount: 0
            ),
            ChatConversationPreview(
                conversationId: "c2",
                participantId: "coach-2",
                participantRole: "coach",
                participantDisplayName: "Alexandria Morgan-Santos",
                latestMessageSenderId: "coach-2",
                latestMessageText: "Would tomorrow morning feel manageable?",
                latestMessageCreatedAt: now.addingTimeInterval(-7_200),
                unreadCount: 128
            ),
        ]
    }
}
