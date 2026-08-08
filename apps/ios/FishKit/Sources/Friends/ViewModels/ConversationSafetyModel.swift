import FriendsData
import Observation

public enum ConversationSafetyAction: Sendable, Equatable {
    case block
    case report
}

public enum ConversationSafetyState: Sendable, Equatable {
    case idle(notice: String? = nil)
    case confirming(ConversationSafetyAction, isWorking: Bool = false, notice: String? = nil)
}

/// Block and report for one conversation participant. Report stays on this
/// state with a calm notice; a successful block hands off to `onBlocked` so
/// the host can leave the now-unavailable conversation.
@MainActor @Observable
public final class ConversationSafetyModel {
    public private(set) var state = ConversationSafetyState.idle()
    public let targetDisplayName: String

    private let targetId: String
    @ObservationIgnored private let commands: any FriendCommandsProviding
    @ObservationIgnored private let onBlocked: () -> Void

    public init(
        targetId: String,
        targetDisplayName: String,
        commands: any FriendCommandsProviding,
        onBlocked: @escaping () -> Void = {}
    ) {
        self.targetId = targetId
        self.targetDisplayName = targetDisplayName
        self.commands = commands
        self.onBlocked = onBlocked
    }

    public func startConfirming(_ action: ConversationSafetyAction) {
        state = .confirming(action)
    }

    public func cancelConfirming() {
        state = .idle()
    }

    public func confirm() {
        guard case .confirming(let action, let isWorking, _) = state, !isWorking else { return }
        state = .confirming(action, isWorking: true)

        Task {
            do {
                switch action {
                case .block:
                    try await commands.blockUser(targetId: targetId)
                    // The confirming screen is gone either way once blocked
                    // (onBlocked leaves the conversation), so no staleness
                    // guard is needed on the success path itself.
                    onBlocked()
                case .report:
                    try await commands.reportUser(targetId: targetId)
                    guard isWorkingOn(action) else { return }
                    state = .idle(
                        notice: "Thanks — we’ve got your report about \(targetDisplayName)."
                    )
                }
            } catch is CancellationError {
                guard isWorkingOn(action) else { return }
                state = .confirming(action, isWorking: false)
            } catch {
                guard isWorkingOn(action) else { return }
                state = .confirming(
                    action,
                    isWorking: false,
                    notice: FriendCommandFailure.calmNotice(for: error)
                )
            }
        }
    }

    /// Guards every async completion against a user who has since cancelled
    /// or armed a *different* action: without this, a stale Block result
    /// could land on top of a Report confirmation the user opened in the
    /// meantime (or silently clear it out from under them).
    private func isWorkingOn(_ action: ConversationSafetyAction) -> Bool {
        if case .confirming(let currentAction, true, _) = state {
            return currentAction == action
        }
        return false
    }
}
