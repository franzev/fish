import CallData
import SwiftUI

/// Smoothed speaking activity for both parties — the payload of the web
/// adapter's `onSpeakingChanged`.
public struct CallMediaSpeaking: Sendable, Equatable {
    public var localMicrophoneActive: Bool
    public var localMicrophoneLevel: Double
    public var remoteSpeaking: Bool
    public var remoteMicrophoneLevel: Double

    public init(
        localMicrophoneActive: Bool = false,
        localMicrophoneLevel: Double = 0,
        remoteSpeaking: Bool = false,
        remoteMicrophoneLevel: Double = 0
    ) {
        self.localMicrophoneActive = localMicrophoneActive
        self.localMicrophoneLevel = localMicrophoneLevel
        self.remoteSpeaking = remoteSpeaking
        self.remoteMicrophoneLevel = remoteMicrophoneLevel
    }
}

/// Media-plane events — a one-to-one port of the web `CallMediaCallbacks`
/// (minus browser autoplay recovery, which has no iOS equivalent).
public enum CallMediaEvent: Sendable, Equatable {
    case connected(callId: String)
    case reconnecting(callId: String)
    case reconnected(callId: String)
    case disconnected(callId: String)
    case speakingChanged(callId: String, CallMediaSpeaking)
    case remoteMuteChanged(callId: String, muted: Bool)
    case localVideoChanged(available: Bool)
    case remoteVideoChanged(available: Bool)
    case cameraChanged(enabled: Bool)
}

/// The feature-local media port (the iOS mirror of `LiveKitCallMedia` on
/// web). Media is inherently a UI concern — it vends the live video surfaces
/// — so the port lives in the feature module and stays `@MainActor`.
/// `CallMediaLiveKit` provides the production conformance; tests and the
/// catalog use scripted fakes.
@MainActor
public protocol CallMediaProviding: AnyObject {
    /// Session-model event sink. Set once by the owner before connecting.
    var onEvent: (@MainActor (CallMediaEvent) -> Void)? { get set }

    /// Joins the room and publishes the requested sources. Throwing means the
    /// media session could not be established; the caller runs the calm
    /// connect-failure path.
    func connect(
        callId: String,
        connection: CallConnection,
        publishMicrophone: Bool,
        publishCamera: Bool
    ) async throws

    func setMuted(_ muted: Bool) async
    func setCameraEnabled(_ enabled: Bool) async throws
    func switchCamera() async throws
    func setSpeakerEnabled(_ enabled: Bool) async
    func setVideoQualityPreference(_ preference: VideoQualityPreference) async
    func disconnect() async

    /// Live video surfaces, available while the corresponding track exists
    /// (`localVideoChanged` / `remoteVideoChanged` announce transitions).
    func localVideoView() -> AnyView?
    func remoteVideoView() -> AnyView?
}
