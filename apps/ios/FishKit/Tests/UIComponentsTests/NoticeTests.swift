import DesignSystem
import SwiftUI
import Testing
@testable import UIComponents

struct NoticeTests {
    @Test func tonesMapToSemanticIcons() {
        #expect(Notice.Tone.notice.icon == .info)
        #expect(Notice.Tone.warning.icon == .warning)
        #expect(Notice.Tone.error.icon == .alert)
        #expect(Notice.Tone.success.icon == .check)
    }

    @MainActor @Test func snapshots() {
        let states = ScrollView {
            VStack(spacing: Spacing.md) {
                Notice(
                    title: "Reconnecting",
                    message: "Your draft is safe while we reconnect.",
                    tone: .notice
                )
                Notice(
                    title: "That didn't send",
                    message: "Check your connection, then try again.",
                    tone: .error,
                    actionLabel: "Try sending again",
                    onAction: {}
                )
                Notice(
                    title: "Almost at the message limit",
                    message: "Messages can hold 4,000 characters.",
                    tone: .warning
                )
                Notice(title: "Message sent", tone: .success)
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "notice-states")
        assertAccessibilitySnapshots(of: states, named: "notice-states")
    }
}
