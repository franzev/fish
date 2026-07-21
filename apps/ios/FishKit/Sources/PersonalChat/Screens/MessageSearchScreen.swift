import DesignSystem
import SwiftUI
import UIKit
import UIComponents

/// Focused, session-only search for the currently open direct conversation.
public struct MessageSearchScreen: View {
    @Bindable private var model: MessageSearchModel
    private let onSelect: (String) -> Void

    public init(
        model: MessageSearchModel,
        onSelect: @escaping (String) -> Void
    ) {
        self.model = model
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(spacing: 0) {
            TopBar(
                title: "Search messages",
                trailing: TopBarAction(
                    icon: .close,
                    accessibilityLabel: "Close",
                    action: model.close
                )
            )
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    InputField(
                        label: "Search messages",
                        text: $model.query,
                        submitLabel: .search,
                        onSubmit: model.submitImmediately,
                        autoFocus: true
                    )
                    content
                }
                .frame(maxWidth: Metrics.chatContentMaxWidth)
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.horizontal, Spacing.page)
                .padding(.vertical, Spacing.md)
                .padding(.bottom, Spacing.xl)
            }
        }
        .background(Palette.bg)
        .onChange(of: model.status) { _, status in
            announce(status)
        }
        .onDisappear { model.close() }
    }

    @ViewBuilder private var content: some View {
        switch model.status {
        case .initial:
            EmptyState(title: "Search this conversation.")
        case .loading:
            loadingContent
        case .empty:
            EmptyState(title: "No messages match this search.")
        case .ready, .notice:
            resultsContent
        }
    }

    private var loadingContent: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: Spacing.twoXs) {
                    HStack(spacing: Spacing.xs) {
                        SkeletonBar(width: 72)
                        SkeletonBar(width: 96)
                    }
                    SkeletonBar()
                    SkeletonBar(width: 220)
                }
                .padding(.vertical, Spacing.xs)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Searching messages")
    }

    private var resultsContent: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            if model.results.isEmpty, let notice = model.notice {
                Notice(
                    tone: .notice,
                    title: notice,
                    actionLabel: "Try again",
                    onAction: model.retry
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(model.results) { result in
                        Button {
                            onSelect(result.id)
                        } label: {
                            VStack(alignment: .leading, spacing: Spacing.twoXs) {
                                HStack(spacing: Spacing.xs) {
                                    Text(result.senderLabel)
                                        .textStyle(.label)
                                        .foregroundStyle(Palette.foreground)
                                    Text("·")
                                        .textStyle(.caption)
                                        .foregroundStyle(Palette.muted)
                                    Text(result.dateLabel)
                                        .textStyle(.caption)
                                        .foregroundStyle(Palette.muted)
                                }
                                Text(result.excerpt)
                                    .textStyle(.body)
                                    .foregroundStyle(Palette.body)
                                    .lineLimit(3)
                                    .multilineTextAlignment(.leading)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(maxWidth: .infinity, minHeight: Metrics.targetTouch, alignment: .leading)
                            .padding(.vertical, Spacing.xs)
                        }
                        .buttonStyle(.plain)
                        .contentShape(Rectangle())
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(result.accessibilityLabel)
                        .accessibilityHint("Opens this message in the conversation")
                        if result.id != model.results.last?.id {
                            Palette.divider
                                .frame(height: 1)
                                .accessibilityHidden(true)
                        }
                    }
                }
                .accessibilityValue(model.isLoadingMore ? "Loading more results" : "")
            }

            if let notice = model.notice, !model.results.isEmpty {
                Notice(
                    tone: .notice,
                    title: notice,
                    actionLabel: "Try again",
                    onAction: model.retry
                )
            } else if model.hasMoreResults {
                ActionButton(
                    "Show more results",
                    variant: .secondary,
                    isLoading: model.isLoadingMore,
                    fullWidth: true,
                    action: model.loadMore
                )
            }
        }
    }

    private func announce(_ status: MessageSearchModel.Status) {
        let message: String?
        switch status {
        case .initial, .loading:
            message = nil
        case .ready:
            message = "Search results updated."
        case .empty:
            message = "No messages match this search."
        case .notice:
            message = model.notice ?? MessageSearchModel.searchNotice
        }
        guard let message else { return }
        UIAccessibility.post(notification: .announcement, argument: message)
    }
}
