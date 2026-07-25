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

struct InboxView: View {
    @Bindable var model: FishAppModel

    var body: some View {
        if let directory = model.directory {
            ConversationListScreen(
                conversations: directory.conversations,
                currentUserId: model.currentUserId,
                notice: directory.notice,
                onOpen: { id in Task { await model.openConversation(id) } },
                onRetry: { Task { await model.refreshDirectory() } },
                trailing: TopBarAction(
                    icon: .person,
                    accessibilityLabel: "Account settings",
                    action: model.showAccountSettings
                )
            )
        } else {
            LoadingView()
        }
    }
}
