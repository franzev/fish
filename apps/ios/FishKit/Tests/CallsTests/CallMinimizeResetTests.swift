import CallData
@testable import Calls
import Testing

/// `shouldResetMinimized` decides whether a minimized call (see
/// `CompactCallBar`) should snap back to the full `CallOverlay`. These pin
/// the transition matrix directly — no SwiftUI harness needed — including
/// the sign-out repro that motivated keying the reset on call identity as
/// well as status: a stale `true` from a call that just ended must never
/// leak onto the next one.
struct CallMinimizeResetTests {
    @Test func staysMinimizedWhileTheSameCallIsStillInProgress() {
        // The user tapped "Messages" and nothing about the call has
        // changed since — minimizing must persist.
        #expect(shouldResetMinimized(
            previousCallId: "call-1",
            currentCallId: "call-1",
            isInProgress: true
        ) == false)
    }

    @Test func resetsWhenTheCallIsNoLongerInProgress() {
        // The same call ended (or is ringing again, failed, etc.) — the
        // web/Android parity behavior is to snap back, not to strand the
        // user on a compact bar for a call that's no longer live.
        #expect(shouldResetMinimized(
            previousCallId: "call-1",
            currentCallId: "call-1",
            isInProgress: false
        ) == true)
    }

    @Test func resetsOnACallToCallTransitionEvenIfTheNewCallIsAlreadyInProgress() {
        // A different call becoming current must force a reset by itself —
        // a status-only check would miss this if the new call is observed
        // already in progress (mirrors Android's CallRoute keying on
        // (callId, status) rather than status alone).
        #expect(shouldResetMinimized(
            previousCallId: "call-1",
            currentCallId: "call-2",
            isInProgress: true
        ) == true)
    }

    @Test func resetsWhenTheCallModelTearsDownToNoCallAtAll() {
        // Sign-out ends the call and clears the call model; there is no
        // current call id at all afterward.
        #expect(shouldResetMinimized(
            previousCallId: "call-1",
            currentCallId: nil,
            isInProgress: false
        ) == true)
    }

    @Test func aStaleMinimizeDoesNotSurviveSignOutIntoAFreshCall() {
        // Full repro: minimize call 1, sign out (ends call 1 and tears down
        // the call model), sign back in as a brand new call that goes
        // straight to active. The stale `true` from call 1 must not leak
        // onto call 2, even though the new call is already in progress by
        // the time it's observed and even though the call model itself was
        // replaced along the way.
        var isCallMinimized = false

        // Call 1 goes active; the user minimizes it.
        #expect(shouldResetMinimized(
            previousCallId: nil,
            currentCallId: "call-1",
            isInProgress: true
        ) == true) // no-op: already false
        isCallMinimized = true

        // Sign-out: call 1 ends and the call model disappears entirely.
        if shouldResetMinimized(previousCallId: "call-1", currentCallId: nil, isInProgress: false) {
            isCallMinimized = false
        }
        #expect(isCallMinimized == false)

        // A stale flag is set again to simulate the pre-fix bug, where the
        // reset above never actually fired (the observing view had already
        // been torn down along with the call model in the same update).
        isCallMinimized = true

        // Sign back in: call 2 arrives already active.
        if shouldResetMinimized(previousCallId: nil, currentCallId: "call-2", isInProgress: true) {
            isCallMinimized = false
        }
        #expect(isCallMinimized == false)
    }
}
