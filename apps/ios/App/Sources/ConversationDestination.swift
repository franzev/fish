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

enum ConversationDestination: Hashable {
    case details(SharedContentNavigationContext)
    case sharedContent(SharedContentNavigationIntent)
}
