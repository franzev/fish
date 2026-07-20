import DesignSystem
import SwiftUI
import UIComponents

public struct AccountSettingsView: View {
    fileprivate enum Page: Hashable {
        case account
        case notifications
        case privacy
        case presence
        case presenceDuration
        case blockedPeople
        case appearance
        case accessibility
    }

    private let displayName: String
    private let presence: AccountSettingsPresence
    private let notificationStatus: AccountNotificationAuthorization
    private let appearance: AccountAppearance
    private let motion: AccountMotionPreference
    private let canManageBlockedPeople: Bool
    private let notice: String?
    private let blockedPeopleState: AccountSettingsBlockedPeopleState
    private let onRefreshNotifications: () -> Void
    private let onAllowNotifications: () -> Void
    private let onOpenNotificationSettings: () -> Void
    private let onSetPresence: (AccountPresenceVisibility, AccountPresenceDuration) -> Void
    private let onLoadBlockedPeople: () -> Void
    private let onUnblock: (String) -> Void
    private let onOpenPrivacyPolicy: () -> Void
    private let onSetAppearance: (AccountAppearance) -> Void
    private let onSetMotion: (AccountMotionPreference) -> Void
    private let onResetPassword: () -> Void
    private let onSignOut: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var page = Page.account
    @State private var pendingVisibility: AccountPresenceVisibility?

