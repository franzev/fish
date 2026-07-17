import CallData
import Foundation

/// Every user-facing calling string, ported from the web implementation
/// (`call-popover-view.tsx` and `call-provider.tsx`). Two strings adapt
/// browser wording to the platform ("in Settings" instead of "in your
/// browser", "Your device" instead of "Your browser") — recorded in the plan
/// document's deviations section. Copy stays calm and never scolds.
public enum CallCopy {
    public struct StateCopy: Equatable, Sendable {
        public let heading: String
        public let status: String

        public init(heading: String, status: String) {
            self.heading = heading
            self.status = status
        }
    }

    public static func stateCopy(for call: CallSessionState) -> StateCopy {
        let name = call.counterpartName ?? "your call partner"
        switch call.status {
        case .requestingPermission:
            return StateCopy(
                heading: "Preparing your call with \(name)",
                status: "Your device may ask for permission."
            )
        case .ringing where call.direction == .incoming:
            return StateCopy(
                heading: "\(call.counterpartName ?? "Your call partner") is calling",
                status: "\(call.kind == .video ? "Video" : "Audio") call. Answer when you’re ready."
            )
        case .ringing:
            return StateCopy(
                heading: "Calling \(name)",
                status: "\(call.kind == .video ? "Video" : "Audio") call. They’ll join when they’re ready."
            )
        case .connecting:
            return StateCopy(
                heading: "Connecting with \(name)",
                status: "This usually takes a moment."
            )
        case .reconnecting:
            return StateCopy(
                heading: "Reconnecting with \(name)",
                status: "The call will continue when the connection returns."
            )
        case .active:
            return StateCopy(
                heading: "In call with \(name)",
                status: call.muted ? "Your microphone is muted." : "Your microphone is on."
            )
        case .missed:
            return StateCopy(
                heading: "You missed this call",
                status: "The call from \(name) has ended."
            )
        case .rejected:
            return StateCopy(
                heading: "Call declined",
                status: "Messages are still available."
            )
        case .cancelled:
            return StateCopy(
                heading: "Call cancelled",
                status: "Messages are still available."
            )
        case .failed:
            return StateCopy(
                heading: "The call didn’t connect",
                status: "Messages still work."
            )
        case .idle, .ended:
            return StateCopy(
                heading: "Call ended",
                status: "Messages are still available."
            )
        }
    }

    // MARK: - Notices (session copy)

    public static let finishCurrentCall =
        "Finish the current call before starting another one."
    public static let allowMicrophoneToStart =
        "Allow microphone access in Settings, then try the call again."
    public static let allowCameraToStart =
        "Allow camera and microphone access, then try the video call again."
    public static let microphoneUnavailable =
        "We couldn’t find a microphone. Check your device and try again."
    public static let cameraUnavailable =
        "We couldn’t find a camera and microphone. Check your devices and try again."
    public static let allowMicrophoneToAnswer =
        "Allow microphone access in Settings, then answer again."
    public static let allowCameraToAnswer =
        "Allow camera and microphone access, then answer again."
    public static let callDidNotConnect =
        "The call didn’t connect. Messages still work."
    public static let callNoLongerAvailable =
        "This call is no longer available."
    public static let cameraStartFailed =
        "We couldn’t start your camera. Check its permission and try again."
    public static let cameraStopFailed =
        "We couldn’t turn off your camera yet. Try again."
    public static let cameraSwitchFailed =
        "We couldn’t switch your camera. Try again."

    // MARK: - Control labels

    public static let answer = "Answer"
    public static let decline = "Decline"
    public static let cancel = "Cancel"
    public static let endCall = "End call"
    public static let mute = "Mute"
    public static let unmute = "Unmute"
    public static let cameraOff = "Turn camera off"
    public static let cameraOn = "Turn camera on"
    public static let switchCamera = "Switch camera"
    public static let speakerOn = "Turn speaker on"
    public static let speakerOff = "Turn speaker off"
    public static let callSettings = "Call settings"
    public static let openChat = "Open chat"
    public static let closeChat = "Close chat"
    public static let dataSaverTitle = "Use less data"
    public static let dataSaverDescription =
        "Lowers video quality to help on slower connections."
    public static let audioRouteNote =
        "Your microphone and speaker follow your device’s audio routing."

    // MARK: - Activity panel

    public static let you = "You"
    public static let mutedLabel = "Muted"
    public static let voiceDetected = "Voice detected"
    public static let listening = "Listening"
    public static let speaking = "Speaking"
    public static let callActivity = "Call activity"

    public static func callPartner(_ call: CallSessionState) -> String {
        call.counterpartName ?? "Call partner"
    }

    // MARK: - Video stage

    public static func cameraOffPlaceholder(for call: CallSessionState) -> String {
        "\(call.counterpartName ?? "Your call partner")’s camera is off"
    }

    public static func remoteMutedPill(for call: CallSessionState) -> String {
        "\(call.counterpartName ?? "Your call partner") is muted"
    }

    public static let localPreviewLabel = "Your video preview"
    public static let localCameraOff = "Your camera is off"

    public static func remoteVideoLabel(for call: CallSessionState) -> String {
        "\(call.counterpartName ?? "Your call partner") video"
    }

    public static func remoteSpeakingLabel(for call: CallSessionState) -> String {
        "\(call.counterpartName ?? "Your call partner") is speaking"
    }

    // MARK: - Entry actions

    public static func voiceCallEntry(recipientName: String) -> String {
        "Voice call \(recipientName)"
    }

    public static func videoCallEntry(recipientName: String) -> String {
        "Video call \(recipientName)"
    }

    // MARK: - Chat pane

    public static let messagesHeading = "Messages"
}
