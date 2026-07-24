import DesignSystem
import SwiftUI
import UIComponents

/// Conversation-owned details destination. The participant identity remains
/// separate from the one approved Shared content row, and hosts may append
/// existing safety actions without widening this feature's scope.
public struct ConversationDetailsSheet: View {
    private let participantName: String
    private let presence: PresenceUiModel?
    private let onBack: () -> Void
    private let onOpenSharedContent: () -> Void
    private let safetyContent: AnyView?
    @Binding private var requestedFocus: PersonalChatFocusTarget?
    @AccessibilityFocusState private var sharedContentFocused: Bool

    public init(
        participantName: String,
        presence: PresenceUiModel?,
        onBack: @escaping () -> Void,
        onOpenSharedContent: @escaping () -> Void,
        safetyContent: AnyView? = nil,
        requestedFocus: Binding<PersonalChatFocusTarget?> = .constant(nil)
    ) {
        self.participantName = participantName
        self.presence = presence
        self.onBack = onBack
        self.onOpenSharedContent = onOpenSharedContent
        self.safetyContent = safetyContent
        self._requestedFocus = requestedFocus
    }

    public var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "Conversation details", onBack: onBack)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    participantIdentity
                    sharedContentRow
                    if let safetyContent {
                        safetyContent
                    }
                }
                .padding(Spacing.page)
                .frame(maxWidth: Metrics.chatContentMaxWidth)
                .frame(maxWidth: .infinity, alignment: .top)
            }
        }
        .background(Palette.bg)
        .onChange(of: requestedFocus) { _, target in
            guard target == .detailsSharedContent else { return }
            sharedContentFocused = true
            requestedFocus = nil
        }
    }

    private var participantIdentity: some View {
        HStack(spacing: Spacing.sm) {
            Avatar(name: participantName, size: .profile)
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(participantName)
                    .textStyle(.heading)
                    .foregroundStyle(Palette.foreground)
                    .fixedSize(horizontal: false, vertical: true)
                if let presence {
                    Text(presence.label)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sharedContentRow: some View {
        Button(action: onOpenSharedContent) {
            HStack(spacing: Spacing.sm) {
                Icon.photo.image
                    .glyphFrame()
                    .foregroundStyle(Palette.body)
                Text(SharedContentEntry.conversationDetails.accessibilityLabel)
                    .textStyle(.ui)
                    .foregroundStyle(Palette.foreground)
                Spacer(minLength: Spacing.sm)
                Icon.chevronRight.image
                    .glyphFrame()
                    .foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, Spacing.md)
            .frame(
                maxWidth: .infinity,
                minHeight: SharedContentEntry.conversationDetails.minimumTarget,
                alignment: .leading
            )
            .background(
                Palette.surface,
                in: RoundedRectangle(
                    cornerRadius: Radius.control,
                    style: .continuous
                )
            )
            .contentShape(RoundedRectangle(
                cornerRadius: Radius.control,
                style: .continuous
            ))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            SharedContentEntry.conversationDetails.accessibilityLabel
        )
        .accessibilityIdentifier(
            SharedContentEntry.conversationDetails.accessibilityIdentifier
        )
        .accessibilityFocused($sharedContentFocused)
    }
}
