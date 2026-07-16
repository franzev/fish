import Foundation

/// Same sender, same local calendar day, and no more than a five-minute gap.
public enum MessageGrouping {
    public static let groupGap: TimeInterval = 5 * 60

    public static func belongsToSameGroup(
        previous: MessageUiModel?,
        current: MessageUiModel,
        calendar: Calendar
    ) -> Bool {
        guard let previous, previous.senderId == current.senderId else {
            return false
        }
        guard calendar.isDate(previous.sentAt, inSameDayAs: current.sentAt) else {
            return false
        }
        let elapsed = current.sentAt.timeIntervalSince(previous.sentAt)
        return elapsed >= 0 && elapsed <= groupGap
    }
}
