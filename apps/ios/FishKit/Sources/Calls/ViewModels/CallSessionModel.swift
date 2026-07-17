import CallData
import Foundation
import Observation

/// Value snapshot the call surfaces render — projecting the model into a
/// plain struct keeps the views stateless and the snapshot matrix
/// deterministic (the `GifPanelState` pattern).
public struct CallPanelState: Equatable, Sendable {
    public var call: CallSessionState
    public var notice: String?
    public var busy: Bool
    public var speaking: CallMediaSpeaking
    public var remoteMuted: Bool
    public var localVideoAvailable: Bool
    public var remoteVideoAvailable: Bool
    public var speakerEnabled: Bool
    public var videoQualityPreference: VideoQualityPreference

    public init(
        call: CallSessionState = CallSessionState(),
        notice: String? = nil,
        busy: Bool = false,
        speaking: CallMediaSpeaking = CallMediaSpeaking(),
        remoteMuted: Bool = false,
        localVideoAvailable: Bool = false,
        remoteVideoAvailable: Bool = false,
        speakerEnabled: Bool = false,
        videoQualityPreference: VideoQualityPreference = .auto
    ) {
        self.call = call
        self.notice = notice
        self.busy = busy
        self.speaking = speaking
        self.remoteMuted = remoteMuted
        self.localVideoAvailable = localVideoAvailable
        self.remoteVideoAvailable = remoteVideoAvailable
        self.speakerEnabled = speakerEnabled
        self.videoQualityPreference = videoQualityPreference
    }

    /// Video calls take the full screen while media is in progress — the
    /// mirror of the web popover auto-navigating to `/calls/[id]`.
    public var isVideoStageActive: Bool {
        call.kind == .video && isInProgress
    }

    public var isInProgress: Bool {
        [.connecting, .active, .reconnecting].contains(call.status)
    }
}

/// Owns the call lifecycle on iOS — a port of the web `CallProvider`:
/// the portable reducer holds the truth, commands drive the durable state,
/// realtime signals are wakeups that re-read the RLS-protected row, and the
/// media port mirrors LiveKit room events into reducer events. The caller
/// joins media when the wakeup reports `connecting`; the callee joins through
/// `accept`. Terminal states auto-clear after five seconds.
@MainActor @Observable
public final class CallSessionModel {
    public private(set) var state = CallStateReducer.emptyState()
    public private(set) var notice: String?
    public private(set) var busy = false
    public private(set) var speaking = CallMediaSpeaking()
    public private(set) var remoteMuted = false
    public private(set) var localVideoAvailable = false
    public private(set) var remoteVideoAvailable = false
    public private(set) var speakerEnabled = false
    public private(set) var videoQualityPreference: VideoQualityPreference

    private static let terminalStatuses: Set<CallLifecycleStatus> = [
        .ended, .rejected, .cancelled, .missed, .failed,
    ]

    private let userId: String
    private let commands: any CallCommandProviding
    private let realtime: any CallRealtimeProviding
    private let media: any CallMediaProviding
    private let permissions: any MediaPermissionRequesting
    private let defaults: UserDefaults
    private let clock: any Clock<Duration>
    private let terminalAutoClearDelay: Duration
    private let makeRequestId: @Sendable () -> String
    private let now: @Sendable () -> Date

    private var realtimeTask: Task<Void, Never>?
    private var clearTask: Task<Void, Never>?
    private var connectedCallId: String?
    private var connectionAttempts: Set<String> = []

    public init(
        userId: String,
        commands: any CallCommandProviding,
        realtime: any CallRealtimeProviding,
        media: any CallMediaProviding,
        permissions: any MediaPermissionRequesting = DeviceMediaPermissions(),
        defaults: UserDefaults = .standard,
        clock: any Clock<Duration> = ContinuousClock(),
        terminalAutoClearDelay: Duration = .seconds(5),
        makeRequestId: @escaping @Sendable () -> String = {
            UUID().uuidString.lowercased()
        },
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.userId = userId
        self.commands = commands
        self.realtime = realtime
        self.media = media
        self.permissions = permissions
        self.defaults = defaults
        self.clock = clock
        self.terminalAutoClearDelay = terminalAutoClearDelay
        self.makeRequestId = makeRequestId
        self.now = now
        self.videoQualityPreference = VideoQualityPreference.read(from: defaults)
    }

