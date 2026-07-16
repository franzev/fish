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
                    tone: .notice,
                    title: "Reconnecting",
                    message: "Your draft is safe while we reconnect."
                )
                Notice(
                    tone: .error,
                    title: "That didn't send",
                    message: "Check your connection, then try again.",
                    actionLabel: "Try sending again",
                    onAction: {}
                )
                Notice(
                    tone: .warning,
                    title: "Almost at the message limit",
                    message: "Messages can hold 4,000 characters."
                )
                Notice(tone: .success, title: "Message sent")
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "notice-states")
        assertAccessibilitySnapshots(of: states, named: "notice-states")
    }
}
