import CallData
import Foundation
import Testing
import TestSupport

/// Replays the shared cross-platform vectors through the Swift reducer. The
/// web suite replays the same bytes through the TypeScript reducer and pins
/// the bundled copies byte-identical, so a green run here means both
/// platforms implement the same state machine.
struct CallStateVectorTests {
    @Test func canonicalVectorsReplay() throws {
        let vectors = try CallStateVectors.load(.canonical)
        #expect(vectors.count >= 6)
        replay(vectors)
    }

    @Test func extendedVectorsReplay() throws {
        let vectors = try CallStateVectors.load(.extended)
        #expect(vectors.count >= 21)
        replay(vectors)
    }

    @Test func vectorsExerciseEveryEventType() throws {
        var seen: Set<String> = []
        for set in CallStateVectors.VectorSet.allCases {
            let raw = try JSONSerialization.jsonObject(
                with: CallStateVectors.rawJSON(set)
            )
            guard let cases = raw as? [[String: Any]] else { continue }
            for vector in cases {
                for event in vector["events"] as? [[String: Any]] ?? [] {
                    if let type = event["type"] as? String { seen.insert(type) }
                }
            }
        }

        let allEventTypes: Set<String> = [
            "permissionRequested", "permissionDenied", "outgoingCallCreated",
            "incomingCallReceived", "callAccepted", "mediaConnected",
            "muteChanged", "cameraChanged", "reconnecting", "reconnected",
            "callRejected", "callCancelled", "callMissed", "callEnded",
            "callFailed", "clearCall", "identityChanged",
        ]
        #expect(seen == allEventTypes)
    }

    private func replay(_ vectors: [CallStateVector]) {
        for vector in vectors {
            let actual = vector.events.reduce(
                vector.initialState,
                CallStateReducer.reduce
            )
            #expect(actual == vector.expectedState, "\(vector.name)")

            if let expected = vector.expectedSelectors?.hasLiveCall {
                #expect(actual.hasLiveCall == expected, "\(vector.name) hasLiveCall")
            }
            if let expected = vector.expectedSelectors?.canMute {
                #expect(actual.canMute == expected, "\(vector.name) canMute")
            }
        }
    }
}
