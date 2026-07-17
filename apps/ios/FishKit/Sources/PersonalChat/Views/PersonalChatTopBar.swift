import DesignSystem
import SwiftUI
import UIComponents

/// Conversation identity with no speculative call or overflow controls. The
/// optional trailing slot hosts the account/status trigger when the host
/// provides one.
public struct PersonalChatTopBar: View {
    private let participantName: String
    private let presence: PresenceUiModel?
    private let onBack: (() -> Void)?
    private let accountContent: AnyView?

    public init(
        participantName: String,
        presence: PresenceUiModel?,
        onBack: (() -> Void)? = nil,
        accountContent: AnyView? = nil
    ) {
        self.participantName = participantName
        self.presence = presence
        self.onBack = onBack
        self.accountContent = accountContent
    }

    public var body: some View {
        TopBar(onBack: onBack) {
            AnyView(
                HStack(spacing: Spacing.sm) {
                    HStack(spacing: Spacing.sm) {
                        Avatar(name: participantName, size: .md)
                        VStack(alignment: .leading, spacing: Spacing.threeXs) {
                            Text(participantName)
                                .textStyle(.label)
                                .foregroundStyle(Palette.foreground)
                                .fixedSize(horizontal: false, vertical: true)
                            if let presence {
                                HStack(spacing: Spacing.nudge) {
                                    PresenceIndicator(
                                        status: presence.tone,
                                        label: presence.label
                                    )
                                    Text(presence.label)
                                        .textStyle(.caption)
                                        .foregroundStyle(Palette.muted)
                                }
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if let accountContent {
                        accountContent
                    }
                }
            )
        }
    }
}
