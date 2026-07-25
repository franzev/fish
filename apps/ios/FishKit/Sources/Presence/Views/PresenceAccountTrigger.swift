import DesignSystem
import SwiftUI
import UIComponents

/// The quiet avatar entry point to the account sheet — one combined
/// accessibility element with a full 44-point target.
public struct PresenceAccountTrigger: View {
    private let displayName: String
    private let presence: PresencePresentation
    private let action: () -> Void

    public init(
        displayName: String,
        presence: PresencePresentation,
        action: @escaping () -> Void
    ) {
        self.displayName = displayName
        self.presence = presence
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            PresenceAvatar(
                name: displayName,
                size: .sm,
                status: presence.status,
                statusLabel: presence.label
            )
            .frame(
                minWidth: Metrics.targetTouch,
                minHeight: Metrics.targetTouch
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(displayName), \(presence.label), account and status")
    }
}
