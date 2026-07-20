import Foundation
import Observation
import SwiftUI

public enum AccountAppearance: String, CaseIterable, Sendable, Equatable {
    case system
    case light
    case dark

    public var label: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    public var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

public enum AccountMotionPreference: String, CaseIterable, Sendable, Equatable {
    case system
    case reduceMotion

    public var label: String {
        switch self {
        case .system: "System"
        case .reduceMotion: "Reduce motion"
        }
    }
}

/// These values mirror Apple's authority without making the feature target
/// depend on UserNotifications.
public enum AccountNotificationAuthorization: String, CaseIterable, Sendable, Equatable {
    case notDetermined
    case authorized
    case provisional
    case ephemeral
    case denied

    public var rootLabel: String {
        switch self {
        case .authorized, .provisional, .ephemeral: "On"
        case .notDetermined, .denied: "Off"
        }
    }

    public var requiresPrompt: Bool { self == .notDetermined }

    public var statusCopy: String {
        switch self {
        case .authorized, .provisional, .ephemeral:
            "Notifications are available."
        case .denied:
            "Notifications are turned off."
        case .notDetermined:
            "Notifications are not set up yet."
        }
    }
}

public enum AccountPresenceVisibility: String, CaseIterable, Sendable, Equatable {
    case automatic
    case away
    case busy
    case invisible

    public var label: String {
        switch self {
        case .automatic: "Automatic"
        case .away: "Away"
        case .busy: "Busy"
        case .invisible: "Invisible"
        }
    }

    public var explanation: String {
        switch self {
        case .automatic: "Online while you are using FISH."
        case .away: "Let people know you may reply later."
        case .busy: "Let people know you need quiet."
        case .invisible: "Appear offline."
        }
    }
}

public enum AccountPresenceDuration: String, CaseIterable, Sendable, Equatable {
    case fifteenMinutes
    case oneHour
    case eightHours
    case oneDay
    case threeDays
    case forever

    public var label: String {
        switch self {
        case .fifteenMinutes: "15 minutes"
        case .oneHour: "1 hour"
        case .eightHours: "8 hours"
        case .oneDay: "24 hours"
        case .threeDays: "3 days"
        case .forever: "Forever"
        }
    }
}

public struct AccountSettingsPresence: Sendable, Equatable {
    public var visibility: AccountPresenceVisibility
    public var updating: Bool
    public var notice: String?

    public init(
        visibility: AccountPresenceVisibility = .automatic,
        updating: Bool = false,
        notice: String? = nil
    ) {
        self.visibility = visibility
        self.updating = updating
        self.notice = notice
    }

    public var label: String { visibility.label }
}

public struct AccountSettingsBlockedPerson: Identifiable, Sendable, Equatable {
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

public enum AccountSettingsBlockedPeopleState: Sendable, Equatable {
    case hidden
    case loading
    case loaded(
        people: [AccountSettingsBlockedPerson],
        busyIds: Set<String> = [],
        notice: String? = nil
    )
    case failed
}

public enum AccountSettingsWebPath: String, Sendable, Equatable {
    case forgotPassword = "/forgot-password"
    case privacy = "/privacy"
}

/// Builds only the two fixed external destinations used by account settings.
/// It intentionally rejects a configured base with path/query/user data so no
/// credentials, redirects, or arbitrary intents can enter the handoff.
public enum AccountSettingsWebLinkPolicy {
    public static func url(
        baseURL: URL?,
        path: AccountSettingsWebPath,
        isRelease: Bool
    ) -> URL? {
        guard let baseURL,
              let components = URLComponents(
                url: baseURL,
                resolvingAgainstBaseURL: false
              ),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              !isRelease || scheme == "https",
              let host = components.host,
              !host.isEmpty,
              components.user == nil,
              components.password == nil,
              components.query == nil,
              components.fragment == nil,
              components.path.isEmpty || components.path == "/"
        else { return nil }

        var destination = URLComponents()
        destination.scheme = scheme
        destination.host = host
        destination.port = components.port
        destination.path = path.rawValue
        return destination.url
    }
}

@MainActor @Observable
public final class DeviceSettingsStore {
    private enum Key {
        static let appearance = "fish.account.appearance"
        static let motion = "fish.account.motion"
    }

    @ObservationIgnored private let defaults: UserDefaults
    public private(set) var appearance: AccountAppearance
    public private(set) var motion: AccountMotionPreference

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        appearance = AccountAppearance(
            rawValue: defaults.string(forKey: Key.appearance) ?? ""
        ) ?? .system
        motion = AccountMotionPreference(
            rawValue: defaults.string(forKey: Key.motion) ?? ""
        ) ?? .system
    }

    public func setAppearance(_ value: AccountAppearance) {
        appearance = value
        defaults.set(value.rawValue, forKey: Key.appearance)
    }

    public func setMotion(_ value: AccountMotionPreference) {
        motion = value
        defaults.set(value.rawValue, forKey: Key.motion)
    }

    public func effectiveReduceMotion(systemReduceMotion: Bool) -> Bool {
        systemReduceMotion || motion == .reduceMotion
    }
}
