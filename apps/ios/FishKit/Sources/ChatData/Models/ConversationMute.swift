import Foundation

/// How long a member wants one conversation to stay quiet. Everywhere this
/// appears as an optional, `nil` means notifications are on -- so a quiet
/// period and its absence are the only two states anything has to handle.
public enum ConversationQuietPeriod: String, CaseIterable, Sendable, Equatable {
    case oneHour
    case eightHours
    case oneDay
    case untilTurnedBackOn

    /// `nil` keeps the conversation quiet until the member turns it back on.
    /// The fixed values mirror the allowlist in `set_conversation_mute`.
    public var durationSeconds: Int? {
        switch self {
        case .oneHour: 3600
        case .eightHours: 28800
        case .oneDay: 86400
        case .untilTurnedBackOn: nil
        }
    }

    public var label: String {
        switch self {
        case .oneHour: "Quiet for 1 hour"
        case .eightHours: "Quiet for 8 hours"
        case .oneDay: "Quiet for 24 hours"
        case .untilTurnedBackOn: "Quiet until I turn it back on"
        }
    }
}

/// Whether one conversation's notifications are currently silenced, as the
/// server sees it. `mutedUntil` is only ever set while `isMuted` is true, so
/// an expired quiet period can never be presented as if it were still running.
public struct ConversationMute: Equatable, Sendable {
    public static let on = Self(isMuted: false, mutedUntil: nil)

    public let isMuted: Bool
    public let mutedUntil: Date?

    public init(isMuted: Bool, mutedUntil: Date?) {
        self.isMuted = isMuted
        self.mutedUntil = mutedUntil
    }

    /// Mirrors the predicate the server applies, so a quiet period that runs
    /// out while the screen is open stops reading as quiet on the next render
    /// instead of waiting for a reload.
    public func isQuiet(at moment: Date) -> Bool {
        guard isMuted else { return false }
        guard let mutedUntil else { return true }
        return mutedUntil > moment
    }
}
