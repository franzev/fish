import Foundation

/// Ports of `packages/core/src/call-state/selectors.ts` as computed
/// properties — the idiomatic Swift shape of `selectHasLiveCall` and
/// `selectCanMute`.
extension CallState {
    public var hasLiveCall: Bool {
        CallStateReducer.isLive(current)
    }

    public var canMute: Bool {
        current.status == .active || current.status == .reconnecting
    }
}
