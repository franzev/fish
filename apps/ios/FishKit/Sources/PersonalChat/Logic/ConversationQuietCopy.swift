import ChatData
import Foundation

/// The words the quiet control uses. Kept apart from the view so the wording
/// can be asserted directly, including the boundary where a quiet period runs
/// past today and a bare clock time would stop being clear.
public enum ConversationQuietCopy {
    public static let rowLabel = "Notifications"
    public static let rowIdentifier = "conversation-details-notifications"
    public static let turnBackOn = "Turn on notifications"
    public static let notificationsOn = "On"
    public static let quietUntilTurnedBackOn = "Quiet until you turn it back on"

    public static func value(
        for mute: ConversationMute,
        now: Date,
        calendar: Calendar = .current,
        locale: Locale = .autoupdatingCurrent
    ) -> String {
        guard mute.isQuiet(at: now) else { return notificationsOn }
        guard let until = mute.mutedUntil else { return quietUntilTurnedBackOn }

        // A bare clock time stops being clear once the quiet period runs past
        // midnight, which the 24-hour option always does. The same calendar
        // decides that and renders it, so the two can never disagree.
        let style = Date.FormatStyle(
            date: calendar.isDate(until, inSameDayAs: now) ? .omitted : .abbreviated,
            time: .shortened,
            locale: locale,
            calendar: calendar,
            timeZone: calendar.timeZone
        )
        return "Quiet until \(until.formatted(style))"
    }
}
