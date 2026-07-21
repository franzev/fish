import XCTest
@testable import Fish

@MainActor
final class VoipPushCoordinatorTests: XCTestCase {
    func testValidPayloadKeepsOnlyTheCallRecoveryFields() {
        let callId = UUID().uuidString
        let destination = VoipPushCoordinator.destination(from: [
            "callId": callId,
            "kind": "video",
            "callerId": "caller-1",
            "callerName": "Coach",
            "expiresAt": "2030-01-01T00:00:00Z",
            "secret": "must-not-be-kept",
        ])

        XCTAssertEqual(destination?.callId, callId)
        XCTAssertEqual(destination?.kind, "video")
        XCTAssertEqual(destination?.callerId, "caller-1")
        XCTAssertEqual(destination?.callerName, "Coach")
        XCTAssertEqual(destination?.expiresAt, "2030-01-01T00:00:00Z")
    }

    func testMalformedPayloadIsIgnored() {
        XCTAssertNil(VoipPushCoordinator.destination(from: [
            "callId": "not-a-uuid",
            "kind": "audio",
            "callerId": "caller-1",
            "callerName": "Coach",
            "expiresAt": "2030-01-01T00:00:00Z",
        ]))
        XCTAssertNil(VoipPushCoordinator.destination(from: [
            "callId": UUID().uuidString,
            "kind": "screen-share",
            "callerId": "caller-1",
            "callerName": "Coach",
            "expiresAt": "2030-01-01T00:00:00Z",
        ]))
    }
}
