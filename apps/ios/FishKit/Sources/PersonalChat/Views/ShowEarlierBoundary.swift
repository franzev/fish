import ChatCore
import DesignSystem
import SwiftUI
import UIComponents

struct ShowEarlierBoundary: View {
    let state: SharedContentEarlierState
    let onShowEarlier: () -> Void

    @ViewBuilder var body: some View {
        switch state {
        case .hidden:
            EmptyView()
        case .ready:
            ActionButton(
                "Show earlier content",
                variant: .secondary,
                fullWidth: true,
                action: onShowEarlier
            )
        case .loading:
            ActionButton(
                "Show earlier content",
                variant: .secondary,
                isLoading: true,
                fullWidth: true,
                action: onShowEarlier
            )
        case .failed:
            Notice(
                tone: .notice,
                title: "Earlier content didn't load. Try again.",
                actionLabel: "Try again",
                onAction: onShowEarlier
            )
        case .offline:
            Text("Connect to see more shared content.")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
                .frame(
                    maxWidth: .infinity,
                    minHeight: Metrics.targetTouch,
                    alignment: .center
                )
                .multilineTextAlignment(.center)
        }
    }
}
