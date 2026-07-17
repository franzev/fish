import Foundation

/// Invitation wakeups plus durable-state reads — mirrors the web
/// `CallRealtimeService`. Signals are wakeups only; consumers always re-read
/// the RLS-protected call row (`findCall`) before acting.
public protocol CallRealtimeProviding: Sendable {
    /// Emits `.recovered` when the subscription (re)establishes — the moment
    /// to reload durable state — and `.event` for call-change wakeups. The
    /// stream ends when the surrounding task is cancelled.
    func signals(userId: String) -> AsyncStream<CallRealtimeSignal>

    /// Newest live call (`ringing`/`connecting`/`active`) the user belongs
    /// to, if any.
    func findCurrentCall(userId: String) async throws -> CallSnapshot?

    /// A specific call, when the user may read it.
    func findCall(id: String, userId: String) async throws -> CallSnapshot?
}
