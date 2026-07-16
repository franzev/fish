import DesignSystem
import SwiftUI
import Testing
import TestSupport
@testable import PersonalChat

struct MessageComposerTests {
    @Test func sendControlVisibility() {
        #expect(!MessageComposer.showsSend(draft: "", selection: .none, sendState: .ready))
        #expect(!MessageComposer.showsSend(draft: "   ", selection: .none, sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "Hello", selection: .none, sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "", selection: .none, sendState: .sending))
        #expect(!MessageComposer.showsSend(draft: "Hello", selection: .none, sendState: .offline))
    }

    @Test func stagedMediaIsSendableAloneButNotOffline() {
        let gif = PersonalChatFixtures.stagedGif
        let sticker = PersonalChatFixtures.stagedSticker
        #expect(MessageComposer.showsSend(draft: "", selection: gif, sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "", selection: sticker, sendState: .ready))
        #expect(MessageComposer.showsSend(draft: "And text", selection: gif, sendState: .ready))
        #expect(!MessageComposer.showsSend(draft: "", selection: gif, sendState: .offline))
        #expect(!MessageComposer.showsSend(
            draft: String(repeating: "a", count: 4_001),
            selection: gif,
            sendState: .ready
        ))
    }

    @MainActor @Test func snapshots() {
        let states = ScrollView {
            VStack(spacing: Spacing.lg) {
                composer(draft: "")
                composer(draft: "I'll try the pausing trick tomorrow.")
                composer(draft: "Sending this one.", sendState: .sending)
                composer(draft: "Offline draft that must survive.", sendState: .offline)
                composer(draft: String(repeating: "a", count: 3_950))
            }
            .padding(.vertical, Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "composer-states")
        assertAccessibilitySnapshots(of: states, named: "composer-states")
    }

    @MainActor @Test func stagedMediaSnapshots() {
        let states = ScrollView {
            VStack(spacing: Spacing.lg) {
                composer(draft: "", selection: PersonalChatFixtures.stagedSticker)
                composer(
                    draft: "A sticker with a note.",
                    selection: PersonalChatFixtures.stagedSticker
                )
                composer(draft: "", selection: PersonalChatFixtures.stagedGif)
                composer(
                    draft: "This one made me think of you.",
                    selection: PersonalChatFixtures.stagedGif
                )
            }
            .padding(.vertical, Spacing.page)
        }
        assertThemedSnapshots(of: states, named: "composer-staged-media")
        assertAccessibilitySnapshots(of: states, named: "composer-staged-media")
    }

    @MainActor
    private func composer(
        draft: String,
        selection: ComposerSelection = .none,
        sendState: ComposerSendState = .ready
    ) -> some View {
        MessageComposer(
            draft: .constant(draft),
            selection: .constant(selection),
            sendState: sendState,
            onSend: {},
            onOpenMediaPicker: {}
        )
    }
}
