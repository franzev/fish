import FriendsData
import PersonalChat
import Testing

private actor FakeFriendCommands: FriendCommandsProviding {
    enum Outcome: Sendable {
        case success
        case failure(FriendCommandFailure)
    }

    private var blockOutcomes: [Outcome]
    private var reportOutcomes: [Outcome]
    private(set) var blockedTargetIds: [String] = []
    private(set) var reportedTargetIds: [String] = []

    private var reportIsHeld = false
    private var reportGate: CheckedContinuation<Void, Never>?

    init(blockOutcomes: [Outcome] = [], reportOutcomes: [Outcome] = []) {
        self.blockOutcomes = blockOutcomes
        self.reportOutcomes = reportOutcomes
    }

    func sendRequest(
        targetId: String,
        clientRequestId: String
    ) async throws -> FriendRequestOutcome {
        fatalError("ConversationSafetyModel never sends friend requests")
    }

    func respondRequest(
        requestId: String,
        response: FriendRequestResponse
    ) async throws -> FriendRequestOutcome {
        fatalError("ConversationSafetyModel never responds to friend requests")
    }

    func blockUser(targetId: String) async throws {
        blockedTargetIds.append(targetId)
        guard !blockOutcomes.isEmpty else { return }
        if case .failure(let failure) = blockOutcomes.removeFirst() { throw failure }
    }

    func reportUser(targetId: String) async throws {
        reportedTargetIds.append(targetId)
        if reportIsHeld {
            await withCheckedContinuation { reportGate = $0 }
        }
        guard !reportOutcomes.isEmpty else { return }
        if case .failure(let failure) = reportOutcomes.removeFirst() { throw failure }
    }

    /// Parks the next `reportUser` call mid-flight so a test can interleave
    /// other model calls before it resolves.
    func holdReport() { reportIsHeld = true }

    func releaseReport() {
        reportIsHeld = false
        reportGate?.resume()
        reportGate = nil
    }
}

@MainActor
private func eventually(
    _ condition: @escaping @MainActor () -> Bool
) async -> Bool {
    for _ in 0..<100 {
        if condition() { return true }
        try? await Task.sleep(for: .milliseconds(10))
    }
    return condition()
}

@MainActor
struct ConversationSafetyModelTests {
    @Test func reportSucceedsWithACalmNoticeAndReturnsToIdle() async throws {
        let commands = FakeFriendCommands()
        var blocked = false
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam",
            commands: commands,
            onBlocked: { blocked = true }
        )

        model.startConfirming(.report)
        model.confirm()

        let settled = await eventually {
            model.state == .idle(notice: "Thanks — we’ve got your report about Sam.")
        }
        #expect(settled)
        #expect(await commands.reportedTargetIds == ["friend-1"])
        #expect(!blocked)
    }

    @Test func reportFailureStaysOnTheConfirmationWithTheServerNotice() async throws {
        let commands = FakeFriendCommands(
            reportOutcomes: [
                .failure(FriendCommandFailure(code: "friends_unavailable", notice: "Try again shortly.")),
            ]
        )
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam",
            commands: commands
        )

        model.startConfirming(.report)
        model.confirm()

        let settled = await eventually {
            model.state == .confirming(.report, isWorking: false, notice: "Try again shortly.")
        }
        #expect(settled)
    }

    @Test func blockSuccessCallsOnBlockedInsteadOfChangingState() async throws {
        let commands = FakeFriendCommands()
        var blocked = false
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam",
            commands: commands,
            onBlocked: { blocked = true }
        )

        model.startConfirming(.block)
        model.confirm()

        let settled = await eventually { blocked }
        #expect(settled)
        #expect(await commands.blockedTargetIds == ["friend-1"])
    }

    @Test func blockFailureStaysOnTheConfirmationWithoutCallingOnBlocked() async throws {
        let commands = FakeFriendCommands(
            blockOutcomes: [
                .failure(FriendCommandFailure(code: "friends_unavailable", notice: "Try again shortly.")),
            ]
        )
        var blocked = false
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam",
            commands: commands,
            onBlocked: { blocked = true }
        )

        model.startConfirming(.block)
        model.confirm()

        let settled = await eventually {
            model.state == .confirming(.block, isWorking: false, notice: "Try again shortly.")
        }
        #expect(settled)
        #expect(!blocked)
    }

    @Test func cancelConfirmingReturnsToIdleWithoutCallingCommands() async throws {
        let commands = FakeFriendCommands()
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam",
            commands: commands
        )

        model.startConfirming(.block)
        model.cancelConfirming()

        #expect(model.state == .idle())
        #expect(await commands.blockedTargetIds.isEmpty)
    }

    /// Regression test: a report left in flight, backed out of, and replaced
    /// with a fresh Block confirmation must not have its late answer land on
    /// top of that newer confirmation.
    @Test func aStaleReportCompletionDoesNotClobberANewerBlockConfirmation() async throws {
        let commands = FakeFriendCommands()
        await commands.holdReport()
        let model = ConversationSafetyModel(
            targetId: "friend-1",
            targetDisplayName: "Sam",
            commands: commands
        )

        model.startConfirming(.report)
        model.confirm()
        let armed = await eventually { model.state == .confirming(.report, isWorking: true) }
        #expect(armed)

        model.cancelConfirming()
        model.startConfirming(.block)
        #expect(model.state == .confirming(.block, isWorking: false))

        await commands.releaseReport()

        // Give the parked report Task every chance to resume and (before the
        // staleness guard existed) overwrite the newer Block confirmation.
        for _ in 0..<20 {
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(model.state == .confirming(.block, isWorking: false))
        #expect(await commands.reportedTargetIds == ["friend-1"])
    }
}
