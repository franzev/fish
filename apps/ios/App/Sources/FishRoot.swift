import AccountSettings
import CallData
import CallMediaLiveKit
import Calls
import ChatCore
import ChatData
import DesignSystem
import Foundation
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

    var body: some View {
        ZStack {
            Group {
                switch model.phase {
                case .loading:
                    LoadingView()
                case .signedOut:
                    SignInView(model: model)
                case .inbox:
                    InboxView(model: model)
                case .opening:
                    LoadingView(message: "Opening conversation…")
                case .conversation:
                    ConversationView(model: model)
                }
            }
            if let callModel = model.callModel, let callMedia = model.callMedia {
                CallOverlay(
                    model: callModel,
                    localVideo: { callMedia.localVideoView() },
                    remoteVideo: { callMedia.remoteVideoView() }
                )
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
