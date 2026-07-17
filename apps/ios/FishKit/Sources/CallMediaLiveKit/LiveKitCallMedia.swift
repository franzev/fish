import AVFoundation
import CallData
import Calls
import Foundation
import LiveKit
import SwiftUI

/// LiveKit-backed conformance of the feature's media port — the iOS mirror of
/// the web `LiveKitCallMedia`: 720p simulcast publishing with adaptive
/// stream + dynacast, processed microphone capture, reconnection events, the
/// smoothed speaking monitor, and strict track teardown. iOS additions the
/// platform requires: speaker routing, camera flip, and audio-session
/// interruption handling.
@MainActor
public final class LiveKitCallMedia: CallMediaProviding {
    public var onEvent: (@MainActor (CallMediaEvent) -> Void)?

    private var room: Room?
    private var callId: String?
    private var intentionalDisconnect = false
    private var canPublishMicrophone = false
    private var canPublishCamera = false
    private var videoQualityPreference: VideoQualityPreference
    private var remoteVideoTrack: VideoTrack?
    private var localVideoTrack: VideoTrack?
    private var speakerEnabled = false

    private var speakingMonitor: Task<Void, Never>?
    private var localMicrophoneActive = false
    private var localMicrophoneLevel = 0.0
    private var remoteSpeaking = false
    private var remoteMicrophoneLevel = 0.0
    private var remoteMuted = false
    private var localActiveUntil = Date.distantPast
    private var interruptionObserver: (any NSObjectProtocol)?

    public init(videoQualityPreference: VideoQualityPreference = .auto) {
        self.videoQualityPreference = videoQualityPreference
    }

    // MARK: - CallMediaProviding

