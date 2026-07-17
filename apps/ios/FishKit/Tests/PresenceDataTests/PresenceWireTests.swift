import Foundation
import Testing
@testable import PresenceData

/// Wire-format pins: database rows decode snake_case, commands encode
/// camelCase, unknown enums are rejected, expired preferences clamp to
/// automatic, and calm error bodies survive the trip.
struct PresenceWireTests {
    @Test func databaseRowsDecodeSnakeCase() throws {
        let json = Data("""
        {
          "user_id": "a06c919c-289a-4e01-b74a-395c5d5e9d1f",
          "status": "idle",
          "last_heartbeat_at": "2026-07-17T05:00:32.876435+00:00",
          "last_seen_at": null,
          "revision": 6,
          "updated_at": "2026-07-17T05:00:32.876435+00:00"
        }
        """.utf8)
        let row = try JSONDecoder().decode(PresenceSnapshotRow.self, from: json)
        let snapshot = row.snapshot
        #expect(snapshot.userId == "a06c919c-289a-4e01-b74a-395c5d5e9d1f")
        #expect(snapshot.status == .idle)
        #expect(snapshot.lastHeartbeatAt == "2026-07-17T05:00:32.876435+00:00")
        #expect(snapshot.lastSeenAt == nil)
        #expect(snapshot.revision == 6)
    }

    @Test func unknownWireEnumsAreRejected() {
        let sleeping = Data(#"{"user_id":"u","status":"sleeping","revision":1,"updated_at":"2026-07-17T05:00:00Z"}"#.utf8)
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(PresenceSnapshotRow.self, from: sleeping)
        }
        let sometimes = Data(#"{"mode":"sometimes","expires_at":null}"#.utf8)
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(PresencePreferenceRow.self, from: sometimes)
        }
    }

    @Test func commandsEncodeCamelCase() throws {
        let encoded = try JSONEncoder().encode(
            PresenceCommandRequest(mode: .busy, durationSeconds: 3_600)
        )
        let object = try JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        #expect(object?["mode"] as? String == "busy")
        #expect(object?["durationSeconds"] as? Int == 3_600)

        let touch = try JSONEncoder().encode(
            TouchPresenceParams(sessionId: "session-1", activity: true, ended: false)
        )
        let touchObject = try JSONSerialization.jsonObject(with: touch) as? [String: Any]
        #expect(touchObject?["p_session_id"] as? String == "session-1")
        #expect(touchObject?["p_activity"] as? Bool == true)
        #expect(touchObject?["p_ended"] as? Bool == false)
    }

    @Test func commandResponsesDecodeCamelCase() throws {
        let json = Data("""
        {
          "snapshot": {
            "userId": "maya",
            "status": "busy",
            "lastHeartbeatAt": "2026-07-17T05:00:32.876435+00:00",
            "lastSeenAt": "2026-07-17T05:00:32.876435+00:00",
            "revision": 7,
            "updatedAt": "2026-07-17T05:00:32.876435+00:00"
          },
          "setting": { "preference": "busy", "expiresAt": null }
        }
        """.utf8)
        let response = try JSONDecoder().decode(PresenceCommandResponse.self, from: json)
        let result = response.result
        #expect(result.snapshot.status == .busy)
        #expect(result.snapshot.revision == 7)
        #expect(result.setting == PresencePreferenceSetting(preference: .busy))
    }

    @Test func expiredPreferenceRowsClampToAutomatic() throws {
        let now = ISO8601DateFormatter().date(from: "2026-07-16T15:00:00Z")!
        let expired = PresencePreferenceRow(
            mode: .busy,
            expiresAt: "2026-07-16T14:59:59Z"
        )
        #expect(expired.setting(now: now) == PresencePreferenceSetting())

        let active = PresencePreferenceRow(
            mode: .busy,
            expiresAt: "2026-07-16T15:00:01Z"
        )
        #expect(active.setting(now: now) == PresencePreferenceSetting(
            preference: .busy,
            expiresAt: "2026-07-16T15:00:01Z"
        ))

        let forever = PresencePreferenceRow(mode: .invisible, expiresAt: nil)
        #expect(forever.setting(now: now) == PresencePreferenceSetting(
            preference: .invisible
        ))
    }

    @Test func calmErrorBodiesSurfaceServerCopy() {
        let body = Data(#"{"code":"invalid_request","error":"Choose one of the available statuses."}"#.utf8)
        let failure = PresenceCalmError.failure(from: body)
        #expect(failure.code == "invalid_request")
        #expect(failure.notice == "Choose one of the available statuses.")

        let garbage = PresenceCalmError.failure(from: Data("not json".utf8))
        #expect(garbage == .unavailable)
    }

    @Test func timestampsParsePostgresAndPlainFormats() {
        #expect(PresenceTimestamp.parse("2026-07-16T15:00:00Z") != nil)
        #expect(PresenceTimestamp.parse("2026-07-17T05:00:32.876Z") != nil)
        #expect(PresenceTimestamp.parse("2026-07-17T05:00:32.876435+00:00") != nil)
        #expect(PresenceTimestamp.parse(nil) == nil)
        #expect(PresenceTimestamp.parse("") == nil)
        #expect(PresenceTimestamp.parse("yesterday") == nil)

        let micro = PresenceTimestamp.parse("2026-07-17T05:00:32.876435+00:00")!
        let milli = PresenceTimestamp.parse("2026-07-17T05:00:32.876Z")!
        #expect(abs(micro.timeIntervalSince(milli)) < 0.001)
    }
}
