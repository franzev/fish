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

/// On regular-width iPad, shows the conversation list and the open
/// conversation side by side, mirroring Android's `ChatAdaptiveLayout`.
/// Compact width (iPhone, iPad split-screen narrow) falls back to exactly
/// today's single-pane phase switch, unchanged.
///
/// This intercepts the `.inbox`/`.opening`/`.conversation` cases that
/// `FishRoot`'s phase switch used to render directly. `.loading` and
/// `.signedOut` are handled by `FishRoot` itself and never reach this view.
///
/// The two-pane gate is a pure function (`shouldShowChatSplitLayout` in
/// `ChatCore`) so the "wide enough, and worth splitting" decision is
/// testable without a SwiftUI harness. `FishAppModel.directory` lives for
/// the whole signed-in session (set once at sign-in, cleared only at
/// sign-out — see `FishAppModel.swift`), so `InboxView` can stay mounted
/// alongside the detail pane with no additional state-residency work: it
/// already survives `.opening`/`.conversation` phase changes today.
struct ChatSplitLayout: View {
    @Bindable var model: FishAppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        if shouldShowChatSplitLayout(
            isRegularWidth: horizontalSizeClass == .regular,
            conversationCount: model.directory?.conversations.count ?? 0
        ) {
            HStack(spacing: 0) {
                InboxView(model: model)
                    .frame(width: Metrics.conversationRail)
                Rectangle()
                    .fill(Palette.divider)
                    .frame(width: 1)
                detailPane
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            singlePaneContent
        }
    }

    /// Today's phone flow, unchanged: exactly what `FishRoot` rendered for
    /// these three phases before this container existed.
    @ViewBuilder
    private var singlePaneContent: some View {
        switch model.phase {
        case .inbox:
            InboxView(model: model)
        case .opening:
            LoadingView(message: "Opening conversation…")
        case .conversation:
            ConversationView(model: model)
        case .loading, .signedOut:
            // FishRoot only routes to ChatSplitLayout for the three cases
            // above; this keeps the switch exhaustive without duplicating
            // FishRoot's own phase list.
            EmptyView()
        }
    }

    /// The right-hand pane in two-pane mode. The sidebar (`InboxView`) stays
    /// mounted the whole time it's shown — closing a conversation drops the
    /// phase back to `.inbox`, which here means "show the calm empty state",
    /// never "hide the list".
    @ViewBuilder
    private var detailPane: some View {
        switch model.phase {
        case .opening:
            LoadingView(message: "Opening conversation…")
        case .conversation:
            ConversationView(model: model)
        default:
            EmptyState(
                title: "Select a conversation",
                message: "Choose a conversation from the list to view it here."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Palette.bg)
        }
    }
}