    public func connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone: Bool,
        publishCamera: Bool
    ) async throws {
        if self.callId == callId, room != nil,
           !publishMicrophone || canPublishMicrophone,
           !publishCamera || canPublishCamera {
            if publishMicrophone { try await setMicrophone(enabled: true) }
            if publishCamera { try await setCameraEnabled(true) }
            return
        }

        await disconnect()

        let room = Room(
            delegate: self,
            roomOptions: RoomOptions(
                defaultCameraCaptureOptions: cameraCaptureOptions,
                defaultAudioCaptureOptions: AudioCaptureOptions(
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true
                ),
                defaultVideoPublishOptions: videoPublishOptions,
                adaptiveStream: true,
                dynacast: true
            )
        )
        self.room = room
        self.callId = callId
        canPublishMicrophone = publishMicrophone
        canPublishCamera = publishCamera
        intentionalDisconnect = false

        do {
            try await room.connect(
                url: connection.serverUrl,
                token: connection.participantToken,
                connectOptions: ConnectOptions(autoSubscribe: true)
            )
            if publishMicrophone { try await setMicrophone(enabled: true) }
            if publishCamera { try await setCameraEnabled(true) }
            observeInterruptions()
            if !room.remoteParticipants.isEmpty {
                onEvent?(.connected(callId: callId))
            }
        } catch {
            await disconnect()
            throw error
        }
    }

    public func setMuted(_ muted: Bool) async {
        try? await setMicrophone(enabled: !muted)
        if muted, let callId {
            localActiveUntil = .distantPast
            updateSpeaking(
                callId: callId,
                localActive: false,
                remoteSpeaking: remoteSpeaking,
                localLevel: 0
            )
        }
    }

    public func setCameraEnabled(_ enabled: Bool) async throws {
        guard let room else { return }
        try await room.localParticipant.setCamera(
            enabled: enabled,
            captureOptions: enabled ? cameraCaptureOptions : nil
        )
        refreshLocalVideoTrack()
    }

    public func switchCamera() async throws {
        guard
            let track = room?.localParticipant
                .firstCameraVideoTrack as? LocalVideoTrack,
            let capturer = track.capturer as? CameraCapturer
        else { return }
        try await capturer.switchCameraPosition()
    }

    public func setSpeakerEnabled(_ enabled: Bool) async {
        speakerEnabled = enabled
        let session = AVAudioSession.sharedInstance()
        try? session.overrideOutputAudioPort(enabled ? .speaker : .none)
    }

    public func setVideoQualityPreference(_ preference: VideoQualityPreference) async {
        guard preference != videoQualityPreference else { return }
        videoQualityPreference = preference
        // Publish quality is fixed at capture time; restart the camera so a
        // mid-call preference change takes effect. Adaptive stream keeps
        // adjusting delivery within the published layers either way.
        if let room, room.localParticipant.isCameraEnabled() {
            try? await setCameraEnabled(false)
            try? await setCameraEnabled(true)
        }
    }

    public func disconnect() async {
        let room = room
        let endedCallId = callId
        intentionalDisconnect = true
        stopSpeakingMonitor()
        if let endedCallId {
            updateSpeaking(
                callId: endedCallId,
                localActive: false,
                remoteSpeaking: false,
                localLevel: 0,
                remoteLevel: 0
            )
            updateRemoteMuted(callId: endedCallId, muted: false)
        }
        clearSessionState()
        if let observer = interruptionObserver {
            NotificationCenter.default.removeObserver(observer)
            interruptionObserver = nil
        }
        await room?.disconnect()
    }

    public func localVideoView() -> AnyView? {
        guard let track = localVideoTrack else { return nil }
        return AnyView(
            SwiftUIVideoView(track, layoutMode: .fit, mirrorMode: .mirror)
        )
    }

    public func remoteVideoView() -> AnyView? {
        guard let track = remoteVideoTrack else { return nil }
        return AnyView(SwiftUIVideoView(track, layoutMode: .fit))
    }

    // MARK: - Options

    private var cameraCaptureOptions: CameraCaptureOptions {
        CameraCaptureOptions(
            position: .front,
            dimensions: videoQualityPreference == .dataSaver
                ? .h360_169
                : .h720_169
        )
    }

    private var videoPublishOptions: VideoPublishOptions {
        VideoPublishOptions(
            encoding: videoQualityPreference == .dataSaver
                ? VideoParameters.presetH360_169.encoding
                : VideoParameters.presetH720_169.encoding,
            simulcast: true,
            degradationPreference: .maintainResolution
        )
    }

    // MARK: - Internal plumbing

    private func setMicrophone(enabled: Bool) async throws {
        guard let room else { return }
        try await room.localParticipant.setMicrophone(enabled: enabled)
        if enabled { startSpeakingMonitor() }
    }

    private func clearSessionState() {
        room = nil
        callId = nil
        canPublishMicrophone = false
        canPublishCamera = false
        localVideoTrack = nil
        remoteVideoTrack = nil
        onEvent?(.localVideoChanged(available: false))
        onEvent?(.remoteVideoChanged(available: false))
        onEvent?(.cameraChanged(enabled: false))
    }

    private func refreshLocalVideoTrack() {
        let track = room?.localParticipant.firstCameraVideoTrack
        localVideoTrack = track
        onEvent?(.localVideoChanged(available: track != nil))
        onEvent?(.cameraChanged(enabled: track != nil))
    }

    private func setRemoteVideoTrack(_ track: VideoTrack?) {
        remoteVideoTrack = track
        onEvent?(.remoteVideoChanged(available: track != nil))
    }

    private func observeInterruptions() {
        guard interruptionObserver == nil else { return }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            let rawType = notification
                .userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            MainActor.assumeIsolated {
                guard
                    let self,
                    let callId = self.callId,
                    let rawType,
                    let type = AVAudioSession.InterruptionType(rawValue: rawType)
                else { return }
                switch type {
                case .began:
                    self.onEvent?(.reconnecting(callId: callId))
                case .ended:
                    self.onEvent?(.reconnected(callId: callId))
                    if self.speakerEnabled {
                        Task { await self.setSpeakerEnabled(true) }
                    }
                @unknown default:
                    break
                }
            }
        }
    }

    // MARK: - Speaking monitor (web smoothing constants)

    private func startSpeakingMonitor() {
        guard speakingMonitor == nil else { return }
        speakingMonitor = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(33))
                guard let self, !Task.isCancelled else { break }
                self.sampleAudioLevels()
            }
        }
    }

    private func stopSpeakingMonitor() {
        speakingMonitor?.cancel()
        speakingMonitor = nil
        localActiveUntil = .distantPast
    }

    private func sampleAudioLevels() {
        guard let room, let callId else { return }
        let local = room.localParticipant
        let microphoneEnabled = local.isMicrophoneEnabled()

        let measured = microphoneEnabled
            ? min(1, Double(local.audioLevel) / 0.3)
            : 0
        let response = measured > localMicrophoneLevel ? 0.35 : 0.12
        let smoothed = localMicrophoneLevel
            + (measured - localMicrophoneLevel) * response

        var measuredRemote = 0.0
        if !remoteMuted {
            for participant in room.remoteParticipants.values {
                measuredRemote = max(
                    measuredRemote,
                    min(1, Double(participant.audioLevel) / 0.3)
                )
            }
        }
        let remoteResponse = measuredRemote > remoteMicrophoneLevel ? 0.35 : 0.12
        let smoothedRemote = remoteMicrophoneLevel
            + (measuredRemote - remoteMicrophoneLevel) * remoteResponse

        if microphoneEnabled, local.audioLevel >= 0.025 {
            localActiveUntil = Date().addingTimeInterval(0.25)
        }
        let microphoneActive = microphoneEnabled && Date() < localActiveUntil

        updateSpeaking(
            callId: callId,
            localActive: microphoneActive,
            remoteSpeaking: remoteSpeaking,
            localLevel: smoothed < 0.01 ? 0 : smoothed,
            remoteLevel: smoothedRemote < 0.01 ? 0 : smoothedRemote
        )
    }

    private func updateSpeaking(
        callId: String,
        localActive: Bool,
        remoteSpeaking: Bool,
        localLevel: Double? = nil,
        remoteLevel: Double? = nil
    ) {
        let nextLevel = ((localLevel ?? localMicrophoneLevel) * 100).rounded() / 100
        let nextRemoteLevel = ((remoteLevel ?? remoteMicrophoneLevel) * 100).rounded() / 100
        guard
            localActive != localMicrophoneActive
                || nextLevel != localMicrophoneLevel
                || remoteSpeaking != self.remoteSpeaking
                || nextRemoteLevel != remoteMicrophoneLevel
        else { return }

        localMicrophoneActive = localActive
        localMicrophoneLevel = nextLevel
        self.remoteSpeaking = remoteSpeaking
        remoteMicrophoneLevel = nextRemoteLevel
        onEvent?(.speakingChanged(callId: callId, CallMediaSpeaking(
            localMicrophoneActive: localActive,
            localMicrophoneLevel: nextLevel,
            remoteSpeaking: remoteSpeaking,
            remoteMicrophoneLevel: nextRemoteLevel
        )))
    }

    private func updateRemoteMuted(callId: String, muted: Bool) {
        guard muted != remoteMuted else { return }
        remoteMuted = muted
        onEvent?(.remoteMuteChanged(callId: callId, muted: muted))
    }
}

