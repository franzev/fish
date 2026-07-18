import ChatData
import PersonalChat
import SwiftUI

struct ConversationListPage: View {
    private let now = Date(timeIntervalSince1970: 1_784_200_000)

    var body: some View {
        ConversationListScreen(
            conversations: [
                ChatConversationPreview(
                    conversationId: "conversation-1",
                    participantId: "coach-1",
                    participantRole: "coach",
                    participantDisplayName: "Sam Rivera",
                    latestMessageSenderId: "client-1",
                    latestMessageText: "I used the pause twice 😊",
                    latestMessageCreatedAt: now.addingTimeInterval(-240),
                    unreadCount: 0
                ),
                ChatConversationPreview(
                    conversationId: "conversation-2",
                    participantId: "coach-2",
                    participantRole: "coach",
                    participantDisplayName: "Alexandria Morgan-Santos",
                    latestMessageSenderId: "coach-2",
                    latestMessageText: "Would tomorrow morning feel manageable?",
                    latestMessageCreatedAt: now.addingTimeInterval(-7_200),
                    unreadCount: 3
                ),
            ],
            currentUserId: "client-1",
            onOpen: { _ in },
            now: now
        )
        .toolbar(.hidden, for: .navigationBar)
    }
}
