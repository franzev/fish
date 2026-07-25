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

extension Notification.Name {
    static let fishPushToken = Notification.Name("fish.push-token")
    static let fishOpenConversation = Notification.Name("fish.open-conversation")
    static let fishQuickReply = Notification.Name("fish.quick-reply")
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
