import AccountSettings
import CallData
import CallMediaLiveKit
import Calls
import ChatCore
import ChatData
import DesignSystem
import Foundation
import Friends
import Observation
import PersonalChat
import QuickLook
import SwiftUI
import UIKit
import UIComponents
import UserNotifications

struct FishRoot: View {
    @Bindable var model: FishAppModel
    @Bindable var deviceSettings: DeviceSettingsStore
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var isCallMinimized = false

    /// Identifies "which call, in what progress state" regardless of
    /// whether a call model currently exists — `FishAppModel` tears
    /// `callModel` down to `nil` on sign-out (ending any live call first),
    /// which can happen inside one async run without SwiftUI ever rendering
    /// the in-between "call model present but call already ended" state. A
    /// `.onChange` scoped inside `if let callModel = model.callModel { … }`
    /// would never fire for that transition, since the view carrying it
    /// disappears in the same update. Computing this key unconditionally,
    /// and watching it from outside that `if let`, means the reset always
    /// has a value to compare against — including the "no call at all" one.
    private struct CallTransitionKey: Equatable {
        let callId: String?
        let isInProgress: Bool
    }

    private var callTransitionKey: CallTransitionKey {
        guard let callModel = model.callModel else {
            return CallTransitionKey(callId: nil, isInProgress: false)
        }
        let call = callModel.panelState.call
        return CallTransitionKey(callId: call.callId, isInProgress: call.status.isInProgress)
    }

    var body: some View {
        ZStack {
            Group {
                switch model.phase {
                case .loading:
                    LoadingView()
                case .signedOut:
                    SignInView(model: model)
                case .inbox, .opening, .conversation:
                    ChatSplitLayout(model: model)
                }
            }
            if let callModel = model.callModel, let callMedia = model.callMedia {
                let panel = callModel.panelState
                if isCallMinimized && panel.isInProgress {
                    CompactCallBar(
                        call: panel.call,
                        busy: panel.busy,
                        onReturn: { isCallMinimized = false },
                        onEnd: { Task { await callModel.end() } }
                    )
                } else {
                    CallOverlay(
                        model: callModel,
                        localVideo: { callMedia.localVideoView() },
                        remoteVideo: { callMedia.remoteVideoView() },
                        onMinimize: { isCallMinimized = true }
                    )
                }
            }
        }
        // A fresh call (or no call at all — sign-out, or before a call ever
        // starts) re-uses the same `isCallMinimized` state, so clear it
        // whenever the current call's identity or progress changes — a new
        // incoming call ringing, this one ending, or the call model
        // disappearing entirely on sign-out. Mirrors Android's `CallRoute`
        // `LaunchedEffect(call.callId, call.status)`. Kept outside the
        // `if let callModel` above so it isn't gated on a call model
        // existing — see `callTransitionKey`.
        .onChange(of: callTransitionKey) { old, new in
            if shouldResetMinimized(
                previousCallId: old.callId,
                currentCallId: new.callId,
                isInProgress: new.isInProgress
            ) {
                isCallMinimized = false
            }
        }
        .background(Palette.bg)
        .preferredColorScheme(deviceSettings.appearance.colorScheme)
        .environment(
            \.fishReduceMotion,
            deviceSettings.effectiveReduceMotion(systemReduceMotion: systemReduceMotion)
        )
        .sheet(isPresented: $model.isShowingAccountSettings) {
            AccountSettingsSheet(
                displayName: model.accountDisplayName,
                presence: model.accountPresence,
                notificationStatus: model.notificationStatus,
                appearance: deviceSettings.appearance,
                motion: deviceSettings.motion,
                canManageBlockedPeople: model.canManageBlockedPeople,
                notice: model.notice,
                blockedPeopleState: model.blockedPeopleState,
                onRefreshNotifications: { model.refreshNotificationSettingsIfNeeded() },
                onAllowNotifications: { model.requestNotifications() },
                onOpenNotificationSettings: { model.openNotificationSettings() },
                onSetPresence: { visibility, duration in
                    model.setPresence(visibility: visibility, duration: duration)
                },
                onLoadBlockedPeople: { model.loadBlockedPeople() },
                onUnblock: { userId in model.unblock(userId: userId) },
                onOpenPrivacyPolicy: { model.openWebPage(.privacy) },
                onSetAppearance: deviceSettings.setAppearance,
                onSetMotion: deviceSettings.setMotion,
                onResetPassword: { model.openWebPage(.forgotPassword) },
                onSignOut: {
                    model.isShowingAccountSettings = false
                    Task { await model.signOut() }
                }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        // The add sheet's review pivot closes this one and opens the next from
        // `onDismiss`, once SwiftUI has actually let go of the first — see
        // `FishAppModel.reviewFriendRequest`.
        .sheet(isPresented: $model.isShowingAddFriend, onDismiss: model.addFriendDismissed) {
            if let addFriend = model.addFriendModel {
                AddFriendSheet(model: addFriend) {
                    model.isShowingAddFriend = false
                }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
        }
        .sheet(
            isPresented: $model.isShowingFriendRequests,
            onDismiss: model.friendRequestsDismissed
        ) {
            if let requests = model.friendRequestsModel {
                FriendRequestsSheet(model: requests) {
                    model.isShowingFriendRequests = false
                }
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            model.sharedContentScenePhaseChanged(phase)
            if phase == .active {
                model.refreshNotificationSettingsIfNeeded()
                Task { await model.sharedContentIdentityCoordinator.foreground() }
            }
        }
        .task {
            model.refreshNotificationSettingsIfNeeded()
            await model.start()
        }
    }
}
