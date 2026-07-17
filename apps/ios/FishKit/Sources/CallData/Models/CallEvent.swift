import Foundation

/// Discriminated event union — mirrors `CallEvent` in
/// `packages/core/src/call-state/types.ts`. Decodable so the shared JSON
/// fixture vectors replay through the Swift reducer unchanged.
public enum CallEvent: Sendable, Equatable {
    case permissionRequested(counterpartId: String, counterpartName: String, kind: CallKind)
    case permissionDenied(reason: CallFailureReason)
    case outgoingCallCreated(
        callId: String,
        counterpartId: String,
        counterpartName: String,
        kind: CallKind,
        expiresAt: String
    )
    case incomingCallReceived(
        callId: String,
        counterpartId: String,
        counterpartName: String,
        kind: CallKind,
        expiresAt: String
    )
    case callAccepted(callId: String)
    case mediaConnected(callId: String, connectedAt: String)
    case muteChanged(muted: Bool)
    case cameraChanged(enabled: Bool)
    case reconnecting(callId: String)
    case reconnected(callId: String)
    case callRejected(callId: String)
    case callCancelled(callId: String)
    case callMissed(callId: String)
    case callEnded(callId: String)
    case callFailed(callId: String?, reason: CallFailureReason)
    case clearCall
    case identityChanged
}

extension CallEvent: Decodable {
    private enum CodingKeys: String, CodingKey {
        case type
        case callId
        case counterpartId
        case counterpartName
        case kind
        case expiresAt
        case connectedAt
        case muted
        case enabled
        case reason
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "permissionRequested":
            self = .permissionRequested(
                counterpartId: try container.decode(String.self, forKey: .counterpartId),
                counterpartName: try container.decode(String.self, forKey: .counterpartName),
                kind: try container.decode(CallKind.self, forKey: .kind)
            )
        case "permissionDenied":
            self = .permissionDenied(
                reason: try container.decode(CallFailureReason.self, forKey: .reason)
            )
        case "outgoingCallCreated":
            self = .outgoingCallCreated(
                callId: try container.decode(String.self, forKey: .callId),
                counterpartId: try container.decode(String.self, forKey: .counterpartId),
                counterpartName: try container.decode(String.self, forKey: .counterpartName),
                kind: try container.decode(CallKind.self, forKey: .kind),
                expiresAt: try container.decode(String.self, forKey: .expiresAt)
            )
        case "incomingCallReceived":
            self = .incomingCallReceived(
                callId: try container.decode(String.self, forKey: .callId),
                counterpartId: try container.decode(String.self, forKey: .counterpartId),
                counterpartName: try container.decode(String.self, forKey: .counterpartName),
                kind: try container.decode(CallKind.self, forKey: .kind),
                expiresAt: try container.decode(String.self, forKey: .expiresAt)
            )
        case "callAccepted":
            self = .callAccepted(callId: try container.decode(String.self, forKey: .callId))
        case "mediaConnected":
            self = .mediaConnected(
                callId: try container.decode(String.self, forKey: .callId),
                connectedAt: try container.decode(String.self, forKey: .connectedAt)
            )
        case "muteChanged":
            self = .muteChanged(muted: try container.decode(Bool.self, forKey: .muted))
        case "cameraChanged":
            self = .cameraChanged(enabled: try container.decode(Bool.self, forKey: .enabled))
        case "reconnecting":
            self = .reconnecting(callId: try container.decode(String.self, forKey: .callId))
        case "reconnected":
            self = .reconnected(callId: try container.decode(String.self, forKey: .callId))
        case "callRejected":
            self = .callRejected(callId: try container.decode(String.self, forKey: .callId))
        case "callCancelled":
            self = .callCancelled(callId: try container.decode(String.self, forKey: .callId))
        case "callMissed":
            self = .callMissed(callId: try container.decode(String.self, forKey: .callId))
        case "callEnded":
            self = .callEnded(callId: try container.decode(String.self, forKey: .callId))
        case "callFailed":
            self = .callFailed(
                callId: try container.decodeIfPresent(String.self, forKey: .callId),
                reason: try container.decode(CallFailureReason.self, forKey: .reason)
            )
        case "clearCall":
            self = .clearCall
        case "identityChanged":
            self = .identityChanged
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown call event type \(type)"
            )
        }
    }
}
