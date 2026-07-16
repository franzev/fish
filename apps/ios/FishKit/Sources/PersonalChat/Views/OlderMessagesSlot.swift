import DesignSystem
import SwiftUI
import UIComponents

/// Fixed pagination region. Idle, loading, and failure preserve identical
/// transcript geometry; hidden means no earlier history exists.
public struct OlderMessagesSlot: View {
    private let state: OlderMessagesState
    private let onRetry: () -> Void

    public init(
        state: OlderMessagesState,
        onRetry: @escaping () -> Void
    ) {
        self.state = state
        self.onRetry = onRetry
    }

    public var body: some View {
        if state != .hidden {
            content
                .frame(minHeight: Metrics.paginationSlot)
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .hidden, .idle:
            Color.clear
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack(spacing: Spacing.xs) {
                    SkeletonAvatar(size: .sm)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        SkeletonBar(width: Metrics.skeletonAuthorWidth)
                        SkeletonBar()
                    }
                }
                SkeletonBar()
            }
            .padding(.horizontal, Spacing.page)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading earlier messages")
        case .failed:
            VStack(spacing: Spacing.xs) {
                Text("Earlier messages didn't load.")
                    .textStyle(.caption)
                    .foregroundStyle(Palette.body)
                ActionButton(
                    "Try loading earlier messages again",
                    variant: .ghost,
                    action: onRetry
                )
            }
        }
    }
}
