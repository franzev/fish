import DesignSystem
import SwiftUI
import UIComponents

/// The quiet avatar entry point to the account sheet — one combined
/// accessibility element with a full 44-point target.
public struct PresenceAccountTrigger: View {
    private let displayName: String
    private let presentation: PresencePresentation
    private let action: () -> Void

    public init(
        displayName: String,
        presentation: PresencePresentation,
        action: @escaping () -> Void
    ) {
        self.displayName = displayName
        self.presentation = presentation
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            PresenceAvatar(
                name: displayName,
                size: .sm,
                status: presentation.status,
                statusLabel: presentation.label
            )
            .frame(
                minWidth: Metrics.targetTouch,
                minHeight: Metrics.targetTouch
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(displayName), \(presentation.label), account and status")
    }
}
