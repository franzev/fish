import Foundation

/// Server-derived effective status from `presence_snapshots.status`. Invisible
/// users are sanitized to `offline` on the wire, so the enum has no invisible
/// member — only the owner's preference knows.
public enum PresenceStatus: String, Sendable, Equatable {
    case online
    case idle
    case away
    case busy
    case offline
}

/// The owner's chosen mode from `presence_preferences.mode`.
public enum PresencePreference: String, Sendable, Equatable, CaseIterable {
    case automatic
    case away
    case busy
    case invisible
}

/// The fixed expiry choices the backend accepts (`set_presence_mode` rejects
/// everything else). Order matches the account-menu presentation.
public enum PresenceDuration: Sendable, Equatable, CaseIterable {
    case fifteenMinutes
    case oneHour
    case eightHours
    case oneDay
    case threeDays
    case forever

    public var seconds: Int? {
        switch self {
        case .fifteenMinutes: 900
        case .oneHour: 3_600
        case .eightHours: 28_800
        case .oneDay: 86_400
        case .threeDays: 259_200
        case .forever: nil
        }
    }
}

/// One `presence_snapshots` row. Timestamps stay ISO-8601 strings on the
/// model (the `ClientCall` precedent); presentation parses them.
public struct PresenceSnapshot: Sendable, Equatable {
    public let userId: String
    public let status: PresenceStatus
    public let lastHeartbeatAt: String?
    public let lastSeenAt: String?
    public let revision: Int64
    public let updatedAt: String

    public init(
        userId: String,
        status: PresenceStatus,
        lastHeartbeatAt: String?,
        lastSeenAt: String?,
        revision: Int64,
        updatedAt: String
    ) {
        self.userId = userId
        self.status = status
        self.lastHeartbeatAt = lastHeartbeatAt
        self.lastSeenAt = lastSeenAt
        self.revision = revision
        self.updatedAt = updatedAt
    }
}

/// The owner's stored preference plus its optional expiry.
public struct PresencePreferenceSetting: Sendable, Equatable {
    public var preference: PresencePreference
    public var expiresAt: String?

    public init(
        preference: PresencePreference = .automatic,
        expiresAt: String? = nil
    ) {
        self.preference = preference
        self.expiresAt = expiresAt
    }
}

/// Successful `presence-command` reply: the refreshed own snapshot and the
/// stored setting.
public struct PresenceCommandResult: Sendable, Equatable {
    public let snapshot: PresenceSnapshot
    public let setting: PresencePreferenceSetting

    public init(snapshot: PresenceSnapshot, setting: PresencePreferenceSetting) {
        self.snapshot = snapshot
        self.setting = setting
    }
}

/// Repository-level command outcome; failures carry calm, user-ready copy.
public enum PresenceCommandOutcome: Sendable, Equatable {
    case success(PresenceCommandResult)
    case failure(notice: String)
}

public enum PresenceConnectionState: Sendable, Equatable {
    case signedOut
    case connecting
    case connected
    case disconnected
}

/// The single repository state value: everything presentation needs.
public struct PresenceState: Sendable, Equatable {
    public var currentUserId: String?
    public var snapshots: [String: PresenceSnapshot]
    public var ownPreference: PresencePreferenceSetting
    public var preferenceRevision: Int64
    public var connection: PresenceConnectionState

    public init(
        currentUserId: String? = nil,
        snapshots: [String: PresenceSnapshot] = [:],
        ownPreference: PresencePreferenceSetting = PresencePreferenceSetting(),
        preferenceRevision: Int64 = 0,
        connection: PresenceConnectionState = .signedOut
    ) {
        self.currentUserId = currentUserId
        self.snapshots = snapshots
        self.ownPreference = ownPreference
        self.preferenceRevision = preferenceRevision
        self.connection = connection
    }
}

/// Shared timing contract. Values mirror `@fish/core/presence` and the SQL
/// derivation exactly; the 90-second staleness cutoff is load-bearing because
/// the backend coalesces snapshot heartbeats for up to 60 seconds.
public enum PresenceRules {
    public static let heartbeatInterval: Duration = .seconds(30)
    public static let staleAfter: Duration = .seconds(90)
    public static let idleAfter: Duration = .seconds(300)
    public static let presentationClock: Duration = .seconds(15)
    public static let retryDelays: [Duration] = [.seconds(5), .seconds(10), .seconds(30)]
    public static let realtimeRetry: Duration = .seconds(5)
    public static let endSessionTimeout: Duration = .seconds(3)
    public static let commandTimeout: Duration = .seconds(15)
    public static let snapshotChannelChunk = 100
}
