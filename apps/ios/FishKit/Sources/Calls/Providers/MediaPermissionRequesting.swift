import AVFoundation
import CallData

/// Outcome of a device permission probe — mirrors the web
/// `requestMediaPermission` result set.
public enum MediaPermissionOutcome: Sendable, Equatable {
    case granted
    case denied
    case unavailable
}

/// Requests capture permission for a call kind. Injected so session tests
/// and catalog fixtures never touch real device permission state.
public protocol MediaPermissionRequesting: Sendable {
    func requestAccess(for kind: CallKind) async -> MediaPermissionOutcome
}

/// Live implementation over AVFoundation. Permission is only ever requested
/// from an explicit call gesture (start or answer), matching the web flow —
/// never at launch.
public struct DeviceMediaPermissions: MediaPermissionRequesting {
    public init() {}

    public func requestAccess(for kind: CallKind) async -> MediaPermissionOutcome {
        guard await AVAudioApplication.requestRecordPermission() else {
            return .denied
        }
        guard kind == .video else { return .granted }
        guard AVCaptureDevice.default(for: .video) != nil else {
            // No camera hardware (for example the simulator) — the calm
            // "check your devices" path, same as the web NotFoundError case.
            return .unavailable
        }
        return await AVCaptureDevice.requestAccess(for: .video) ? .granted : .denied
    }
}
