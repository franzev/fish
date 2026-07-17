import Foundation
import PresenceData

/// Deterministic presence rows for tests, previews, and the catalog. The
/// fixed clock matches `PersonalChatFixtures.now`.
public enum PresenceFixtures {
    public static let selfId = "maya"
    public static let coachId = "sam"
    public static let nowIso = "2026-07-16T15:00:00Z"

    public static func snapshot(
        userId: String = coachId,
        status: PresenceStatus = .online,
        lastHeartbeatAt: String? = nowIso,
        lastSeenAt: String? = nowIso,
        revision: Int64 = 1,
        updatedAt: String = nowIso
    ) -> PresenceSnapshot {
        PresenceSnapshot(
            userId: userId,
            status: status,
            lastHeartbeatAt: lastHeartbeatAt,
            lastSeenAt: lastSeenAt,
            revision: revision,
            updatedAt: updatedAt
        )
    }

    public static func commandResult(
        preference: PresencePreference = .busy,
        expiresAt: String? = nil,
        revision: Int64 = 2,
        status: PresenceStatus = .busy
    ) -> PresenceCommandResult {
        PresenceCommandResult(
            snapshot: snapshot(userId: selfId, status: status, revision: revision),
            setting: PresencePreferenceSetting(
                preference: preference,
                expiresAt: expiresAt
            )
        )
    }
}

/// Recorded `touch_presence_session` call.
public struct RecordedPresenceTouch: Sendable, Equatable {
    public let sessionId: String
    public let activity: Bool
    public let ended: Bool

    public init(sessionId: String, activity: Bool, ended: Bool) {
        self.sessionId = sessionId
        self.activity = activity
        self.ended = ended
    }
}

/// Closure-scripted remote plus a push-driven realtime feed — tests and the
/// catalog decide every reply and publish events on demand.
public final class ScriptedPresenceRemote: PresenceRemoteProviding, @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [UUID: AsyncStream<PresenceRealtimeEvent>.Continuation] = [:]
    private var recordedTouches: [RecordedPresenceTouch] = []
    private var recordedSubjectIds: [[String]] = []

    /// When true (default), every new subscription immediately receives
    /// `.connected` — the live adapter's all-channels-subscribed behavior.
    public var emitsConnectedOnSubscribe = true

    public var onListVisible: @Sendable () async throws -> [PresenceSnapshot]
    public var onOwnPreference: @Sendable () async throws -> PresencePreferenceSetting
    public var onTouch: @Sendable (String, Bool, Bool) async throws -> PresenceSnapshot
    public var onSetPreference: @Sendable (
        PresencePreference, PresenceDuration
    ) async throws -> PresenceCommandResult

    public init(
        onListVisible: @escaping @Sendable () async throws -> [PresenceSnapshot] = {
            [
                PresenceFixtures.snapshot(userId: PresenceFixtures.selfId),
                PresenceFixtures.snapshot(userId: PresenceFixtures.coachId),
            ]
        },
        onOwnPreference: @escaping @Sendable () async throws -> PresencePreferenceSetting = {
            PresencePreferenceSetting()
        },
        onTouch: @escaping @Sendable (String, Bool, Bool) async throws -> PresenceSnapshot = { _, _, _ in
            PresenceFixtures.snapshot(userId: PresenceFixtures.selfId)
        },
        onSetPreference: @escaping @Sendable (
            PresencePreference, PresenceDuration
        ) async throws -> PresenceCommandResult = { preference, _ in
            PresenceFixtures.commandResult(preference: preference)
        }
    ) {
        self.onListVisible = onListVisible
        self.onOwnPreference = onOwnPreference
        self.onTouch = onTouch
        self.onSetPreference = onSetPreference
    }

    // MARK: - PresenceRemoteProviding

    public func listVisible() async throws -> [PresenceSnapshot] {
        try await onListVisible()
    }

    public func ownPreference() async throws -> PresencePreferenceSetting {
        try await onOwnPreference()
    }

    public func touchSession(
        id: String,
        activity: Bool,
        ended: Bool
    ) async throws -> PresenceSnapshot {
        lock.withLock {
            recordedTouches.append(
                RecordedPresenceTouch(sessionId: id, activity: activity, ended: ended)
            )
        }
        return try await onTouch(id, activity, ended)
    }

    public func setPreference(
        _ preference: PresencePreference,
        duration: PresenceDuration
    ) async throws -> PresenceCommandResult {
        try await onSetPreference(preference, duration)
    }

    public func realtimeEvents(
        userId _: String,
        subjectIds: [String]
    ) -> AsyncStream<PresenceRealtimeEvent> {
        AsyncStream { continuation in
            let id = UUID()
            let emitConnected = lock.withLock {
                recordedSubjectIds.append(subjectIds)
                continuations[id] = continuation
                return emitsConnectedOnSubscribe
            }
            if emitConnected {
                continuation.yield(.connected)
            }
            continuation.onTermination = { [weak self] _ in
                guard let self else { return }
                _ = self.lock.withLock { self.continuations.removeValue(forKey: id) }
            }
        }
    }

    // MARK: - Scripting

    /// Publishes an event to every open subscription.
    public func send(_ event: PresenceRealtimeEvent) {
        let targets = lock.withLock { Array(continuations.values) }
        for continuation in targets {
            continuation.yield(event)
        }
    }

    public var touches: [RecordedPresenceTouch] {
        lock.withLock { recordedTouches }
    }

    public var subscribedSubjectIds: [[String]] {
        lock.withLock { recordedSubjectIds }
    }
}
