import CallData

/// Whether a minimized call (see `CompactCallBar`) should snap back to the
/// full `CallOverlay`. Two independent reasons force a reset, mirroring
/// Android's `CallRoute` — which keys its `LaunchedEffect` on
/// `(call.callId, call.status)` rather than status alone:
///
/// - The call is no longer in progress (it ended, failed, is ringing again,
///   etc.) — `isInProgress` is false.
/// - The *identity* of the current call changed: a different call is now
///   current, or there is no call at all (`currentCallId` is `nil`, e.g. the
///   call model was torn down on sign-out). This catches a call-to-call
///   transition even when the new call is already in-progress by the time
///   it's observed — a status-only check would miss it, and would let a
///   stale minimize flag from a previous call apply to a brand new one.
///
/// The host calls this with whatever it can observe even when there is no
/// call model at all (pass `nil` for `currentCallId` and `false` for
/// `isInProgress`) — the decision does not require a live call model.
public func shouldResetMinimized(
    previousCallId: String?,
    currentCallId: String?,
    isInProgress: Bool
) -> Bool {
    currentCallId != previousCallId || !isInProgress
}