// MARK: - RoomDelegate

extension LiveKitCallMedia: RoomDelegate {
    public nonisolated func room(
        _ room: Room,
        participantDidConnect participant: RemoteParticipant
    ) {
        Task { @MainActor [weak self] in
            guard let self, let callId = self.callId else { return }
            self.onEvent?(.connected(callId: callId))
        }
    }

    public nonisolated func room(
        _ room: Room,
        participantDidDisconnect participant: RemoteParticipant
    ) {
        Task { @MainActor [weak self] in
            guard let self, let callId = self.callId else { return }
            if room.remoteParticipants.isEmpty {
                self.updateSpeaking(
                    callId: callId,
                    localActive: self.localMicrophoneActive,
                    remoteSpeaking: false,
                    remoteLevel: 0
                )
                self.updateRemoteMuted(callId: callId, muted: false)
            }
        }
    }

    public nonisolated func room(
        _ room: Room,
        didUpdateConnectionState connectionState: ConnectionState,
        from oldValue: ConnectionState
    ) {
        Task { @MainActor [weak self] in
            guard let self, let callId = self.callId else { return }
            switch connectionState {
            case .reconnecting:
                self.onEvent?(.reconnecting(callId: callId))
            case .connected where oldValue == .reconnecting:
                self.onEvent?(.reconnected(callId: callId))
            case .disconnected:
                if !self.intentionalDisconnect {
                    self.stopSpeakingMonitor()
                    self.clearSessionState()
                    self.onEvent?(.disconnected(callId: callId))
                }
            default:
                break
            }
        }
    }

    public nonisolated func room(
        _ room: Room,
        didUpdateSpeakingParticipants participants: [Participant]
    ) {
        let remoteIsSpeaking = participants.contains { !($0 is LocalParticipant) }
        Task { @MainActor [weak self] in
            guard let self, let callId = self.callId else { return }
            self.updateSpeaking(
                callId: callId,
                localActive: self.localMicrophoneActive,
                remoteSpeaking: remoteIsSpeaking
            )
        }
    }

    public nonisolated func room(
        _ room: Room,
        participant: RemoteParticipant,
        didSubscribeTrack publication: RemoteTrackPublication
    ) {
        Task { @MainActor [weak self] in
            guard let self, let callId = self.callId else { return }
            if publication.kind == .video, let track = publication.track as? VideoTrack {
                self.setRemoteVideoTrack(track)
            }
            if publication.kind == .audio {
                self.updateRemoteMuted(callId: callId, muted: publication.isMuted)
            }
        }
    }

    public nonisolated func room(
        _ room: Room,
        participant: RemoteParticipant,
        didUnsubscribeTrack publication: RemoteTrackPublication
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if publication.kind == .video {
                self.setRemoteVideoTrack(nil)
            }
        }
    }

    public nonisolated func room(
        _ room: Room,
        participant: Participant,
        trackPublication: TrackPublication,
        didUpdateIsMuted isMuted: Bool
    ) {
        let isRemote = !(participant is LocalParticipant)
        Task { @MainActor [weak self] in
            guard let self, let callId = self.callId, isRemote else { return }
            if trackPublication.kind == .audio {
                self.updateRemoteMuted(callId: callId, muted: isMuted)
                if isMuted {
                    self.updateSpeaking(
                        callId: callId,
                        localActive: self.localMicrophoneActive,
                        remoteSpeaking: false,
                        remoteLevel: 0
                    )
                }
            }
            if trackPublication.kind == .video {
                if isMuted {
                    self.setRemoteVideoTrack(nil)
                } else if let track = trackPublication.track as? VideoTrack {
                    self.setRemoteVideoTrack(track)
                }
            }
        }
    }

    public nonisolated func room(
        _ room: Room,
        participant: LocalParticipant,
        didPublishTrack publication: LocalTrackPublication
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if publication.source == .camera {
                self.refreshLocalVideoTrack()
            }
        }
    }

    public nonisolated func room(
        _ room: Room,
        participant: LocalParticipant,
        didUnpublishTrack publication: LocalTrackPublication
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if publication.source == .camera {
                self.refreshLocalVideoTrack()
            }
        }
    }
}
