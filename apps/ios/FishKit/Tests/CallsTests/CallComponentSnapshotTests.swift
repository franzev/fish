import CallData
import DesignSystem
import SwiftUI
import Testing
@testable import Calls

/// Component-level snapshot cases. Each `named:` string matches the
/// `@Preview(name = …)` of its Compose counterpart so the pair can be compared
/// side by side. Whole-surface cases live in CallSurfaceSnapshotTests.
struct CallComponentSnapshotTests {
    private func session(
        _ status: CallLifecycleStatus,
        direction: CallDirection = .outgoing,
        kind: CallKind = .audio,
        muted: Bool = false,
        cameraEnabled: Bool = false
    ) -> CallSessionState {
        CallSessionState(
            callId: "call-1",
            counterpartId: "user-2",
            counterpartName: "Coach Mina",
            kind: kind,
            status: status,
            direction: direction,
            muted: muted,
            cameraEnabled: cameraEnabled,
            expiresAt: "2026-07-17T10:00:45.000Z",
            connectedAt: "2026-07-17T10:00:06.000Z"
        )
    }

    @MainActor @Test func callControlStates() {
        let states = VStack(spacing: Spacing.md) {
            CallControls(
                state: CallPanelState(call: session(.active)),
                actions: CallPanelActions()
            )
            CallControls(
                state: CallPanelState(
                    call: session(.active, kind: .video, muted: true, cameraEnabled: true),
                    busy: true
                ),
                actions: CallPanelActions()
            )
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "call-control-states")
    }

    @MainActor @Test func callActivityStates() {
        let states = VStack(spacing: Spacing.md) {
            CallActivityPanel(state: CallPanelState(call: session(.active)))
            CallActivityPanel(state: CallPanelState(call: session(.active, muted: true)))
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "call-activity-states")
    }

    @MainActor @Test func compactCallBarStates() {
        // CompactCallBar fills its host and bottom-pins its card (so the
        // chat screen behind it shows through the rest); bound each case to
        // a fixed height here so the two states stack cleanly instead of
        // splitting the whole device canvas between them.
        let states = VStack(spacing: Spacing.md) {
            CompactCallBar(
                call: session(.active, kind: .video),
                onReturn: {},
                onEnd: {}
            )
            .frame(height: 160)
            CompactCallBar(
                call: session(.active, muted: true),
                busy: true,
                onReturn: {},
                onEnd: {}
            )
            .frame(height: 160)
        }
        assertThemedSnapshots(of: states, named: "compact-call-bar-states")
    }
}
