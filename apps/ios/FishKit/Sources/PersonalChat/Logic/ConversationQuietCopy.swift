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
        calendar: Calendar = .current
    ) -> String {
        guard mute.isQuiet(at: now) else { return notificationsOn }
        guard let until = mute.mutedUntil else { return quietUntilTurnedBackOn }

        let time = calendar.isDate(until, inSameDayAs: now)
            ? until.formatted(date: .omitted, time: .shortened)
            : until.formatted(date: .abbreviated, time: .shortened)
        return "Quiet until \(time)"
    }
}
