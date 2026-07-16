import DesignSystem
import Foundation

public enum MessageAccessibility {
    public static func label(
        for row: MessageRowUiModel,
        locale: Locale = .current,
        timeZone: TimeZone = .current
    ) -> String {
        let sender = row.message.direction == .outgoing
            ? "You"
            : row.message.senderName
        let time = row.message.sentAt.formatted(Date.FormatStyle(
            time: .shortened,
            locale: locale,
            timeZone: timeZone
        ))
        var label = "\(sender), \(time): \(row.message.body)"
        if row.showsDeliveryStatus, let delivery = row.message.delivery {
            label += " \(MessageDeliveryPresentation.statusText(delivery))."
        }
        return label
    }
}

public enum MessageDeliveryPresentation {
    public static func statusText(_ status: MessageDeliveryStatus) -> String {
        switch status {
        case .sending: "Sending…"
        case .sent: "Sent"
        case .delivered: "Delivered"
        case .read: "Read"
        case .failed: "Not sent"
        }
    }

    public static func icon(_ status: MessageDeliveryStatus) -> Icon? {
        switch status {
        case .sending: nil
        case .sent: .check
        case .delivered, .read: .checkDouble
        case .failed: .alert
        }
    }
}
