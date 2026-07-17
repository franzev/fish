import Foundation
import PresenceData

/// Push-driven repository fake for feature tests and catalog demos: the
/// test publishes states and scripts command outcomes.
public final class ScriptedPresenceRepository: PresenceRepository, @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [UUID: AsyncStream<PresenceState>.Continuation] = [:]
    private var current: PresenceState
    private var recordedPreferences: [(PresencePreference, PresenceDuration)] = []

    public var onSetPreference: @Sendable (
        PresencePreference, PresenceDuration
    ) async -> PresenceCommandOutcome

    public init(
        initial: PresenceState = PresenceState(),
        onSetPreference: @escaping @Sendable (
            PresencePreference, PresenceDuration
        ) async -> PresenceCommandOutcome = { preference, _ in
            .success(PresenceFixtures.commandResult(preference: preference))
        }
    ) {
        current = initial
        self.onSetPreference = onSetPreference
    }

    public func states() -> AsyncStream<PresenceState> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let id = UUID()
            let snapshot = lock.withLock {
                continuations[id] = continuation
                return current
            }
            continuation.yield(snapshot)
            continuation.onTermination = { [weak self] _ in
                guard let self else { return }
                _ = self.lock.withLock { self.continuations.removeValue(forKey: id) }
            }
        }
    }

    public func setAuthenticatedUser(_ userId: String?) {}
    public func setAppForegrounded(_ foregrounded: Bool) {}
    public func markActive() {}

    @discardableResult
    public func setPreference(
        _ preference: PresencePreference,
        for duration: PresenceDuration
    ) async -> PresenceCommandOutcome {
        lock.withLock { recordedPreferences.append((preference, duration)) }
        return await onSetPreference(preference, duration)
    }

    public func endSession() {}

    // MARK: - Scripting

    /// Publishes a new state to every open subscription.
    public func publish(_ state: PresenceState) {
        let targets = lock.withLock {
            current = state
            return Array(continuations.values)
        }
        for continuation in targets {
            continuation.yield(state)
        }
    }

    public var preferenceCalls: [(PresencePreference, PresenceDuration)] {
        lock.withLock { recordedPreferences }
    }
}
