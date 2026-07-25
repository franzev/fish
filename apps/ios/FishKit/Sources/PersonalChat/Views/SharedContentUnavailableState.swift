import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct SharedContentUnavailableState: View {
    let presentation: SharedContentPresentationContract
    let onRetry: () -> Void

    @ViewBuilder var body: some View {
        switch presentation.unavailableReason {
        case .none, .loading, .identityIneligible:
            EmptyView()
        case .authoritativeEmpty:
            EmptyState(
                title: "No shared content yet",
                message: "Items shared in this conversation will appear here."
            )
        case .offlineNoCache:
            EmptyState(
                title: "Shared content isn't available offline",
                message: "Connect to the internet to load it."
            )
        case .authorityUnavailable:
            EmptyState(
                title: "Shared content isn't available right now",
                message: "Reconnect and try again.",
                actionLabel: presentation.manualRetry == .enabled ? "Try again" : nil,
                onAction: presentation.manualRetry == .enabled ? onRetry : nil
            )
        }
    }
}
