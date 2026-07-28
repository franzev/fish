import CallData
import DesignSystem
import SwiftUI
import UIComponents
#if canImport(UIKit)
import UIKit
#endif

/// The app-level call host: binds `CallSessionModel` to the stateless
/// `CallSurface`, starts the realtime subscription, and keeps the screen
/// awake during video calls. Mount once above the app's content (the web
/// layout mounts `CallPopover` the same way). The host decides what
/// "minimized" means — `onMinimize` just signals intent, mirroring the
/// Android `CallRoute` hoisting `minimized` state at the call site.
public struct CallOverlay: View {
    private let model: CallSessionModel
    private let localVideo: () -> AnyView?
    private let remoteVideo: () -> AnyView?
    private let onMinimize: () -> Void

    public init(
        model: CallSessionModel,
        localVideo: @escaping () -> AnyView? = { nil },
        remoteVideo: @escaping () -> AnyView? = { nil },
        onMinimize: @escaping () -> Void = {}
    ) {
        self.model = model
        self.localVideo = localVideo
        self.remoteVideo = remoteVideo
        self.onMinimize = onMinimize
    }

    public var body: some View {
        let panel = model.panelState
        CallSurface(
            state: panel,
            actions: actions,
            localVideo: panel.localVideoAvailable ? localVideo() : nil,
            remoteVideo: panel.remoteVideoAvailable ? remoteVideo() : nil
        )
        .task { await model.start() }
        .onChange(of: panel.isVideoStageActive) { _, active in
            setIdleTimer(disabled: active)
        }
        .onDisappear { setIdleTimer(disabled: false) }
    }

    private var actions: CallPanelActions {
        var actions = CallPanelActions()
        actions.answer = { [model] in Task { await model.answer() } }
        actions.decline = { [model] in Task { await model.decline() } }
        actions.cancel = { [model] in Task { await model.cancel() } }
        actions.end = { [model] in Task { await model.end() } }
        actions.toggleMute = { [model] in Task { await model.toggleMute() } }
        actions.toggleCamera = { [model] in Task { await model.toggleCamera() } }
        actions.switchCamera = { [model] in Task { await model.switchCamera() } }
        actions.toggleSpeaker = { [model] in Task { await model.toggleSpeaker() } }
        actions.openMessages = onMinimize
        actions.setVideoQualityPreference = { [model] preference in
            Task { await model.setVideoQualityPreference(preference) }
        }
        return actions
    }

    private func setIdleTimer(disabled: Bool) {
        #if canImport(UIKit)
        UIApplication.shared.isIdleTimerDisabled = disabled
        #endif
    }
}
