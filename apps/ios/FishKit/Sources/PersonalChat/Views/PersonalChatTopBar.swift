import DesignSystem
import SwiftUI
import UIComponents

/// Conversation identity with no speculative call or overflow controls.
public struct PersonalChatTopBar: View {
    private let participantName: String
    private let presence: PresenceUiModel?
    private let onBack: (() -> Void)?

    public init(
        participantName: String,
        presence: PresenceUiModel?,
        onBack: (() -> Void)? = nil
    ) {
        self.participantName = participantName
        self.presence = presence
        self.onBack = onBack
    }

    public var body: some View {
        TopBar(onBack: onBack) {
            AnyView(
                HStack(spacing: Spacing.sm) {
                    Avatar(name: participantName, size: .md)
                    VStack(alignment: .leading, spacing: Spacing.threeXs) {
                        Text(participantName)
                            .textStyle(.label)
                            .foregroundStyle(Palette.foreground)
                            .fixedSize(horizontal: false, vertical: true)
                        if let presence {
                            HStack(spacing: Spacing.nudge) {
                                Circle()
                                    .fill(presence.tone.color)
                                    .frame(
                                        width: Spacing.nudge,
                                        height: Spacing.nudge
                                    )
                                Text(presence.label)
                                    .textStyle(.caption)
                                    .foregroundStyle(Palette.muted)
                            }
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            )
        }
    }
}

extension PresenceTone {
    fileprivate var color: Color {
        switch self {
        case .online: Palette.presenceOnline
        case .idle: Palette.presenceIdle
        case .away: Palette.presenceAway
        case .busy: Palette.presenceBusy
        case .offline: Palette.presenceOffline
        }
    }
}
