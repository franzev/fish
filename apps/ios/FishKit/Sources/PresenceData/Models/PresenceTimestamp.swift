import Foundation

/// Lenient ISO-8601 parsing for the presence wire format. Postgres emits
/// microsecond fractions ("2026-07-17T05:01:47.264167+00:00"), which
/// `ISO8601DateFormatter` only accepts after trimming to milliseconds.
public enum PresenceTimestamp {
    public static func parse(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        let plain = ISO8601DateFormatter()
        if let date = plain.date(from: value) { return date }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        if let trimmed = trimmedToMilliseconds(value),
           let date = fractional.date(from: trimmed) {
            return date
        }
        return nil
    }

    private static func trimmedToMilliseconds(_ value: String) -> String? {
        guard let dotIndex = value.firstIndex(of: ".") else { return nil }
        let fractionStart = value.index(after: dotIndex)
        guard let fractionEnd = value[fractionStart...].firstIndex(where: {
            !$0.isNumber
        }) else { return nil }
        let fraction = value[fractionStart..<fractionEnd].prefix(3)
        guard !fraction.isEmpty else { return nil }
        return value[..<dotIndex] + "." + fraction + value[fractionEnd...]
    }
}
