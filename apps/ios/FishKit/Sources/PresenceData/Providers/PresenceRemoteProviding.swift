import Foundation

/// One realtime delivery. `connected` fires only when every underlying
/// channel is subscribed; any drop emits `disconnected`.
public enum PresenceRealtimeEvent: Sendable, Equatable {
    case connected
    case disconnected
    case snapshotChanged(PresenceSnapshot)
    case preferenceChanged(PresencePreferenceSetting, revision: Int64)
    case subjectsChanged
}

/// Calm command failure — the `{ code, error }` body of the
/// `presence-command` Edge Function, with the web-parity fallback copy.
public struct PresenceCommandFailure: Error, Sendable, Equatable {
    public let code: String
    public let notice: String

    public init(code: String, notice: String) {
        self.code = code
        self.notice = notice
    }

    public static let unavailable = PresenceCommandFailure(
        code: "presence_unavailable",
        notice: "Your status could not change. Try again."
    )
}

/// The presence endpoint surface — the iOS mirror of the web services and
/// Android's `PresenceRemoteDataSource`.
public protocol PresenceRemoteProviding: Sendable {
    /// `list_visible_presence()` — every visible snapshot, including
    /// synthetic revision-0 offline rows for subjects with no data yet.
    func listVisible() async throws -> [PresenceSnapshot]

    /// The owner's stored `presence_preferences` row; missing or expired
    /// rows resolve to automatic.
    func ownPreference() async throws -> PresencePreferenceSetting

    /// `touch_presence_session(p_session_id, p_activity, p_ended)` — returns
    /// the refreshed own snapshot.
    func touchSession(id: String, activity: Bool, ended: Bool) async throws -> PresenceSnapshot

    /// The `presence-command` Edge Function. Throws `PresenceCommandFailure`
    /// with the server's calm copy on rejection.
    func setPreference(
        _ preference: PresencePreference,
        duration: PresenceDuration
    ) async throws -> PresenceCommandResult

    /// Live events for the private `presence:user:{userId}` topic plus
    /// snapshot changes for `subjectIds`. The stream finishes when the
    /// consumer stops iterating or its task is cancelled; the provider
    /// tears the channels down on termination.
    func realtimeEvents(
        userId: String,
        subjectIds: [String]
    ) -> AsyncStream<PresenceRealtimeEvent>
}
