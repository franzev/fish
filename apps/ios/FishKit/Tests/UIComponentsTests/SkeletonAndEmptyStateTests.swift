import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct SkeletonAndEmptyStateTests {
    @MainActor @Test func skeletonSnapshots() {
        let states = VStack(alignment: .leading, spacing: Spacing.md) {
            HStack(spacing: Spacing.xs) {
                SkeletonAvatar(size: .sm)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SkeletonBar(width: Metrics.skeletonAuthorWidth)
                    SkeletonBar()
                }
            }
            SkeletonBar()
        }
        .padding(Spacing.page)
        assertThemedSnapshots(of: states, named: "skeleton-states")
    }

    @MainActor @Test func emptyStateSnapshots() {
        let states = ScrollView {
            VStack(spacing: Spacing.xl) {
                EmptyState(
                    title: "No messages yet",
                    message: "This is the start of your conversation with Sam."
                )
                EmptyState(
                    title: "This conversation isn't available",
                    message: "If you think this is a mistake, tell your coach.",
                    actionLabel: "Go back",
                    onAction: {}
                )
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "empty-states")
        assertAccessibilitySnapshots(of: states, named: "empty-states")
    }
}
