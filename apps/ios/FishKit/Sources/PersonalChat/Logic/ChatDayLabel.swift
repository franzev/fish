import Foundation

/// Today and Yesterday remain English teaching-product copy. Older dates use
/// the supplied locale's long date format.
public enum ChatDayLabel {
    public static func format(
        _ date: Date,
        now: Date,
        calendar: Calendar,
        locale: Locale
    ) -> String {
        if calendar.isDate(date, inSameDayAs: now) {
            return "Today"
        }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: now),
           calendar.isDate(date, inSameDayAs: yesterday) {
            return "Yesterday"
        }
        return date.formatted(Date.FormatStyle(
            date: .long,
            locale: locale,
            calendar: calendar,
            timeZone: calendar.timeZone
        ))
    }
}
