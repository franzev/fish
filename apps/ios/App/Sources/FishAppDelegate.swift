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

@MainActor
final class FishAppDelegate: NSObject, UIApplicationDelegate, @MainActor UNUserNotificationCenterDelegate {
    private let voipPushCoordinator = VoipPushCoordinator()
    private let notificationReplyStore = FileChatNotificationReplyStore.shared

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: fishMessageNotificationCategory,
                actions: [
                    UNTextInputNotificationAction(
                        identifier: fishMessageReplyAction,
                        title: "Reply",
                        options: [],
                        textInputButtonTitle: "Send",
                        textInputPlaceholder: "Message"
                    )
                ],
                intentIdentifiers: [],
                options: [.hiddenPreviewsShowTitle]
            )
        ])
        center.getNotificationSettings { settings in
            guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else {
                return
            }
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationCenter.default.post(name: .fishPushToken, object: token)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Push is an enhancement; direct chat remains available without it.
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Realtime chat already updates the visible conversation; avoid a
        // competing foreground banner.
        completionHandler([])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let conversationId = userInfo["conversationId"] as? String,
           !conversationId.isEmpty {
            let messageId = (userInfo["messageId"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .nilIfEmpty
            if response.actionIdentifier == fishMessageReplyAction,
               let textResponse = response as? UNTextInputNotificationResponse {
                let body = textResponse.userText.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !body.isEmpty, body.count <= 4_000 else {
                    completionHandler()
                    return
                }
                let reply = ChatNotificationReply(conversationId: conversationId, body: body)
                Task { @MainActor [notificationReplyStore] in
                    try? await notificationReplyStore.enqueue(reply)
                    NotificationCenter.default.post(
                        name: .fishQuickReply,
                        object: reply
                    )
                    completionHandler()
                }
                return
            }
            NotificationCenter.default.post(
                name: .fishOpenConversation,
                object: FishNotificationDestination(
                    conversationId: conversationId,
                    messageId: messageId,
                    notificationId: response.notification.request.identifier
                )
            )
        }
        completionHandler()
    }
}

private let fishMessageNotificationCategory = "fish.message"

private let fishMessageReplyAction = "fish.message.reply"