    public init(
        displayName: String,
        presence: AccountSettingsPresence = AccountSettingsPresence(),
        notificationStatus: AccountNotificationAuthorization = .notDetermined,
        appearance: AccountAppearance = .system,
        motion: AccountMotionPreference = .system,
        canManageBlockedPeople: Bool = false,
        notice: String? = nil,
        blockedPeopleState: AccountSettingsBlockedPeopleState = .hidden,
        onRefreshNotifications: @escaping () -> Void = {},
        onAllowNotifications: @escaping () -> Void = {},
        onOpenNotificationSettings: @escaping () -> Void = {},
        onSetPresence: @escaping (AccountPresenceVisibility, AccountPresenceDuration) -> Void = { _, _ in },
        onLoadBlockedPeople: @escaping () -> Void = {},
        onUnblock: @escaping (String) -> Void = { _ in },
        onOpenPrivacyPolicy: @escaping () -> Void = {},
        onSetAppearance: @escaping (AccountAppearance) -> Void = { _ in },
        onSetMotion: @escaping (AccountMotionPreference) -> Void = { _ in },
        onResetPassword: @escaping () -> Void = {},
        onSignOut: @escaping () -> Void
    ) {
        self.displayName = displayName
        self.presence = presence
        self.notificationStatus = notificationStatus
        self.appearance = appearance
        self.motion = motion
        self.canManageBlockedPeople = canManageBlockedPeople
        self.notice = notice
        self.blockedPeopleState = blockedPeopleState
        self.onRefreshNotifications = onRefreshNotifications
        self.onAllowNotifications = onAllowNotifications
        self.onOpenNotificationSettings = onOpenNotificationSettings
        self.onSetPresence = onSetPresence
        self.onLoadBlockedPeople = onLoadBlockedPeople
        self.onUnblock = onUnblock
        self.onOpenPrivacyPolicy = onOpenPrivacyPolicy
        self.onSetAppearance = onSetAppearance
        self.onSetMotion = onSetMotion
        self.onResetPassword = onResetPassword
        self.onSignOut = onSignOut
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                header
                if let notice {
                    Notice(tone: .notice, title: notice)
                }
                pageContent
            }
            .padding(.bottom, Spacing.lg)
        }
        .background(Palette.surface)
        .task(id: page) {
            guard page == .blockedPeople else { return }
            onLoadBlockedPeople()
        }
        .onAppear { onRefreshNotifications() }
    }

    private var header: some View {
        TopBar(
            title: page.title,
            onBack: backAction,
            trailing: TopBarAction(
                icon: .close,
                accessibilityLabel: "Close",
                action: { dismiss() }
            )
        )
    }

    private var backAction: (() -> Void)? {
        guard page != .account else { return nil }
        return { goBack() }
    }

    @ViewBuilder private var pageContent: some View {
        switch page {
        case .account: accountPage
        case .notifications: notificationsPage
        case .privacy: privacyPage
        case .presence: presencePage
        case .presenceDuration: presenceDurationPage
        case .blockedPeople: blockedPeoplePage
        case .appearance: appearancePage
        case .accessibility: accessibilityPage
        }
    }

    private var accountPage: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Avatar(name: displayName, size: .md, isDecorative: false)
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(displayName)
                        .textStyle(.label)
                        .foregroundStyle(Palette.foreground)
                    Text(presence.label)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.muted)
                }
            }
            .padding(.horizontal, Spacing.page)
            .padding(.vertical, Spacing.sm)

            SettingsRow(
                label: "Notifications",
                trailing: notificationStatus.rootLabel,
                action: { page = .notifications }
            )
            SettingsRow(
                label: "Privacy",
                explanation: "Presence and blocked people",
                action: { page = .privacy }
            )
            SettingsRow(
                label: "Appearance",
                trailing: appearance.label,
                action: { page = .appearance }
            )
            SettingsRow(
                label: "Accessibility",
                trailing: motion.label,
                action: { page = .accessibility }
            )
            SettingsRow(
                label: "Reset password",
                explanation: "Opens the secure FISH website",
                action: onResetPassword
            )

            ActionButton("Sign out", variant: .ghost, fullWidth: true, action: onSignOut)
                .padding(.top, Spacing.lg)
                .padding(.horizontal, Spacing.page)
        }
    }

    private var notificationsPage: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(notificationStatus.statusCopy)
                .textStyle(.body)
                .foregroundStyle(Palette.body)
            Text("Message alerts show who sent them, but not the message.")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
            Text("Your iPhone controls previews, sounds, and delivery.")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
            ActionButton(
                notificationStatus.requiresPrompt
                    ? "Allow notifications"
                    : "Open notification settings",
                variant: .primary,
                fullWidth: true,
                action: notificationStatus.requiresPrompt
                    ? onAllowNotifications
                    : onOpenNotificationSettings
            )
        }
        .padding(.horizontal, Spacing.page)
    }

    private var privacyPage: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            SettingsRow(
                label: "Presence visibility",
                action: { page = .presence }
            )
            if canManageBlockedPeople {
                SettingsRow(
                    label: "Blocked people",
                    action: { page = .blockedPeople }
                )
            }
            SettingsRow(label: "Privacy policy", action: onOpenPrivacyPolicy)
            SettingsRow(
                label: "Notifications",
                explanation: "Message alerts show who sent them, but not the message.",
                action: { page = .notifications }
            )
        }
        .padding(.horizontal, Spacing.page)
    }

    private var presencePage: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            ForEach(AccountPresenceVisibility.allCases, id: \.self) { visibility in
                SettingsRow(
                    label: visibility.label,
                    explanation: visibility.explanation,
                    selected: presence.visibility == visibility,
                    enabled: !presence.updating,
                    showsChevron: false,
                    action: { choose(visibility) }
                )
            }
            presenceNotice
        }
        .padding(.horizontal, Spacing.page)
    }

    private var presenceDurationPage: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            if let pendingVisibility {
                Text("Show \(pendingVisibility.label.lowercased()) for:")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .padding(.horizontal, Spacing.xs)
                    .padding(.bottom, Spacing.xs)
            }
            ForEach(AccountPresenceDuration.allCases, id: \.self) { duration in
                SettingsRow(
                    label: duration.label,
                    enabled: !presence.updating,
                    showsChevron: false,
                    action: { choose(duration) }
                )
            }
            presenceNotice
        }
        .padding(.horizontal, Spacing.page)
    }

    @ViewBuilder private var presenceNotice: some View {
        if presence.updating {
            Text("Updating status…")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .padding(.horizontal, Spacing.xs)
        }
        if let notice = presence.notice {
            Notice(tone: .notice, title: notice)
        }
    }

    private var blockedPeoplePage: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Unblocking does not restore a relationship or conversation.")
                .textStyle(.body)
                .foregroundStyle(Palette.body)

            switch blockedPeopleState {
            case .hidden, .loading:
                Text("Loading blocked people…")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .padding(.vertical, Spacing.md)
            case .failed:
                Notice(
                    tone: .notice,
                    title: "Blocked people aren’t available yet. Try again."
                )
                ActionButton("Try again", variant: .secondary, fullWidth: true, action: onLoadBlockedPeople)
            case .loaded(let people, let busyIds, let notice):
                if let notice {
                    Notice(tone: .success, title: notice)
                }
                if people.isEmpty {
                    Text("No one is blocked right now.")
                        .textStyle(.body)
                        .foregroundStyle(Palette.body)
                        .padding(.vertical, Spacing.md)
                } else {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        ForEach(people) { person in
                            SettingsRow(
                                label: person.displayName,
                                explanation: person.username.map { "@\($0)" },
                                trailing: busyIds.contains(person.userId)
                                    ? "Unblocking…"
                                    : "Unblock",
                                enabled: !busyIds.contains(person.userId),
                                showsChevron: false,
                                action: { onUnblock(person.userId) }
                            )
                        }
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.page)
    }

    private var appearancePage: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            ForEach(AccountAppearance.allCases, id: \.self) { choice in
                SettingsRow(
                    label: choice.label,
                    selected: appearance == choice,
                    showsChevron: false,
                    action: { onSetAppearance(choice) }
                )
            }
        }
        .padding(.horizontal, Spacing.page)
    }

    private var accessibilityPage: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("System follows your device accessibility settings.")
                .textStyle(.body)
                .foregroundStyle(Palette.body)
            ForEach(AccountMotionPreference.allCases, id: \.self) { choice in
                SettingsRow(
                    label: choice.label,
                    selected: motion == choice,
                    showsChevron: false,
                    action: { onSetMotion(choice) }
                )
            }
        }
        .padding(.horizontal, Spacing.page)
    }

    private func goBack() {
        page = switch page {
        case .account: .account
        case .notifications, .privacy, .appearance, .accessibility: .account
        case .presence, .blockedPeople: .privacy
        case .presenceDuration: .presence
        }
    }

    private func choose(_ visibility: AccountPresenceVisibility) {
        guard !presence.updating else { return }
        if visibility == .automatic {
            onSetPresence(.automatic, .forever)
        } else {
            pendingVisibility = visibility
            page = .presenceDuration
        }
    }

    private func choose(_ duration: AccountPresenceDuration) {
        guard let pendingVisibility else { return }
        onSetPresence(pendingVisibility, duration)
    }
}

