import Foundation

/// Application-scoped presence ownership: one per-process session, serialized
/// writes, revision-ordered merges, and realtime recovery. Feature code
/// consumes `states()` and issues commands; the host reports auth and
/// lifecycle transitions.
public protocol PresenceRepository: Sendable {
    /// Yields the current state immediately, then every change.
    func states() -> AsyncStream<PresenceState>

    /// The signed-in user, or nil after sign-out. Sessions run only while
    /// authenticated and foregrounded.
    func setAuthenticatedUser(_ userId: String?) async

    /// Scene visibility. Foregrounding starts or resumes the session;
    /// backgrounding ends it best-effort and keeps the last snapshots.
    func setAppForegrounded(_ foregrounded: Bool) async

    /// A user interaction. Piggybacks on the next heartbeat; a return from
    /// ≥ 5 minutes idle forces an immediate one.
    func markActive() async

    /// Optimistically issued by the UI; the repository stays authoritative
    /// and merges the confirmed result revision-safely.
    @discardableResult
    func setPreference(
        _ preference: PresencePreference,
        for duration: PresenceDuration
    ) async -> PresenceCommandOutcome

    /// Pre-sign-out hook: ends the session while the auth token still works.
    func endSession() async
}
