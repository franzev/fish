import Foundation
import PresenceData
import UIComponents

/// Pure presentation rules — the port of the web `getPresencePresentation`
/// and Android's `PresenceFormatter`. The owner's manual preference wins
/// while unexpired; a non-offline snapshot whose heartbeat is missing or
/// older than 90 seconds renders offline (the backend coalesces heartbeats
/// for up to 60 seconds, so the threshold must stay at 90); last-seen copy
/// appears only for offline subjects with an unsanitized timestamp.
public struct PresenceFormatter: Sendable {
    private let locale: Locale
    private let calendar: Calendar
    private let timeZone: TimeZone

    public init(
        locale: Locale = .current,
        calendar: Calendar = .current,
        timeZone: TimeZone = .current
    ) {
        self.locale = locale
        var localized = calendar
        localized.timeZone = timeZone
        localized.locale = locale
        self.calendar = localized
        self.timeZone = timeZone
    }

    // MARK: - Labels

    public static func label(for status: PresenceDisplayStatus) -> String {
        switch status {
        case .online: "Online"
        case .idle: "Idle"
        case .away: "Away"
        case .busy: "Do not disturb"
        case .invisible: "Invisible"
        case .offline: "Offline"
        }
    }

    // MARK: - Subjects

    public func format(_ snapshot: PresenceSnapshot?, now: Date) -> PresencePresentation {
        let status = effectiveStatus(of: snapshot, now: now)
        let detail = status == .offline
            ? snapshot?.lastSeenAt.flatMap { lastSeenCopy($0, now: now) }
            : nil
        return PresencePresentation(
            status: status,
            label: Self.label(for: status),
            detail: detail
        )
    }

    // MARK: - Own status

    /// The owner's display derives preference-first: Away, Do not disturb,
    /// and Invisible show immediately even while the snapshot lags;
    /// Automatic falls through to the snapshot-derived status.
    public func formatOwn(
        snapshot: PresenceSnapshot?,
        preference: PresencePreferenceSetting,
        now: Date
    ) -> PresencePresentation {
        let effective = expired(preference, now: now)
            ? PresencePreferenceSetting()
            : preference
        switch effective.preference {
        case .away:
            return PresencePresentation(status: .away, label: Self.label(for: .away))
        case .busy:
            return PresencePresentation(status: .busy, label: Self.label(for: .busy))
        case .invisible:
            return PresencePresentation(
                status: .invisible,
                label: Self.label(for: .invisible)
            )
        case .automatic:
            return format(snapshot, now: now)
        }
    }

    public func expired(_ preference: PresencePreferenceSetting, now: Date) -> Bool {
        guard let expiresAt = preference.expiresAt,
              let expiry = PresenceTimestamp.parse(expiresAt) else { return false }
        return expiry <= now
    }

    // MARK: - Rules

    private func effectiveStatus(
        of snapshot: PresenceSnapshot?,
        now: Date
    ) -> PresenceDisplayStatus {
        guard let snapshot else { return .offline }
        guard snapshot.status != .offline else { return .offline }
        guard let heartbeat = PresenceTimestamp.parse(snapshot.lastHeartbeatAt),
              heartbeat >= now.addingTimeInterval(-Self.staleSeconds) else {
            return .offline
        }
        switch snapshot.status {
        case .online: return .online
        case .idle: return .idle
        case .away: return .away
        case .busy: return .busy
        case .offline: return .offline
        }
    }

    private func lastSeenCopy(_ value: String, now: Date) -> String? {
        guard let seen = PresenceTimestamp.parse(value) else { return nil }
        let elapsed = max(0, now.timeIntervalSince(seen))
        if elapsed < Self.hourSeconds {
            let minutes = max(1, Int(elapsed / 60))
            return "Last seen \(minutes) \(minutes == 1 ? "minute" : "minutes") ago"
        }
        let sameLocalDay = calendar.isDate(seen, inSameDayAs: now)
        if elapsed < Self.daySeconds, sameLocalDay {
            let hours = max(1, Int(elapsed / Self.hourSeconds))
            return "Last seen \(hours) \(hours == 1 ? "hour" : "hours") ago"
        }
        if isYesterday(seen, relativeTo: now) {
            return "Last seen yesterday at \(timeOfDay(seen))"
        }
        return "Last seen on \(calendarDate(seen))"
    }

    private func isYesterday(_ seen: Date, relativeTo now: Date) -> Bool {
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: seen),
            to: calendar.startOfDay(for: now)
        ).day
        return days == 1
    }

    private func timeOfDay(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(
            date: .omitted,
            time: .shortened,
            locale: locale,
            calendar: calendar,
            timeZone: timeZone
        ))
    }

    private func calendarDate(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(
            date: .abbreviated,
            time: .omitted,
            locale: locale,
            calendar: calendar,
            timeZone: timeZone
        ))
    }

    private static let staleSeconds =
        TimeInterval(PresenceRules.staleAfter.components.seconds)
    private static let hourSeconds: TimeInterval = 3_600
    private static let daySeconds: TimeInterval = 86_400
}
