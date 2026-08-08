import Friends
import FriendsData
import Testing

@MainActor
struct ConversationSafetySnapshotTests {
    @Test func entry() {
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam Lee",
            commands: FakeFriendCommands()
        )
        let view = ConversationSafetyView(model: model)
        assertThemedSnapshots(of: view, named: "conversation-safety-entry")
        assertAccessibilitySnapshots(of: view, named: "conversation-safety-entry")
    }

    @Test func confirmingBlock() {
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam Lee",
            commands: FakeFriendCommands()
        )
        model.startConfirming(.block)
        let view = ConversationSafetyView(model: model)
        assertThemedSnapshots(of: view, named: "conversation-safety-confirming-block")
        assertAccessibilitySnapshots(of: view, named: "conversation-safety-confirming-block")
    }

    @Test func confirmingReport() {
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam Lee",
            commands: FakeFriendCommands()
        )
        model.startConfirming(.report)
        let view = ConversationSafetyView(model: model)
        assertThemedSnapshots(of: view, named: "conversation-safety-confirming-report")
        assertAccessibilitySnapshots(of: view, named: "conversation-safety-confirming-report")
    }
}
