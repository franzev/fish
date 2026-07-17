import CallData
@testable import Calls
import Testing

/// Pins every user-facing calling string to the web implementation
/// (`call-popover-view.tsx` `getCallCopy` and the `call-provider.tsx`
/// notices). The two deliberate platform adaptations are asserted here too so
/// a drift is always a conscious decision.
struct CallCopyTests {
    private func call(
        _ status: CallLifecycleStatus,
        direction: CallDirection? = .outgoing,
        kind: CallKind = .audio,
        name: String? = "Coach Mina",
        muted: Bool = false
    ) -> CallSessionState {
        CallSessionState(
            callId: "call-1",
            counterpartId: "user-2",
            counterpartName: name,
            kind: kind,
            status: status,
            direction: direction,
            muted: muted
        )
    }

    @Test func ringingCopyMatchesWeb() {
        let incomingVideo = CallCopy.stateCopy(
            for: call(.ringing, direction: .incoming, kind: .video)
        )
        #expect(incomingVideo.heading == "Coach Mina is calling")
        #expect(incomingVideo.status == "Video call. Answer when you’re ready.")

        let incomingUnknown = CallCopy.stateCopy(
            for: call(.ringing, direction: .incoming, name: nil)
        )
        #expect(incomingUnknown.heading == "Your call partner is calling")
        #expect(incomingUnknown.status == "Audio call. Answer when you’re ready.")

        let outgoing = CallCopy.stateCopy(for: call(.ringing))
        #expect(outgoing.heading == "Calling Coach Mina")
        #expect(outgoing.status == "Audio call. They’ll join when they’re ready.")
    }

    @Test func progressAndTerminalCopyMatchesWeb() {
        #expect(CallCopy.stateCopy(for: call(.connecting)) == CallCopy.StateCopy(
            heading: "Connecting with Coach Mina",
            status: "This usually takes a moment."
        ))
        #expect(CallCopy.stateCopy(for: call(.reconnecting)) == CallCopy.StateCopy(
            heading: "Reconnecting with Coach Mina",
            status: "The call will continue when the connection returns."
        ))
        #expect(CallCopy.stateCopy(for: call(.active)) == CallCopy.StateCopy(
            heading: "In call with Coach Mina",
            status: "Your microphone is on."
        ))
        #expect(CallCopy.stateCopy(for: call(.active, muted: true)).status
            == "Your microphone is muted.")
        #expect(CallCopy.stateCopy(for: call(.missed)) == CallCopy.StateCopy(
            heading: "You missed this call",
            status: "The call from Coach Mina has ended."
        ))
        #expect(CallCopy.stateCopy(for: call(.rejected)) == CallCopy.StateCopy(
            heading: "Call declined",
            status: "Messages are still available."
        ))
        #expect(CallCopy.stateCopy(for: call(.cancelled)) == CallCopy.StateCopy(
            heading: "Call cancelled",
            status: "Messages are still available."
        ))
        #expect(CallCopy.stateCopy(for: call(.failed)) == CallCopy.StateCopy(
            heading: "The call didn’t connect",
            status: "Messages still work."
        ))
        #expect(CallCopy.stateCopy(for: call(.ended)) == CallCopy.StateCopy(
            heading: "Call ended",
            status: "Messages are still available."
        ))
    }

    @Test func noticesMatchWebIncludingPlatformAdaptations() {
        // Verbatim web copy.
        #expect(CallCopy.finishCurrentCall
            == "Finish the current call before starting another one.")
        #expect(CallCopy.allowCameraToStart
            == "Allow camera and microphone access, then try the video call again.")
        #expect(CallCopy.microphoneUnavailable
            == "We couldn’t find a microphone. Check your device and try again.")
        #expect(CallCopy.cameraUnavailable
            == "We couldn’t find a camera and microphone. Check your devices and try again.")
        #expect(CallCopy.allowCameraToAnswer
            == "Allow camera and microphone access, then answer again.")
        #expect(CallCopy.callDidNotConnect
            == "The call didn’t connect. Messages still work.")
        #expect(CallCopy.callNoLongerAvailable
            == "This call is no longer available.")
        #expect(CallCopy.cameraStartFailed
            == "We couldn’t start your camera. Check its permission and try again.")
        #expect(CallCopy.cameraStopFailed
            == "We couldn’t turn off your camera yet. Try again.")

        // Platform adaptations: web says "in your browser".
        #expect(CallCopy.allowMicrophoneToStart
            == "Allow microphone access in Settings, then try the call again.")
        #expect(CallCopy.allowMicrophoneToAnswer
            == "Allow microphone access in Settings, then answer again.")
    }

    @Test func controlLabelsMatchWeb() {
        #expect(CallCopy.answer == "Answer")
        #expect(CallCopy.decline == "Decline")
        #expect(CallCopy.cancel == "Cancel")
        #expect(CallCopy.endCall == "End call")
        #expect(CallCopy.mute == "Mute")
        #expect(CallCopy.unmute == "Unmute")
        #expect(CallCopy.cameraOff == "Turn camera off")
        #expect(CallCopy.cameraOn == "Turn camera on")
        #expect(CallCopy.callSettings == "Call settings")
        #expect(CallCopy.openChat == "Open chat")
        #expect(CallCopy.closeChat == "Close chat")
        #expect(CallCopy.dataSaverTitle == "Use less data")
        #expect(CallCopy.dataSaverDescription
            == "Lowers video quality to help on slower connections.")
        #expect(CallCopy.voiceCallEntry(recipientName: "Ari") == "Voice call Ari")
        #expect(CallCopy.videoCallEntry(recipientName: "Ari") == "Video call Ari")
    }

    @Test func stageCopyMatchesWeb() {
        let video = call(.active, kind: .video)
        #expect(CallCopy.cameraOffPlaceholder(for: video)
            == "Coach Mina’s camera is off")
        #expect(CallCopy.remoteMutedPill(for: video) == "Coach Mina is muted")
        #expect(CallCopy.localPreviewLabel == "Your video preview")
        #expect(CallCopy.localCameraOff == "Your camera is off")
        #expect(CallCopy.messagesHeading == "Messages")
    }
}
