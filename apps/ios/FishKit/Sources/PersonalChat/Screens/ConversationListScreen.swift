import ChatData
import DesignSystem
import SwiftUI
import UIComponents

public struct ConversationListScreen: View {
    private let conversations: [ChatConversationPreview]
    private let currentUserId: String
    private let notice: String?
    private let onOpen: (String) -> Void
    private let onRetry: (() -> Void)?
    private let now: Date
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    public init(
        conversations: [ChatConversationPreview],
        currentUserId: String,
        notice: String? = nil,
        onOpen: @escaping (String) -> Void,
        onRetry: (() -> Void)? = nil,
        now: Date = Date()
    ) {
        self.conversations = conversations
        self.currentUserId = currentUserId
        self.notice = notice
        self.onOpen = onOpen
        self.onRetry = onRetry
        self.now = now
    }

    public var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "Messages")
            if conversations.isEmpty {
                Spacer()
                VStack(spacing: Spacing.md) {
                    EmptyState(
                        title: notice == nil ? "No conversations yet" : "Messages aren’t available yet",
                        message: notice ?? "Your assigned conversations will appear here."
                    )
                    if notice != nil, let onRetry {
                        ActionButton("Try again", variant: .primary, action: onRetry)
                            .padding(.horizontal, Spacing.page)
                    }
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.xs) {
                        if let notice {
                            Text(notice)
                                .textStyle(.caption)
                                .foregroundStyle(Palette.notice)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(conversations) { preview in
                            row(preview)
                        }
                    }
                    .padding(Spacing.page)
                    .frame(maxWidth: Metrics.chatContentMaxWidth)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .background(Palette.bg)
    }

    private func row(_ preview: ChatConversationPreview) -> some View {
        Button {
            onOpen(preview.conversationId)
        } label: {
            if dynamicTypeSize.isAccessibilitySize {
                accessibleRow(preview)
            } else {
                compactRow(preview)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens conversation")
    }

    private func compactRow(_ preview: ChatConversationPreview) -> some View {
        HStack(spacing: Spacing.sm) {
            Avatar(name: preview.participantDisplayName, size: .md)
            VStack(alignment: .leading, spacing: Spacing.threeXs) {
                participantName(preview)
                snippetText(preview)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: Spacing.xs) {
                relativeTime(preview)
                unreadBadge(preview)
            }
        }
        .padding(Spacing.sm)
        .frame(minHeight: 56)
        .background(Palette.surface, in: rowShape)
    }

    private func accessibleRow(_ preview: ChatConversationPreview) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Avatar(name: preview.participantDisplayName, size: .md)
                participantName(preview)
            }
            snippetText(preview)
            HStack(spacing: Spacing.sm) {
                Spacer()
                relativeTime(preview)
                unreadBadge(preview)
            }
        }
        .padding(Spacing.sm)
        .frame(minHeight: 56)
        .background(Palette.surface, in: rowShape)
    }

    private func participantName(_ preview: ChatConversationPreview) -> some View {
        Text(preview.participantDisplayName)
            .textStyle(.label)
            .foregroundStyle(Palette.foreground)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func snippetText(_ preview: ChatConversationPreview) -> some View {
        Text(snippet(preview))
            .textStyle(.body)
            .foregroundStyle(Palette.body)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func relativeTime(_ preview: ChatConversationPreview) -> some View {
        if let date = preview.latestMessageCreatedAt {
            let relative = ConversationRelativeTime.make(from: date, relativeTo: now)
            Text(relative.shortLabel)
                .textStyle(.caption)
                .foregroundStyle(Palette.muted)
                .accessibilityLabel(relative.accessibilityLabel)
        }
    }

    @ViewBuilder private func unreadBadge(_ preview: ChatConversationPreview) -> some View {
        if preview.unreadCount > 0 {
            Text(preview.unreadCount > 99 ? "99+" : String(preview.unreadCount))
                .textStyle(.caption)
                .foregroundStyle(Palette.foreground)
                .padding(.horizontal, Spacing.xs)
                .frame(minHeight: 24)
                .background(Palette.surface2, in: Capsule())
                .accessibilityLabel(
                    "\(preview.unreadCount) unread message\(preview.unreadCount == 1 ? "" : "s")"
                )
        }
    }

    private var rowShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
    }

    private func snippet(_ preview: ChatConversationPreview) -> String {
        guard !preview.latestMessageText.isEmpty else { return "No messages yet" }
        let prefix = preview.latestMessageSenderId == currentUserId ? "You: " : ""
        return prefix + preview.latestMessageText
    }
}
