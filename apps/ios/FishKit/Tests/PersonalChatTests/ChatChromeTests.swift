import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct ChatChromeTests {
    @Test func connectionCopyIsCalmAndDraftPreserving() {
        #expect(ChatConnectionNotice.content(for: .connected) == nil)
        #expect(ChatConnectionNotice.content(for: .connecting)?.title == "Connecting…")
        #expect(ChatConnectionNotice.content(for: .reconnecting)?.message == "Your draft is safe.")
        let offline = ChatConnectionNotice.content(for: .offline)
        #expect(offline?.title == "You're offline")
        #expect(offline?.message == "You can keep writing. Sending will be ready when you reconnect.")
    }

    @MainActor @Test func snapshots() {
        let strip = ScrollView {
            VStack(spacing: Spacing.lg) {
                MessageDaySeparator(label: "Today")
                UnreadMessagesDivider()
                TypingIndicator(name: "Sam Rivera")
                ChatConnectionNotice(state: .offline)
                OlderMessagesSlot(state: .loading, onRetry: {})
                OlderMessagesSlot(state: .failed, onRetry: {})
            }
            .padding(Spacing.page)
        }
        assertThemedSnapshots(of: strip, named: "chat-chrome")
    }
}
