import FriendsData
import PersonalChat
import Testing

/// Snapshots never call a command, so a fixed failure is a safe, inert stand-in.
private actor UncalledFriendCommands: FriendCommandsProviding {
    func sendRequest(
        targetId: String,
        clientRequestId: String
    ) async throws -> FriendRequestOutcome {
        fatalError("not called by a snapshot")
    }

    func respondRequest(
        requestId: String,
        response: FriendRequestResponse
    ) async throws -> FriendRequestOutcome {
        fatalError("not called by a snapshot")
    }

    func blockUser(targetId: String) async throws {
        fatalError("not called by a snapshot")
    }

    func reportUser(targetId: String) async throws {
        fatalError("not called by a snapshot")
    }
}

@MainActor
struct ConversationSafetySnapshotTests {
    @Test func entry() {
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam Lee",
            commands: UncalledFriendCommands()
        )
        let view = ConversationSafetyView(model: model)
        assertThemedSnapshots(of: view, named: "conversation-safety-entry")
        assertAccessibilitySnapshots(of: view, named: "conversation-safety-entry")
    }

    @Test func confirmingBlock() {
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam Lee",
            commands: UncalledFriendCommands()
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
            commands: UncalledFriendCommands()
        )
        model.startConfirming(.report)
        let view = ConversationSafetyView(model: model)
        assertThemedSnapshots(of: view, named: "conversation-safety-confirming-report")
        assertAccessibilitySnapshots(of: view, named: "conversation-safety-confirming-report")
    }
}
