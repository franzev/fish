import CallData
import Calls
import Foundation
import SwiftUI

/// Closure-scripted command provider — tests and catalog demos decide each
/// command's reply. Defaults succeed with a plausible call row.
public struct ScriptedCallCommands: CallCommandProviding {
    public var onInitiate: @Sendable (String, CallKind, String) async throws -> CallCommandReply
    public var onAccept: @Sendable (String) async throws -> CallCommandReply
    public var onReject: @Sendable (String) async throws -> CallCommandReply
    public var onCancel: @Sendable (String) async throws -> CallCommandReply
    public var onEnd: @Sendable (String) async throws -> CallCommandReply
    public var onJoin: @Sendable (String) async throws -> CallCommandReply

    public init(
        onInitiate: @escaping @Sendable (String, CallKind, String) async throws -> CallCommandReply = { recipientId, kind, _ in
            CallCommandReply(call: CallFixtures.call(
                id: CallFixtures.callId,
                kind: kind,
                status: .ringing,
                clientId: recipientId
            ))
        },
        onAccept: @escaping @Sendable (String) async throws -> CallCommandReply = { callId in
            CallCommandReply(
                call: CallFixtures.call(id: callId, status: .connecting),
                connection: CallFixtures.connection
            )
        },
        onReject: @escaping @Sendable (String) async throws -> CallCommandReply = { callId in
            CallCommandReply(call: CallFixtures.call(id: callId, status: .rejected))
        },
        onCancel: @escaping @Sendable (String) async throws -> CallCommandReply = { callId in
            CallCommandReply(call: CallFixtures.call(id: callId, status: .cancelled))
        },
        onEnd: @escaping @Sendable (String) async throws -> CallCommandReply = { callId in
            CallCommandReply(call: CallFixtures.call(id: callId, status: .ended))
        },
        onJoin: @escaping @Sendable (String) async throws -> CallCommandReply = { callId in
            CallCommandReply(
                call: CallFixtures.call(id: callId, status: .connecting),
                connection: CallFixtures.connection
            )
        }
    ) {
        self.onInitiate = onInitiate
        self.onAccept = onAccept
        self.onReject = onReject
        self.onCancel = onCancel
        self.onEnd = onEnd
        self.onJoin = onJoin
    }

    public func initiate(
        recipientId: String,
        kind: CallKind,
        clientRequestId: String
    ) async throws -> CallCommandReply {
        try await onInitiate(recipientId, kind, clientRequestId)
    }

    public func accept(callId: String) async throws -> CallCommandReply {
        try await onAccept(callId)
    }

    public func reject(callId: String) async throws -> CallCommandReply {
        try await onReject(callId)
    }

    public func cancel(callId: String) async throws -> CallCommandReply {
        try await onCancel(callId)
    }

    public func end(callId: String) async throws -> CallCommandReply {
        try await onEnd(callId)
    }

    public func join(callId: String) async throws -> CallCommandReply {
        try await onJoin(callId)
    }
}

/// Push-driven realtime fixture: tests and the catalog demo publish wakeups
/// and set the durable rows the session re-reads.
public final class FixtureCallRealtime: CallRealtimeProviding, @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [UUID: AsyncStream<CallRealtimeSignal>.Continuation] = [:]
    private var snapshotsById: [String: CallSnapshot] = [:]
    private var liveSnapshot: CallSnapshot?
    /// When true (default), every new subscription immediately yields
    /// `.recovered` — the live adapters' subscribe behavior.
    public var emitsRecoveredOnSubscribe = true

    private var _lastKind: CallKind = .audio
    /// Scripting convenience for demos: the kind the current scenario uses.
    public var lastKind: CallKind {
        get { lock.withLock { _lastKind } }
        set { lock.withLock { _lastKind = newValue } }
    }

    public init() {}

    public func signals(userId _: String) -> AsyncStream<CallRealtimeSignal> {
        AsyncStream { continuation in
            let id = UUID()
            let emitRecovered = lock.withLock {
                continuations[id] = continuation
                return emitsRecoveredOnSubscribe
            }
            if emitRecovered {
                continuation.yield(.recovered)
            }
            continuation.onTermination = { [weak self] _ in
                guard let self else { return }
                _ = self.lock.withLock { self.continuations.removeValue(forKey: id) }
            }
        }
    }

    public func findCurrentCall(userId _: String) async throws -> CallSnapshot? {
        lock.withLock { liveSnapshot }
    }

    public func findCall(id: String, userId _: String) async throws -> CallSnapshot? {
        lock.withLock { snapshotsById[id] }
    }

    /// Store the durable row (and mark it as the live call when its status is
    /// live), then optionally broadcast the wakeup — one scripted step of the
    /// control plane.
    public func setCall(
        _ snapshot: CallSnapshot,
        broadcast: Bool = true
    ) {
        let liveStatuses: Set<ClientCallStatus> = [.ringing, .connecting, .active]
        let signal: CallRealtimeSignal = .event(CallRealtimeEvent(
            callId: snapshot.call.id,
            status: snapshot.call.status,
            occurredAt: snapshot.call.updatedAt
        ))
        let targets = lock.withLock {
            snapshotsById[snapshot.call.id] = snapshot
            liveSnapshot = liveStatuses.contains(snapshot.call.status) ? snapshot : nil
            return broadcast ? Array(continuations.values) : []
        }
        for continuation in targets {
            continuation.yield(signal)
        }
    }

    public func push(_ signal: CallRealtimeSignal) {
        let targets = lock.withLock { Array(continuations.values) }
        for continuation in targets {
            continuation.yield(signal)
        }
    }
}

