import DesignSystem
import PresenceData
import SwiftUI
import Testing
import TestSupport
import UIComponents
@testable import Presence

/// Visual contract for the presence surfaces: indicator matrix, avatar
/// badges, summary tiers, and every account-sheet page — light/dark plus
/// AX-XL and RTL where layout can shift.
@MainActor
struct PresenceSurfaceSnapshotTests {
    private static let formatter = PresenceFormatter(
        locale: Locale(identifier: "en_US"),
        calendar: Calendar(identifier: .gregorian),
        timeZone: TimeZone(identifier: "UTC")!
    )

    private func page(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            content()
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.bg)
    }

    @Test func indicatorMatrix() {
        let view = page {
            ForEach(PresenceDisplayStatus.allCases, id: \.self) { status in
                HStack(spacing: Spacing.sm) {
                    PresenceIndicator(
                        status: status,
                        label: PresenceFormatter.label(for: status),
                        isDecorative: false
                    )
                    Text(PresenceFormatter.label(for: status))
                        .textStyle(.ui)
                        .foregroundStyle(Palette.body)
                }
            }
        }
        assertThemedSnapshots(of: view, named: "presence-indicators")
    }

    @Test func avatarBadges() {
        let view = page {
            HStack(spacing: Spacing.md) {
                PresenceAvatar(
                    name: "Sam Rivera",
                    size: .sm,
                    status: .online,
                    statusLabel: "Online"
                )
                PresenceAvatar(
                    name: "Sam Rivera",
                    size: .md,
                    status: .busy,
                    statusLabel: "Do not disturb"
                )
                PresenceAvatar(
                    name: "Maya Chen",
                    size: .md,
                    status: .offline,
                    statusLabel: "Offline"
                )
            }
        }
        assertThemedSnapshots(of: view, named: "presence-avatars")
    }

    @Test func summaryTiers() {
        let now = ISO8601DateFormatter().date(from: "2026-07-16T15:00:00Z")!
        let snapshots: [(String, PresenceSnapshot?)] = [
            ("online", PresenceFixtures.snapshot(status: .online)),
            ("offline-minutes", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: "2026-07-16T14:35:00Z"
            )),
            ("offline-yesterday", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: "2026-07-15T09:00:00Z"
            )),
            ("offline-date", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: "2026-07-05T12:00:00Z"
            )),
            ("sanitized", PresenceFixtures.snapshot(
                status: .offline,
                lastHeartbeatAt: nil,
                lastSeenAt: nil
            )),
        ]
        let view = page {
            ForEach(snapshots, id: \.0) { _, snapshot in
                let presentation = Self.formatter.format(snapshot, now: now)
                PresenceSummary(
                    status: presentation.status,
                    label: presentation.label,
                    detail: presentation.detail
                )
            }
        }
        assertThemedSnapshots(of: view, named: "presence-summaries")
        assertAccessibilitySnapshots(of: view, named: "presence-summaries")
    }

    // MARK: - Account sheet pages

    private func makeModel(
        state: PresenceState
    ) async -> (PresenceModel, Task<Void, Never>) {
        let repository = ScriptedPresenceRepository(initial: state)
        let model = PresenceModel(
            repository: repository,
            formatter: Self.formatter,
            now: { ISO8601DateFormatter().date(from: "2026-07-16T15:00:00Z")! },
            ticks: { AsyncStream { _ in } }
        )
        let runner = Task { await model.start() }
        _ = await eventually { await model.uiState.currentUserId != nil }
        return (model, runner)
    }

    private func connectedState(
        preference: PresencePreferenceSetting = PresencePreferenceSetting(),
        connection: PresenceConnectionState = .connected
    ) -> PresenceState {
        PresenceState(
            currentUserId: PresenceFixtures.selfId,
            snapshots: [
                PresenceFixtures.selfId: PresenceFixtures.snapshot(
                    userId: PresenceFixtures.selfId
                ),
            ],
            ownPreference: preference,
            preferenceRevision: 1,
            connection: connection
        )
    }

    @Test func accountSheetPages() async {
        let (model, runner) = await makeModel(state: connectedState())
        defer { runner.cancel() }

        let account = PresenceAccountSheet(
            model: model,
            displayName: "Maya Chen",
            onSignOut: {},
            initialPage: .account
        )
        assertThemedSnapshots(of: account, named: "sheet-account")
        assertAccessibilitySnapshots(of: account, named: "sheet-account")

        let status = PresenceAccountSheet(
            model: model,
            displayName: "Maya Chen",
            onSignOut: {},
            initialPage: .status
        )
        assertThemedSnapshots(of: status, named: "sheet-status")

        let duration = PresenceAccountSheet(
            model: model,
            displayName: "Maya Chen",
            onSignOut: {},
            initialPage: .duration,
            pendingPreference: .busy
        )
        assertThemedSnapshots(of: duration, named: "sheet-duration")
    }

    @Test func accountSheetBusySelectionAndReconnecting() async {
        let (model, runner) = await makeModel(
            state: connectedState(
                preference: PresencePreferenceSetting(preference: .busy),
                connection: .disconnected
            )
        )
        defer { runner.cancel() }

        let status = PresenceAccountSheet(
            model: model,
            displayName: "Maya Chen",
            onSignOut: {},
            initialPage: .status
        )
        assertThemedSnapshots(of: status, named: "sheet-status-busy-reconnecting")
    }
}
