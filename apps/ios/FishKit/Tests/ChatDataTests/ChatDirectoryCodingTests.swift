import Foundation
import Testing
@testable import ChatData

@Suite struct ChatDirectoryCodingTests {
    @Test func conversationPreviewRoundTripsThroughJson() throws {
        let preview = ChatConversationPreview(
            conversationId: "c1",
            participantId: "them",
            participantRole: "coach",
            participantDisplayName: "Coach Mina",
            latestMessageSenderId: "them",
            latestMessageText: "See you Thursday",
            latestMessageCreatedAt: Date(timeIntervalSince1970: 200),
            unreadCount: 2,
            hasDraft: true,
            mute: ConversationMute(isMuted: true, mutedUntil: Date(timeIntervalSince1970: 500))
        )

        let decoded = try JSONDecoder().decode(
            ChatConversationPreview.self,
            from: JSONEncoder().encode(preview)
        )

        #expect(decoded == preview)
    }

    @Test func conversationPreviewRoundTripsWithNilOptionalFields() throws {
        let preview = ChatConversationPreview(
            conversationId: "c1",
            participantId: "them",
            participantRole: "coach",
            participantDisplayName: "Coach Mina",
            latestMessageSenderId: nil,
            latestMessageText: "",
            latestMessageCreatedAt: nil,
            unreadCount: 0
        )

        let decoded = try JSONDecoder().decode(
            ChatConversationPreview.self,
            from: JSONEncoder().encode(preview)
        )

        #expect(decoded == preview)
    }

    @Test func conversationMuteRoundTripsThroughJson() throws {
        let mute = ConversationMute(isMuted: true, mutedUntil: Date(timeIntervalSince1970: 900))

        let decoded = try JSONDecoder().decode(
            ConversationMute.self,
            from: JSONEncoder().encode(mute)
        )

        #expect(decoded == mute)
    }

    @Test func conversationMuteOffRoundTripsThroughJson() throws {
        let decoded = try JSONDecoder().decode(
            ConversationMute.self,
            from: JSONEncoder().encode(ConversationMute.on)
        )

        #expect(decoded == ConversationMute.on)
    }
}
