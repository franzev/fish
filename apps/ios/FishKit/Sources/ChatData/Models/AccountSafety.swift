import Foundation

public enum ChatAccountRole: String, Codable, Sendable, Equatable {
    case client
    case coach
}

public struct ChatAccountProfile: Sendable, Equatable {
    public let displayName: String
    public let username: String?
    public let role: ChatAccountRole

    public init(displayName: String, username: String? = nil, role: ChatAccountRole) {
        self.displayName = displayName
        self.username = username
        self.role = role
    }
}

public enum ChatPresenceVisibility: String, Codable, CaseIterable, Sendable, Equatable {
    case automatic
    case away
    case busy
    case invisible
}

public enum ChatPresenceDuration: String, CaseIterable, Sendable, Equatable {
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

public struct ChatPresencePreference: Sendable, Equatable {
    public let visibility: ChatPresenceVisibility
    public let expiresAt: String?

    public init(
        visibility: ChatPresenceVisibility = .automatic,
        expiresAt: String? = nil
    ) {
        self.visibility = visibility
        self.expiresAt = expiresAt
    }

    public func effective(now: Date = Date()) -> ChatPresencePreference {
        guard let expiresAt,
              let expiry = ChatTimestamp.date(expiresAt),
              expiry <= now
        else { return self }
        return ChatPresencePreference()
    }
}

public struct ChatPresenceCommandResult: Sendable, Equatable {
    public let preference: ChatPresencePreference

    public init(preference: ChatPresencePreference) {
        self.preference = preference
    }
}

public struct ChatBlockedPerson: Identifiable, Sendable, Equatable {
    public let userId: String
    public let displayName: String
    public let username: String?

    public var id: String { userId }

    public init(userId: String, displayName: String, username: String? = nil) {
        self.userId = userId
        self.displayName = displayName
        self.username = username
    }
}