fileprivate extension AccountSettingsView.Page {
    var title: String {
        switch self {
        case .account: "Account settings"
        case .notifications: "Notifications"
        case .privacy: "Privacy"
        case .presence: "Presence visibility"
        case .presenceDuration: "Presence duration"
        case .blockedPeople: "Blocked people"
        case .appearance: "Appearance"
        case .accessibility: "Accessibility"
        }
    }
}

private struct SettingsRow: View {
    let label: String
    let explanation: String?
    let trailing: String?
    let selected: Bool
    let enabled: Bool
    let showsChevron: Bool
    let action: () -> Void

    init(
        label: String,
        explanation: String? = nil,
        trailing: String? = nil,
        selected: Bool = false,
        enabled: Bool = true,
        showsChevron: Bool = true,
        action: @escaping () -> Void
    ) {
        self.label = label
        self.explanation = explanation
        self.trailing = trailing
        self.selected = selected
        self.enabled = enabled
        self.showsChevron = showsChevron
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(label)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                    if let explanation {
                        Text(explanation)
                            .textStyle(.caption)
                            .foregroundStyle(Palette.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: Spacing.xs)
                if let trailing {
                    Text(trailing)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                        .multilineTextAlignment(.trailing)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if selected { selectionMark }
                if showsChevron {
                    Icon.chevronRight.image
                        .glyphFrame()
                        .foregroundStyle(Palette.muted)
                }
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.twoXs)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: Metrics.targetTouch)
            .background(
                selected ? Palette.surface2 : .clear,
                in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : Opacity.focus)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var selectionMark: some View {
        ZStack {
            Circle()
                .stroke(Palette.body, lineWidth: 1)
                .frame(width: Metrics.iconGlyph, height: Metrics.iconGlyph)
            if selected {
                Circle()
                    .fill(Palette.foreground)
                    .frame(width: Spacing.sm, height: Spacing.sm)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview("Account settings") {
    AccountSettingsView(
        displayName: "Alex Rivera",
        presence: AccountSettingsPresence(visibility: .automatic),
        notificationStatus: .authorized,
        appearance: .system,
        motion: .system,
        canManageBlockedPeople: true,
        onSignOut: {}
    )
}
