import ChatCore
import Testing

/// `shouldShowChatSplitLayout` decides whether `ChatSplitLayout` shows its
/// conversation rail. Pinned directly as a pure function — no SwiftUI
/// harness needed — mirroring Android's `ChatAdaptiveLayout` gate
/// (`maxWidth >= twoPaneBreakpoint && model.conversations.size > 1`).
struct ChatSplitLayoutDecisionTests {
    @Test func splitsOnRegularWidthWithMultipleConversations() {
        #expect(shouldShowChatSplitLayout(isRegularWidth: true, conversationCount: 2) == true)
    }

    @Test func staysSinglePaneOnCompactWidthEvenWithMultipleConversations() {
        // iPhone, or iPad split-screen narrow — compact width keeps today's
        // single-pane behavior untouched regardless of conversation count.
        #expect(shouldShowChatSplitLayout(isRegularWidth: false, conversationCount: 5) == false)
    }

    @Test func staysSinglePaneOnRegularWidthWithOneConversation() {
        // A rail showing exactly one conversation is sparse for zero
        // navigational benefit — don't split until there's an actual choice.
        #expect(shouldShowChatSplitLayout(isRegularWidth: true, conversationCount: 1) == false)
    }

    @Test func staysSinglePaneOnRegularWidthWithNoConversations() {
        #expect(shouldShowChatSplitLayout(isRegularWidth: true, conversationCount: 0) == false)
    }

    @Test func splitsWithManyConversationsOnRegularWidth() {
        #expect(shouldShowChatSplitLayout(isRegularWidth: true, conversationCount: 12) == true)
    }
}
