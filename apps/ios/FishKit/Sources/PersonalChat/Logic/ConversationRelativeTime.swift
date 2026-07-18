import Foundation

public struct ConversationRelativeTime: Equatable, Sendable {
    public let shortLabel: String
    public let accessibilityLabel: String

    public static func make(from date: Date, relativeTo now: Date) -> Self {
        let elapsed = max(0, Int(now.timeIntervalSince(date)))
        if elapsed < 60 {
            return Self(shortLabel: "Now", accessibilityLabel: "Now")
        }
        if elapsed < 3_600 {
            let minutes = elapsed / 60
            return Self(
                shortLabel: "\(minutes)m",
                accessibilityLabel: "\(minutes) minute\(minutes == 1 ? "" : "s") ago"
            )
        }
        if elapsed < 86_400 {
            let hours = elapsed / 3_600
            return Self(
                shortLabel: "\(hours)h",
                accessibilityLabel: "\(hours) hour\(hours == 1 ? "" : "s") ago"
            )
        }
        let days = elapsed / 86_400
        return Self(
            shortLabel: "\(days)d",
            accessibilityLabel: "\(days) day\(days == 1 ? "" : "s") ago"
        )
    }
}