    public var panelState: CallPanelState {
        CallPanelState(
            call: state.current,
            notice: notice,
            busy: busy,
            speaking: speaking,
            remoteMuted: remoteMuted,
            localVideoAvailable: localVideoAvailable,
            remoteVideoAvailable: remoteVideoAvailable,
            speakerEnabled: speakerEnabled,
            videoQualityPreference: videoQualityPreference
        )
    }

    // MARK: - Lifecycle

    /// Idempotent — subscribe realtime signals and media events. Call from
    /// the hosting scene's `.task`.
    public func start() async {
        guard realtimeTask == nil else { return }
        await media.setVideoQualityPreference(videoQualityPreference)
        media.onEvent = { [weak self] event in
            self?.handleMediaEvent(event)
        }
        let stream = realtime.signals(userId: userId)
        realtimeTask = Task { [weak self] in
            for await signal in stream {
                guard let self, !Task.isCancelled else { break }
                switch signal {
                case .recovered:
                    await self.recover()
                case .event(let event):
                    await self.handleWakeup(event)
                }
            }
        }
    }

    /// The web unmount path: identity reset plus media teardown.
    public func shutdown() {
        realtimeTask?.cancel()
        realtimeTask = nil
        clearTask?.cancel()
        clearTask = nil
        connectedCallId = nil
        connectionAttempts.removeAll()
        dispatch(.identityChanged)
        let media = media
        Task { await media.disconnect() }
    }

    // MARK: - Intents (ports of the web context actions)

    public func startCall(
        recipientId: String,
        recipientName: String,
        kind: CallKind
    ) async {
        await run {
            if state.hasLiveCall {
                notice = CallCopy.finishCurrentCall
                return
            }
            dispatch(.permissionRequested(
                counterpartId: recipientId,
                counterpartName: recipientName,
                kind: kind
            ))
            let permission = await permissions.requestAccess(for: kind)
            guard permission == .granted else {
                dispatch(.permissionDenied(
                    reason: permission == .denied ? .permissionDenied : .deviceUnavailable
                ))
                notice = permission == .denied
                    ? (kind == .video
                        ? CallCopy.allowCameraToStart
                        : CallCopy.allowMicrophoneToStart)
                    : (kind == .video
                        ? CallCopy.cameraUnavailable
                        : CallCopy.microphoneUnavailable)
                return
            }
            do {
                let reply = try await commands.initiate(
                    recipientId: recipientId,
                    kind: kind,
                    clientRequestId: makeRequestId()
                )
                dispatch(.outgoingCallCreated(
                    callId: reply.call.id,
                    counterpartId: recipientId,
                    counterpartName: recipientName,
                    kind: kind,
                    expiresAt: reply.call.expiresAt
                ))
            } catch let failure as CallCommandFailure {
                dispatch(.callFailed(callId: nil, reason: .providerUnavailable))
                notice = failure.notice
            }
        }
    }

    public func answer() async {
        await run {
            guard let callId = state.current.callId else { return }
            let kind = state.current.kind
            let permission = await permissions.requestAccess(for: kind)
            guard permission == .granted else {
                // Stays ringing so the user can allow access and try again.
                notice = kind == .video
                    ? CallCopy.allowCameraToAnswer
                    : CallCopy.allowMicrophoneToAnswer
                return
            }
            await connectCall(
                callId: callId,
                kind: kind,
                command: { [commands] in try await commands.accept(callId: callId) },
                onConnected: { [weak self] in
                    self?.dispatch(.callAccepted(callId: callId))
                }
            )
        }
    }

    public func decline() async {
        await terminalCommand { [commands] callId in
            try await commands.reject(callId: callId)
        } dispatching: { .callRejected(callId: $0) }
    }

    public func cancel() async {
        await terminalCommand { [commands] callId in
            try await commands.cancel(callId: callId)
        } dispatching: { .callCancelled(callId: $0) }
    }

    public func end() async {
        await terminalCommand { [commands] callId in
            try await commands.end(callId: callId)
        } dispatching: { .callEnded(callId: $0) }
    }

