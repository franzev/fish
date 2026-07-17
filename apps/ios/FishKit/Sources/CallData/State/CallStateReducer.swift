import Foundation

/// Pure lifecycle reducer — a verbatim port of
/// `packages/core/src/call-state/reducer.ts`. Every behavior here is pinned by
/// the shared fixture vectors replayed on web and iOS.
public enum CallStateReducer {
    public static let emptySession = CallSessionState()

    public static func emptyState() -> CallState {
        CallState(current: emptySession)
    }

    public static func reduce(_ state: CallState, _ event: CallEvent) -> CallState {
        let current = state.current

        switch event {
        case let .permissionRequested(counterpartId, counterpartName, kind):
            var next = emptySession
            next.counterpartId = counterpartId
            next.counterpartName = counterpartName
            next.kind = kind
            next.direction = .outgoing
            next.status = .requestingPermission
            return CallState(current: next)

        case let .permissionDenied(reason):
            var next = current
            next.status = .failed
            next.failureReason = reason
            return CallState(current: next)

        case let .outgoingCallCreated(callId, counterpartId, counterpartName, kind, expiresAt):
            var next = emptySession
            next.callId = callId
            next.counterpartId = counterpartId
            next.counterpartName = counterpartName
            next.kind = kind
            next.direction = .outgoing
            next.status = .ringing
            next.expiresAt = expiresAt
            return CallState(current: next)

        case let .incomingCallReceived(callId, counterpartId, counterpartName, kind, expiresAt):
            if isLive(current), current.callId != callId { return state }
            var next = emptySession
            next.callId = callId
            next.counterpartId = counterpartId
            next.counterpartName = counterpartName
            next.kind = kind
            next.direction = .incoming
            next.status = .ringing
            next.expiresAt = expiresAt
            return CallState(current: next)

        case let .callAccepted(callId):
            return forCurrentCall(state, callId) { call in
                var next = call
                next.status = .connecting
                next.failureReason = nil
                return next
            }

        case let .mediaConnected(callId, connectedAt):
            return forCurrentCall(state, callId) { call in
                var next = call
                next.status = .active
                next.connectedAt = call.connectedAt ?? connectedAt
                next.failureReason = nil
                return next
            }

        case let .muteChanged(muted):
            guard isLive(current) else { return state }
            var next = current
            next.muted = muted
            return CallState(current: next)

        case let .cameraChanged(enabled):
            guard isLive(current), current.kind == .video else { return state }
            var next = current
            next.cameraEnabled = enabled
            return CallState(current: next)

        case let .reconnecting(callId):
            return forCurrentCall(state, callId) { call in
                var next = call
                next.status = call.status == .active ? .reconnecting : call.status
                return next
            }

        case let .reconnected(callId):
            return forCurrentCall(state, callId) { call in
                var next = call
                next.status = call.status == .reconnecting ? .active : call.status
                return next
            }

        case let .callRejected(callId):
            return terminal(state, callId, .rejected)

        case let .callCancelled(callId):
            return terminal(state, callId, .cancelled)

        case let .callMissed(callId):
            return terminal(state, callId, .missed)

        case let .callEnded(callId):
            return terminal(state, callId, .ended)

        case let .callFailed(callId, reason):
            if let callId, current.callId != callId { return state }
            var next = current
            next.status = .failed
            next.failureReason = reason
            return CallState(current: next)

        case .clearCall, .identityChanged:
            return emptyState()
        }
    }

    static func isLive(_ call: CallSessionState) -> Bool {
        switch call.status {
        case .requestingPermission, .ringing, .connecting, .active, .reconnecting:
            true
        case .idle, .ended, .rejected, .cancelled, .missed, .failed:
            false
        }
    }

    private static func forCurrentCall(
        _ state: CallState,
        _ callId: String,
        _ update: (CallSessionState) -> CallSessionState
    ) -> CallState {
        state.current.callId == callId ? CallState(current: update(state.current)) : state
    }

    private static func terminal(
        _ state: CallState,
        _ callId: String,
        _ status: CallLifecycleStatus
    ) -> CallState {
        forCurrentCall(state, callId) { call in
            var next = call
            next.status = status
            return next
        }
    }
}
