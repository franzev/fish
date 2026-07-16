import DesignSystem
import SwiftUI
import TestSupport
import Testing
@testable import PersonalChat

struct PersonalChatScreenTests {
    @Test func composerStateDerivesFromConnectionAndSendingMessages() {
        #expect(PersonalChatScreen.composerState(
            for: PersonalChatFixtures.loaded
        ) == .ready)
        #expect(PersonalChatScreen.composerState(
            for: PersonalChatFixtures.offline
        ) == .offline)
        #expect(PersonalChatScreen.composerState(
            for: PersonalChatFixtures.sending
        ) == .sending)
    }

    @MainActor @Test func screenStateMatrixSnapshots() {
        let fixtures: [(String, PersonalChatUiModel, String)] = [
            ("loading", PersonalChatFixtures.loading, ""),
            ("empty", PersonalChatFixtures.empty, ""),
            ("loaded", PersonalChatFixtures.loaded, ""),
            ("unread", PersonalChatFixtures.unread, ""),
            ("loading-earlier", PersonalChatFixtures.loadingEarlier, ""),
            ("earlier-failed", PersonalChatFixtures.earlierFailed, ""),
            ("sending", PersonalChatFixtures.sending, ""),
            ("send-failed", PersonalChatFixtures.sendFailed, ""),
            ("reconnecting", PersonalChatFixtures.reconnecting, ""),
            (
                "offline",
                PersonalChatFixtures.offline,
                "Draft that survives going offline."
            ),
            ("typing", PersonalChatFixtures.typing, ""),
            ("long-content", PersonalChatFixtures.longContent, ""),
            ("unavailable", PersonalChatFixtures.unavailable, ""),
        ]

        for (name, model, draft) in fixtures {
            assertThemedSnapshots(
                of: screen(model: model, draft: draft),
                named: "screen-\(name)"
            )
        }
        assertAccessibilitySnapshots(
            of: screen(model: PersonalChatFixtures.loaded, draft: ""),
            named: "screen-loaded"
        )
    }

    @MainActor
    private func screen(
        model: PersonalChatUiModel,
        draft: String
    ) -> some View {
        PersonalChatScreen(
            model: model,
            draft: .constant(draft),
            context: PersonalChatFixtures.context,
            onSend: {},
            onRetryMessage: { _ in },
            onRetryOlder: {},
            onBack: {}
        )
    }
}
