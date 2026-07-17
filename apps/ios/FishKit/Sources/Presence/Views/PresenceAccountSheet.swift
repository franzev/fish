import DesignSystem
import PresenceData
import SwiftUI
import UIComponents

/// The account/status/duration drill-down — the web user menu's flow on one
/// sheet. Automatic applies immediately; Away, Do not disturb, and Invisible
/// ask for a duration first. A confirmed change dismisses the sheet; a
/// failure keeps it open with the calm notice.
public struct PresenceAccountSheet: View {
    private struct StatusChoice: Identifiable {
        let preference: PresencePreference
        let status: PresenceDisplayStatus
        let label: String
        let detail: String
        var id: PresencePreference { preference }
    }

    private struct DurationChoice: Identifiable {
        let duration: PresenceDuration
        let label: String
        var id: PresenceDuration { duration }
    }

    enum Page {
        case account
        case status
        case duration
    }

    private static let statusChoices: [StatusChoice] = [
        StatusChoice(
            preference: .automatic,
            status: .online,
            label: "Online",
            detail: "Automatic while you use FISH."
        ),
        StatusChoice(
            preference: .away,
            status: .away,
            label: "Away",
            detail: "Show that you're away."
        ),
        StatusChoice(
            preference: .busy,
            status: .busy,
            label: "Do not disturb",
            detail: "Show others that you don't want interruptions."
        ),
        StatusChoice(
            preference: .invisible,
            status: .invisible,
            label: "Invisible",
            detail: "Appear offline."
        ),
    ]

    private static let durationChoices: [DurationChoice] = [
        DurationChoice(duration: .fifteenMinutes, label: "15 minutes"),
        DurationChoice(duration: .oneHour, label: "1 hour"),
        DurationChoice(duration: .eightHours, label: "8 hours"),
        DurationChoice(duration: .oneDay, label: "24 hours"),
        DurationChoice(duration: .threeDays, label: "3 days"),
        DurationChoice(duration: .forever, label: "Forever"),
    ]

    private let model: PresenceModel
    private let displayName: String
    private let onSignOut: () -> Void

    @State private var page = Page.account
    @State private var pendingStatus: StatusChoice?
    @Environment(\.dismiss) private var dismiss

    public init(
        model: PresenceModel,
        displayName: String,
        onSignOut: @escaping () -> Void
    ) {
        self.model = model
        self.displayName = displayName
        self.onSignOut = onSignOut
    }

    /// Snapshot-test entry: opens on a specific page.
    init(
        model: PresenceModel,
        displayName: String,
        onSignOut: @escaping () -> Void,
        initialPage: Page,
        pendingPreference: PresencePreference? = nil
    ) {
        self.model = model
        self.displayName = displayName
        self.onSignOut = onSignOut
        _page = State(initialValue: initialPage)
        _pendingStatus = State(initialValue: pendingPreference.flatMap { pending in
            Self.statusChoices.first { $0.preference == pending }
        })
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                switch page {
                case .account: accountPage
                case .status: statusPage
                case .duration: durationPage
                }
            }
            .padding(Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.surface)
        .onChange(of: model.confirmations) {
            dismiss()
        }
    }

    // MARK: - Pages

    @ViewBuilder private var accountPage: some View {
        HStack(spacing: Spacing.sm) {
            PresenceAvatar(
                name: displayName,
                size: .md,
                status: model.uiState.own.status,
                statusLabel: model.uiState.own.label
            )
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                Text(displayName)
                    .textStyle(.label)
                    .foregroundStyle(Palette.foreground)
                Text(model.uiState.own.label)
                    .textStyle(.caption)
                    .foregroundStyle(Palette.muted)
            }
        }
        .padding(.bottom, Spacing.xs)

        reconnectingNotice

        sheetRow(action: { page = .status }) {
            PresenceIndicator(
                status: model.uiState.own.status,
                label: model.uiState.own.label,
                isDecorative: false
            )
            Text("Status")
                .textStyle(.ui)
                .foregroundStyle(Palette.foreground)
            Spacer(minLength: Spacing.sm)
            Text(model.uiState.own.label)
                .textStyle(.ui)
                .foregroundStyle(Palette.body)
                .lineLimit(1)
        }

        ActionButton("Sign out", variant: .ghost, fullWidth: true) {
            onSignOut()
        }
    }

    @ViewBuilder private var statusPage: some View {
        backRow("Back to account") { page = .account }
        ForEach(Self.statusChoices) { choice in
            let isCurrent = model.uiState.ownPreference.preference == choice.preference
            sheetRow(
                selected: isCurrent,
                action: { choose(choice) }
            ) {
                PresenceIndicator(
                    status: choice.status,
                    label: choice.label,
                    isDecorative: false
                )
                VStack(alignment: .leading, spacing: Spacing.threeXs) {
                    Text(choice.label)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                    Text(choice.detail)
                        .textStyle(.caption)
                        .foregroundStyle(Palette.body)
                }
                Spacer(minLength: 0)
            }
            .accessibilityAddTraits(isCurrent ? .isSelected : [])
        }
        statusFooter
    }

    @ViewBuilder private var durationPage: some View {
        backRow("Back to status") { page = .status }
        if let pendingStatus {
            Text("Show \(pendingStatus.label.lowercased()) for:")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .padding(.horizontal, Spacing.xs)
            ForEach(Self.durationChoices) { choice in
                sheetRow(action: { choose(duration: choice.duration) }) {
                    Text(choice.label)
                        .textStyle(.ui)
                        .foregroundStyle(Palette.foreground)
                    Spacer(minLength: 0)
                }
            }
        }
        statusFooter
    }

    // MARK: - Shared pieces

    @ViewBuilder private var statusFooter: some View {
        if model.uiState.updating {
            Text("Updating status…")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .padding(.horizontal, Spacing.xs)
        }
        if let notice = model.uiState.notice {
            Text(notice)
                .textStyle(.ui)
                .foregroundStyle(Palette.notice)
                .padding(.horizontal, Spacing.xs)
        }
        reconnectingNotice
    }

    @ViewBuilder private var reconnectingNotice: some View {
        if model.uiState.currentUserId != nil,
           model.uiState.connection == .disconnected
           || model.uiState.connection == .connecting {
            Notice(
                tone: .notice,
                title: "Status is reconnecting. We'll keep trying."
            )
        }
    }

    private func backRow(_ label: String, action: @escaping () -> Void) -> some View {
        sheetRow(action: action) {
            Icon.back.image
                .glyphFrame()
                .foregroundStyle(Palette.body)
            Text(label)
                .textStyle(.ui)
                .foregroundStyle(Palette.foreground)
            Spacer(minLength: 0)
        }
    }

    private func sheetRow(
        selected: Bool = false,
        action: @escaping () -> Void,
        @ViewBuilder content: () -> some View
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm, content: content)
                .padding(.horizontal, Spacing.xs)
                .padding(.vertical, Spacing.twoXs)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: Metrics.targetTouch)
                .background(
                    selected ? Palette.surface2 : .clear,
                    in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
                .contentShape(
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .disabled(model.uiState.updating)
    }

    // MARK: - Actions

    private func choose(_ choice: StatusChoice) {
        if choice.preference == .automatic {
            model.setPreference(.automatic, for: .forever)
            return
        }
        pendingStatus = choice
        page = .duration
    }

    private func choose(duration: PresenceDuration) {
        guard let pendingStatus else { return }
        model.setPreference(pendingStatus.preference, for: duration)
    }
}
