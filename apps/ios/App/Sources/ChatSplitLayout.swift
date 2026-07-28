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
/// Compact width (iPhone, iPad split-screen narrow) shows the same content
/// full width, with the rail simply absent — today's single-pane phone flow
/// is what's left once the rail disappears, not a separate view tree.
///
/// This intercepts the `.inbox`/`.opening`/`.conversation` cases that
/// `FishRoot`'s phase switch used to render directly. `.loading` and
/// `.signedOut` are handled by `FishRoot` itself and never reach this view.
///
/// ## View identity
///
/// The container is a single `HStack` at all times: an optional leading
/// rail (`InboxView` + divider), then `mainContent`, always in that
/// structural position. This matters because `ConversationView` owns local
/// `@State` (navigation path, shared-content sheets, QuickLook preview —
/// see `ConversationView.swift:19-27`) that SwiftUI discards whenever a
/// view's position in the tree changes shape. Toggling the leading rail's
/// presence (an `if` sibling) never touches `mainContent`'s own structural
/// position, so `ConversationView` keeps its identity — and its state —
/// across:
///
/// - a realtime directory update changing the conversation count (the rail
///   sibling appears/disappears; `mainContent` doesn't move), and
/// - a horizontal size-class change — rotation, or a Split View/Stage
///   Manager resize — while a conversation is open (`showsRail` reads
///   `horizontalSizeClass`, but again only toggles the rail sibling, never
///   `mainContent`'s position).
///
/// An earlier draft of this container used a top-level
/// `if isRegularWidth { twoPaneTree } else { singlePaneTree }`, which are
/// two *different* subtrees as far as SwiftUI is concerned — flipping
/// between them tore `ConversationView` down and rebuilt it, silently
/// popping the nav stack and dismissing any open sheet. Unifying the
/// structure into one `HStack` removes that failure mode entirely for both
/// triggers, rather than accepting either as a known gap.
///
/// `FishAppModel.directory` lives for the whole signed-in session (set once
/// at sign-in, cleared only at sign-out — see `FishAppModel.swift`), and
/// `InboxView` holds no local `@State` of its own, so it can move freely
/// between the rail and `mainContent` as `showsRail` changes with no
/// state-residency concerns.
struct ChatSplitLayout: View {
    @Bindable var model: FishAppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        HStack(spacing: 0) {
            if showsRail {
                InboxView(model: model)
                    .frame(width: Metrics.conversationRail)
                Rectangle()
                    .fill(Palette.divider)
                    .frame(width: 1)
            }
            mainContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Whether the rail (conversation list) shows alongside `mainContent`.
    /// The gate itself — regular width and more than one conversation,
    /// mirroring Android's `ChatAdaptiveLayout` — is unchanged from the
    /// original single-branch draft; see `shouldShowChatSplitLayout` in
    /// `ChatCore` for the tested decision, and the "View identity" note
    /// above for why toggling this is safe even mid-conversation.
    private var showsRail: Bool {
        shouldShowChatSplitLayout(
            isRegularWidth: horizontalSizeClass == .regular,
            conversationCount: model.directory?.conversations.count ?? 0
        )
    }

    /// The rail's counterpart: full inbox, opening spinner, or the open
    /// conversation. When `showsRail` is false, `.inbox` shows the full list
    /// here instead of the rail (compact width, or regular width with too
    /// few conversations to make a rail worthwhile); when `showsRail` is
    /// true, `.inbox` shows a calm placeholder since the list itself is
    /// already visible in the rail.
    @ViewBuilder
    private var mainContent: some View {
        switch model.phase {
        case .inbox:
            if showsRail {
                EmptyState(
                    title: "No conversation selected",
                    message: "Choose a conversation from the list to view it here."
                )
            } else {
                InboxView(model: model)
            }
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
}