    public func toggleMute() async {
        let muted = !state.current.muted
        await media.setMuted(muted)
        if muted {
            speaking.localMicrophoneActive = false
            speaking.localMicrophoneLevel = 0
        }
        dispatch(.muteChanged(muted: muted))
    }

    public func toggleCamera() async {
        guard state.current.kind == .video else { return }
        let enabled = !state.current.cameraEnabled
        do {
            try await media.setCameraEnabled(enabled)
        } catch {
            notice = enabled ? CallCopy.cameraStartFailed : CallCopy.cameraStopFailed
        }
    }

    public func switchCamera() async {
        guard state.current.kind == .video, state.current.cameraEnabled else { return }
        do {
            try await media.switchCamera()
        } catch {
            notice = CallCopy.cameraSwitchFailed
        }
    }

    public func toggleSpeaker() async {
        speakerEnabled.toggle()
        await media.setSpeakerEnabled(speakerEnabled)
    }

    public func setVideoQualityPreference(_ preference: VideoQualityPreference) async {
        videoQualityPreference = preference
        preference.write(to: defaults)
        await media.setVideoQualityPreference(preference)
    }

    public func clear() {
        clearTask?.cancel()
        clearTask = nil
        notice = nil
        speaking = CallMediaSpeaking()
        remoteMuted = false
        localVideoAvailable = false
        remoteVideoAvailable = false
        dispatch(.clearCall)
    }

    // MARK: - Realtime handling

    private func handleWakeup(_ event: CallRealtimeEvent) async {
        guard
            let found = try? await realtime.findCall(id: event.callId, userId: userId)
        else { return }
        applyCall(found)
        if found.call.status == .connecting, found.call.initiatedBy == userId {
            await connectCall(
                callId: found.call.id,
                kind: found.call.kind,
                command: { [commands] in
                    try await commands.join(callId: found.call.id)
                }
            )
        }
    }

    private func recover() async {
        let found: CallSnapshot?
        if let currentCallId = state.current.callId {
            found = try? await realtime.findCall(id: currentCallId, userId: userId)
        } else {
            found = try? await realtime.findCurrentCall(userId: userId)
        }
        guard let found else { return }
        await loadCall(found.call.id)
    }

    private func loadCall(_ callId: String) async {
        guard let found = try? await realtime.findCall(id: callId, userId: userId)
        else {
            notice = CallCopy.callNoLongerAvailable
            dispatch(.callFailed(callId: nil, reason: .notAllowed))
            return
        }
        applyCall(found)
        if found.call.status == .connecting || found.call.status == .active {
            await connectCall(
                callId: found.call.id,
                kind: found.call.kind,
                command: { [commands] in
                    try await commands.join(callId: found.call.id)
                }
            )
        }
    }

    /// Maps a durable call row onto reducer events — the web `applyCall`.
    private func applyCall(_ snapshot: CallSnapshot) {
        let call = snapshot.call
        let counterpartId = call.coachId == userId ? call.clientId : call.coachId

        func hydrateEvent() -> CallEvent {
            call.initiatedBy == userId
                ? .outgoingCallCreated(
                    callId: call.id,
                    counterpartId: counterpartId,
                    counterpartName: snapshot.counterpartName,
                    kind: call.kind,
                    expiresAt: call.expiresAt
                )
                : .incomingCallReceived(
                    callId: call.id,
                    counterpartId: counterpartId,
                    counterpartName: snapshot.counterpartName,
                    kind: call.kind,
                    expiresAt: call.expiresAt
                )
        }

        switch call.status {
        case .ringing:
            dispatch(hydrateEvent())

        case .connecting, .active:
            if state.current.callId != call.id {
                dispatch(hydrateEvent())
            }
            dispatch(.callAccepted(callId: call.id))
            if call.status == .active {
                dispatch(.mediaConnected(
                    callId: call.id,
                    connectedAt: call.connectedAt ?? isoNow()
                ))
            }

        case .rejected, .cancelled, .missed, .ended, .failed:
            if state.current.callId != call.id {
                dispatch(hydrateEvent())
            }
            switch call.status {
            case .rejected: dispatch(.callRejected(callId: call.id))
            case .cancelled: dispatch(.callCancelled(callId: call.id))
            case .missed: dispatch(.callMissed(callId: call.id))
            case .ended: dispatch(.callEnded(callId: call.id))
            default:
                dispatch(.callFailed(callId: call.id, reason: .connectFailed))
            }
            if connectedCallId == call.id {
                connectedCallId = nil
            }
            let media = media
            Task { await media.disconnect() }
        }
    }

