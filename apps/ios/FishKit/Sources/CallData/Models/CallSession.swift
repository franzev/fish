import Foundation

/// Portable call lifecycle contract — mirrors
/// `packages/core/src/call-state/types.ts` field-for-field so both platforms
/// replay the same fixture vectors.
public enum CallKind: String, Codable, Sendable {
    case audio
    case video
}

public enum CallLifecycleStatus: String, Codable, Sendable {
    case idle
    case requestingPermission
    case ringing
    case connecting
    case active
    case reconnecting
    case ended
    case rejected
    case cancelled
    case missed
    case failed
}

public enum CallFailureReason: String, Codable, Sendable {
    case permissionDenied
    case deviceUnavailable
    case connectFailed
    case networkLost
    case providerUnavailable
    case notAllowed
}

public enum CallDirection: String, Codable, Sendable {
    case incoming
    case outgoing
}

public struct CallSessionState: Codable, Sendable, Equatable {
    public var callId: String?
    public var counterpartId: String?
    public var counterpartName: String?
    public var kind: CallKind
    public var status: CallLifecycleStatus
    public var direction: CallDirection?
    public var muted: Bool
    public var cameraEnabled: Bool
    public var expiresAt: String?
    public var connectedAt: String?
    public var failureReason: CallFailureReason?

    public init(
        callId: String? = nil,
        counterpartId: String? = nil,
        counterpartName: String? = nil,
        kind: CallKind = .audio,
        status: CallLifecycleStatus = .idle,
        direction: CallDirection? = nil,
        muted: Bool = false,
        cameraEnabled: Bool = false,
        expiresAt: String? = nil,
        connectedAt: String? = nil,
        failureReason: CallFailureReason? = nil
    ) {
        self.callId = callId
        self.counterpartId = counterpartId
        self.counterpartName = counterpartName
        self.kind = kind
        self.status = status
        self.direction = direction
        self.muted = muted
        self.cameraEnabled = cameraEnabled
        self.expiresAt = expiresAt
        self.connectedAt = connectedAt
        self.failureReason = failureReason
    }
}

public struct CallState: Codable, Sendable, Equatable {
    public var current: CallSessionState

    public init(current: CallSessionState = CallSessionState()) {
        self.current = current
    }
}
