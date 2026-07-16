import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct TopBarTests {
    @MainActor @Test func snapshots() {
        let states = VStack(spacing: Spacing.lg) {
            TopBar(title: "Profile")
            TopBar(title: "Conversation", onBack: {})
            TopBar(
                title: "Conversation",
                onBack: {},
                trailing: TopBarAction(
                    icon: .info,
                    accessibilityLabel: "Conversation details",
                    action: {}
                )
            )
        }
        assertThemedSnapshots(of: states, named: "top-bar-states")
        assertAccessibilitySnapshots(of: states, named: "top-bar-states")
    }
}
