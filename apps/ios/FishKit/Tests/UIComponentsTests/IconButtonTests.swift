import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct IconButtonTests {
    @MainActor @Test func snapshots() {
        let states = HStack(spacing: Spacing.md) {
            IconButton(.send, style: .solid, accessibilityLabel: "Send message") {}
            IconButton(
                .send,
                style: .solid,
                accessibilityLabel: "Send message",
                isBusy: true
            ) {}
            IconButton(.back, style: .quiet, accessibilityLabel: "Back") {}
            IconButton(.close, style: .quiet, accessibilityLabel: "Close") {}
                .disabled(true)
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "icon-button-states")
        assertAccessibilitySnapshots(of: states, named: "icon-button-states")
    }
}
