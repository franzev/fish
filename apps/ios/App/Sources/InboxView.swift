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
                trailing: trailingActions,
                incomingRequestCount: incomingRequestCount,
                onOpenRequests: onOpenRequests,
                onAddFriend: onAddFriend
            )
        } else {
            LoadingView()
        }
    }

    private var incomingRequestCount: Int {
        model.friendsAvailable ? model.incomingRequestCount : 0
    }

    /// Absent rather than inert when friends is off: the screen is then the
    /// screen it has always been, with nothing extra to draw.
    private var onOpenRequests: (() -> Void)? {
        guard model.friendsAvailable else { return nil }
        return { model.showFriendRequests() }
    }

    private var onAddFriend: (() -> Void)? {
        guard model.friendsAvailable else { return nil }
        return { model.showAddFriend() }
    }

    /// Adding a friend reads before the account, so the account control stays
    /// exactly where it has always been: last.
    private var trailingActions: [TopBarAction] {
        var actions: [TopBarAction] = []
        if model.friendsAvailable {
            actions.append(
                TopBarAction(
                    icon: .personPlus,
                    accessibilityLabel: "Add a friend",
                    action: model.showAddFriend
                )
            )
        }
        actions.append(
            TopBarAction(
                icon: .person,
                accessibilityLabel: "Account settings",
                action: model.showAccountSettings
            )
        )
        return actions
    }
}
