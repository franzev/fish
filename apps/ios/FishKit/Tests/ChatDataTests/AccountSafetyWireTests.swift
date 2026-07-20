import Foundation
import Testing
@testable import ChatData

struct AccountSafetyWireTests {
    @Test func profileAndBlockedPeopleDecodeServerKeys() throws {
        let profile = try JSONDecoder().decode(
            ChatAccountProfileWire.self,
            from: Data(#"{"display_name":"Maya","username":"maya","role":"client"}"#.utf8)
        )
        #expect(profile.domain == ChatAccountProfile(
            displayName: "Maya",
            username: "maya",
            role: .client
        ))

        let person = try JSONDecoder().decode(
            ChatBlockedPersonWire.self,
            from: Data(#"{"user_id":"user-1","display_name":"Maya","username":null}"#.utf8)
        )
        #expect(person.domain == ChatBlockedPerson(userId: "user-1", displayName: "Maya"))
    }

    @Test func presenceCommandsUseDeployedWireKeys() throws {
        let request = try JSONEncoder().encode(
            ChatPresenceCommandRequest(mode: .invisible, durationSeconds: 3_600)
        )
        let object = try JSONSerialization.jsonObject(with: request) as? [String: Any]
        #expect(object?["mode"] as? String == "invisible")
        #expect(object?["durationSeconds"] as? Int == 3_600)

        let response = try JSONDecoder().decode(
            ChatPresenceCommandWire.self,
            from: Data(#"{"setting":{"preference":"away","expiresAt":null}}"#.utf8)
        )
        #expect(response.domain.preference == ChatPresencePreference(visibility: .away))
    }

    @Test func expiredPresencePreferenceFallsBackToAutomatic() {
        let expired = ChatPresencePreference(
            visibility: .busy,
            expiresAt: "2026-07-19T00:00:00Z"
        )
        let now = ISO8601DateFormatter().date(from: "2026-07-20T00:00:00Z")!
        #expect(expired.effective(now: now) == ChatPresencePreference())
    }

    @Test func unknownAccountWireEnumsAreRejected() {
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(
                ChatAccountProfileWire.self,
                from: Data(#"{"display_name":"Maya","role":"student"}"#.utf8)
            )
        }
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(
                ChatPresencePreferenceWire.self,
                from: Data(#"{"mode":"online"}"#.utf8)
            )
        }
    }
}