/// Scripted media port: records intent, never touches devices, and lets a
/// test or demo fire media events (remote joins, reconnects, speaking).
@MainActor
public final class FixtureCallMedia: CallMediaProviding {
    public var onEvent: (@MainActor (CallMediaEvent) -> Void)?

    public private(set) var connectedCallId: String?
    public private(set) var lastConnection: CallConnection?
    public private(set) var muted = false
    public private(set) var cameraEnabled = false
    public private(set) var speakerEnabled = false
    public private(set) var disconnectCount = 0
    public private(set) var videoQualityPreference: VideoQualityPreference = .auto

    /// When true (default), connecting immediately reports the counterpart
    /// as present — the media session becomes active without a real room.
    public var autoConnects = true
    /// When set, `connect` throws — the connect-failed path.
    public var connectError: (any Error)?
    /// When set, `setCameraEnabled` throws — the camera-failure notices.
    public var cameraError: (any Error)?

    public init() {}

    public func connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone _: Bool,
        publishCamera: Bool
    ) async throws {
        if let connectError { throw connectError }
        connectedCallId = callId
        lastConnection = connection
        if publishCamera {
            cameraEnabled = true
            onEvent?(.localVideoChanged(available: true))
            onEvent?(.cameraChanged(enabled: true))
        }
        if autoConnects {
            onEvent?(.connected(callId: callId))
        }
    }

    public func setMuted(_ muted: Bool) async {
        self.muted = muted
    }

    public func setCameraEnabled(_ enabled: Bool) async throws {
        if let cameraError { throw cameraError }
        cameraEnabled = enabled
        onEvent?(.localVideoChanged(available: enabled))
        onEvent?(.cameraChanged(enabled: enabled))
    }

    public func switchCamera() async throws {}

    public func setSpeakerEnabled(_ enabled: Bool) async {
        speakerEnabled = enabled
    }

    public func setVideoQualityPreference(_ preference: VideoQualityPreference) async {
        videoQualityPreference = preference
    }

    public func disconnect() async {
        disconnectCount += 1
        connectedCallId = nil
        if cameraEnabled {
            cameraEnabled = false
            onEvent?(.localVideoChanged(available: false))
            onEvent?(.cameraChanged(enabled: false))
        }
    }

    public func localVideoView() -> AnyView? { nil }

    public func remoteVideoView() -> AnyView? { nil }

    /// Test/demo hook — fire any media event into the session.
    public func send(_ event: CallMediaEvent) {
        onEvent?(event)
    }
}

/// Deterministic call rows for tests, previews, and the catalog.
public enum CallFixtures {
    public static let callId = "11111111-1111-4111-8111-111111111111"
    public static let coachId = "22222222-2222-4222-8222-222222222222"
    public static let clientId = "33333333-3333-4333-8333-333333333333"
    public static let coachName = "Coach Mina"
    public static let clientName = "Ari"

    public static let connection = CallConnection(
        serverUrl: "wss://livekit.local",
        participantToken: "fixture-token"
    )

    public static func call(
        id: String = callId,
        kind: CallKind = .audio,
        status: ClientCallStatus,
        coachId: String = coachId,
        clientId: String = clientId,
        initiatedBy: String? = nil,
        connectedAt: String? = nil
    ) -> ClientCall {
        ClientCall(
            id: id,
            coachId: coachId,
            clientId: clientId,
            initiatedBy: initiatedBy ?? coachId,
            kind: kind,
            status: status,
            expiresAt: "2026-07-17T10:00:45.000Z",
            connectedAt: connectedAt,
            createdAt: "2026-07-17T10:00:00.000Z",
            updatedAt: "2026-07-17T10:00:05.000Z"
        )
    }

    public static func snapshot(
        _ call: ClientCall,
        counterpartName: String = coachName
    ) -> CallSnapshot {
        CallSnapshot(call: call, counterpartName: counterpartName)
    }
}
