import Foundation
import Testing
@testable import ChatData

struct ChatNotificationReplyTests {
    @Test func decodesLegacyPayloadWithoutMessageId() throws {
        let legacy = Data(#"{"id":"a","conversationId":"c","body":"hi","createdAt":0}"#.utf8)
        let reply = try JSONDecoder().decode(ChatNotificationReply.self, from: legacy)
        #expect(reply.messageId == nil)
        #expect(reply.body == "hi")
    }

    @Test func roundTripsMessageId() throws {
        let reply = ChatNotificationReply(conversationId: "c", body: "hi", messageId: "m")
        let decoded = try JSONDecoder().decode(
            ChatNotificationReply.self,
            from: JSONEncoder().encode(reply)
        )
        #expect(decoded == reply)
        #expect(decoded.messageId == "m")
    }
}
