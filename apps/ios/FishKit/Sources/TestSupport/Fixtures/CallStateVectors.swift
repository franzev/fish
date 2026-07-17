import CallData
import Foundation

/// One shared reducer-conformance case — the Swift shape of the JSON vectors
/// in `packages/core/src/call-state/fixtures/`.
public struct CallStateVector: Decodable, Sendable {
    public struct ExpectedSelectors: Decodable, Sendable {
        public let hasLiveCall: Bool?
        public let canMute: Bool?
    }

    public let name: String
    public let initialState: CallState
    public let events: [CallEvent]
    public let expectedState: CallState
    public let expectedSelectors: ExpectedSelectors?
}

/// Loads the bundled copies of the shared call-state vectors. The web test
/// suite asserts these copies stay byte-identical to the canonical fixtures
/// in `packages/core`, so replaying them here proves the Swift reducer
/// matches the TypeScript reducer.
public enum CallStateVectors {
    public enum VectorSet: String, CaseIterable, Sendable {
        case canonical = "call-state-vectors"
        case extended = "call-state-vectors.extended"
    }

    public static func load(_ set: VectorSet) throws -> [CallStateVector] {
        try JSONDecoder().decode([CallStateVector].self, from: rawJSON(set))
    }

    public static func rawJSON(_ set: VectorSet) throws -> Data {
        guard let url = Bundle.module.url(forResource: set.rawValue, withExtension: "json")
        else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try Data(contentsOf: url)
    }
}
