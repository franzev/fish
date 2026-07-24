import DesignSystem
import SwiftUI
import UIComponents

/// Conversation identity with no speculative call or overflow controls. The
/// optional slots host quiet call and account controls when the host provides
/// them.
public struct PersonalChatTopBar: View {
    private let participantName: String
    private let presence: PresenceUiModel?
    private let onBack: (() -> Void)?
    private let onOpenConversationDetails: (() -> Void)?
    private let onOpenSharedContent: (() -> Void)?
    private let trailingContent: AnyView?
    private let accountContent: AnyView?
    @Binding private var requestedFocus: PersonalChatFocusTarget?
    @AccessibilityFocusState private var focusedControl: PersonalChatFocusTarget?

    public init(
        participantName: String,
        presence: PresenceUiModel?,
        onBack: (() -> Void)? = nil,
        onOpenConversationDetails: (() -> Void)? = nil,
        onOpenSharedContent: (() -> Void)? = nil,
        trailingContent: AnyView? = nil,
        accountContent: AnyView? = nil,
        requestedFocus: Binding<PersonalChatFocusTarget?> = .constant(nil)
    ) {
        self.participantName = participantName
        self.presence = presence
        self.onBack = onBack
        self.onOpenConversationDetails = onOpenConversationDetails
        self.onOpenSharedContent = onOpenSharedContent
        self.trailingContent = trailingContent
        self.accountContent = accountContent
        self._requestedFocus = requestedFocus
    }

    public var body: some View {
        TopBar(onBack: onBack) {
            AnyView(
                HStack(spacing: Spacing.sm) {
                    participantIdentity
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if trailingContent != nil
                        || onOpenSharedContent != nil
                        || accountContent != nil {
                        HStack(spacing: Spacing.xs) {
                            if let trailingContent { trailingContent }
                            if let onOpenSharedContent {
                                IconButton(
                                    .photo,
                                    accessibilityLabel:
                                        SharedContentEntry.conversationHeader.accessibilityLabel,
                                    action: onOpenSharedContent
                                )
                                .accessibilityIdentifier(
                                    SharedContentEntry.conversationHeader
                                        .accessibilityIdentifier
                                )
                                .accessibilityFocused(
                                    $focusedControl,
                                    equals: .headerSharedContent
                                )
                            }
                            if let accountContent { accountContent }
                        }
                    }
                }
            )
        }
        .onChange(of: requestedFocus) { _, target in
            guard target == .headerSharedContent
                    || target == .participantDetails
            else { return }
            focusedControl = target
            requestedFocus = nil
        }
    }

    @ViewBuilder private var participantIdentity: some View {
        if let onOpenConversationDetails {
            Button(action: onOpenConversationDetails) {
                participantIdentityContent
                    .frame(
                        minHeight: SharedContentEntry.conversationHeader.minimumTarget,
                        alignment: .leading
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Conversation details")
            .accessibilityFocused(
                $focusedControl,
                equals: .participantDetails
            )
        } else {
            participantIdentityContent
                .accessibilityElement(children: .combine)
        }
    }

    private var participantIdentityContent: some View {
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
    }
}
