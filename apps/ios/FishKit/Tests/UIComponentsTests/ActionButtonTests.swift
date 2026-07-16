import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct ActionButtonTests {
    @Test func heightsFollowTargetTokens() {
        #expect(ActionButton.height(for: .primary) == Metrics.controlPrimary)
        #expect(ActionButton.height(for: .secondary) == Metrics.targetTouch)
        #expect(ActionButton.height(for: .ghost) == Metrics.targetTouch)
    }

    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.md) {
            ActionButton("Send message", variant: .primary, fullWidth: true) {}
            ActionButton(
                "Send message",
                variant: .primary,
                isLoading: true,
                fullWidth: true
            ) {}
            ActionButton("Save changes", variant: .secondary) {}
            ActionButton("Cancel", variant: .ghost) {}
            ActionButton("Save changes", variant: .secondary) {}
                .disabled(true)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "button-states")
        assertAccessibilitySnapshots(of: states, named: "button-states")
    }
}