    // MARK: - Media connection

    private func connectCall(
        callId: String,
        kind: CallKind,
        command: @escaping () async throws -> CallCommandReply,
        onConnected: (() -> Void)? = nil
    ) async {
        if connectedCallId == callId { return }
        if connectionAttempts.contains(callId) { return }
        connectionAttempts.insert(callId)
        defer { connectionAttempts.remove(callId) }

        do {
            let reply = try await command()
            guard let connection = reply.connection else {
                await failMediaConnection(callId)
                return
            }
            onConnected?()
            do {
                try await media.connect(
                    callId: callId,
                    connection: connection,
                    publishMicrophone: true,
                    publishCamera: kind == .video
                )
                connectedCallId = callId
                if kind == .video, !speakerEnabled {
                    // Video calls default to the speaker route, like every
                    // platform video-call surface.
                    speakerEnabled = true
                    await media.setSpeakerEnabled(true)
                }
            } catch {
                await failMediaConnection(callId)
            }
        } catch let failure as CallCommandFailure {
            notice = failure.notice
        } catch {
            await failMediaConnection(callId)
        }
    }

    /// The web `closeFailedMediaConnection`: best-effort end, media teardown,
    /// calm failure state.
    private func failMediaConnection(_ callId: String) async {
        if connectedCallId == callId {
            connectedCallId = nil
        }
        _ = try? await commands.end(callId: callId)
        await media.disconnect()
        dispatch(.callFailed(callId: callId, reason: .connectFailed))
        notice = CallCopy.callDidNotConnect
    }

    // MARK: - Media events

    private func handleMediaEvent(_ event: CallMediaEvent) {
        switch event {
        case .connected(let callId):
            dispatch(.mediaConnected(callId: callId, connectedAt: isoNow()))
        case .reconnecting(let callId):
            dispatch(.reconnecting(callId: callId))
        case .reconnected(let callId):
            dispatch(.reconnected(callId: callId))
        case .disconnected(let callId):
            dispatch(.callFailed(callId: callId, reason: .networkLost))
        case .speakingChanged(_, let value):
            speaking = value
        case .remoteMuteChanged(_, let muted):
            remoteMuted = muted
        case .localVideoChanged(let available):
            localVideoAvailable = available
        case .remoteVideoChanged(let available):
            remoteVideoAvailable = available
        case .cameraChanged(let enabled):
            dispatch(.cameraChanged(enabled: enabled))
        }
    }

    // MARK: - Plumbing

    private func terminalCommand(
        _ command: @escaping (String) async throws -> CallCommandReply,
        dispatching event: (String) -> CallEvent
    ) async {
        await run {
            guard let callId = state.current.callId else { return }
            do {
                _ = try await command(callId)
                dispatch(event(callId))
            } catch let failure as CallCommandFailure {
                notice = failure.notice
            }
            await media.disconnect()
        }
    }

    private func run(_ action: () async throws -> Void) async {
        if busy { return }
        busy = true
        notice = nil
        defer { busy = false }
        do {
            try await action()
        } catch {
            let callId = state.current.callId
            dispatch(.callFailed(callId: callId, reason: .connectFailed))
            notice = CallCopy.callDidNotConnect
            await media.disconnect()
        }
    }

    private func dispatch(_ event: CallEvent) {
        state = CallStateReducer.reduce(state, event)
        if !state.hasLiveCall {
            connectedCallId = nil
        }
        scheduleTerminalAutoClear()
    }

    private func scheduleTerminalAutoClear() {
        clearTask?.cancel()
        clearTask = nil
        guard Self.terminalStatuses.contains(state.current.status) else { return }
        let clock = clock
        let delay = terminalAutoClearDelay
        clearTask = Task { [weak self] in
            try? await clock.sleep(for: delay)
            guard let self, !Task.isCancelled else { return }
            self.clear()
        }
    }

    private func isoNow() -> String {
        now().formatted(
            .iso8601
                .year().month().day()
                .timeZone(separator: .omitted)
                .time(includingFractionalSeconds: true)
        )
    }
}
