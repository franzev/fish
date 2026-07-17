import Foundation

/// Fallback for builds without Supabase credentials: presence stays signed
/// out and commands fail with calm copy. Mirrors Android's unconfigured
/// repository so the UI never needs a special case.
public struct UnconfiguredPresenceRepository: PresenceRepository {
    public init() {}

    public func states() -> AsyncStream<PresenceState> {
        AsyncStream { continuation in
            continuation.yield(PresenceState())
            continuation.finish()
        }
    }

    public func setAuthenticatedUser(_ userId: String?) {}
    public func setAppForegrounded(_ foregrounded: Bool) {}
    public func markActive() {}

    @discardableResult
    public func setPreference(
        _ preference: PresencePreference,
        for duration: PresenceDuration
    ) -> PresenceCommandOutcome {
        .failure(notice: "This build is not connected yet.")
    }

    public func endSession() {}
}
