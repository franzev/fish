import DesignSystem
import SwiftUI
import Testing
@testable import PersonalChat

struct MessageComposerTests {
    @Test func sendControlVisibility() {
        #expect(!MessageComposer.showsSend(draft: "", sendState: .ready))
        #expect(!MessageComposer.showsSend(draft: "   ", sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "Hello", sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "", sendState: .sending))
        #expect(!MessageComposer.showsSend(draft: "Hello", sendState: .offline))
    }

    @MainActor @Test func snapshots() {
        let states = ScrollView {
            VStack(spacing: Spacing.lg) {
                MessageComposer(
                    draft: .constant(""),
                    sendState: .ready,
                    onSend: {}
                )
                MessageComposer(
                    draft: .constant("I'll try the pausing trick tomorrow."),
                    sendState: .ready,
                    onSend: {}
                )
                MessageComposer(
                    draft: .constant("Sending this one."),
                    sendState: .sending,
                    onSend: {}
                )
                MessageComposer(
                    draft: .constant("Offline draft that must survive."),
                    sendState: .offline,
                    onSend: {}
                )
                MessageComposer(
                    draft: .constant(String(repeating: "a", count: 3_950)),
                    sendState: .ready,
                    onSend: {}
                )
            }
            .padding(.vertical, Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "composer-states")
        assertAccessibilitySnapshots(of: states, named: "composer-states")
    }
}
