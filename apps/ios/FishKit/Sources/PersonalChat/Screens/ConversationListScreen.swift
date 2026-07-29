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
    private let trailing: [TopBarAction]
    private let incomingRequestCount: Int
    private let onOpenRequests: (() -> Void)?
    private let onAddFriend: (() -> Void)?
    private let now: Date
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// `onOpenRequests` and `onAddFriend` are the whole friends surface here:
    /// absent, this screen is exactly the screen it has always been, down to
    /// the pixel. The count is only ever a row's wording, never a number on
    /// screen.
    public init(
        conversations: [ChatConversationPreview],
        currentUserId: String,
        notice: String? = nil,
        onOpen: @escaping (String) -> Void,
        onRetry: (() -> Void)? = nil,
        trailing: [TopBarAction] = [],
        incomingRequestCount: Int = 0,
        onOpenRequests: (() -> Void)? = nil,
        onAddFriend: (() -> Void)? = nil,
        now: Date = Date()
    ) {
        self.conversations = conversations
        self.currentUserId = currentUserId
        self.notice = notice
        self.onOpen = onOpen
        self.onRetry = onRetry
        self.trailing = trailing
        self.incomingRequestCount = incomingRequestCount
        self.onOpenRequests = onOpenRequests
        self.onAddFriend = onAddFriend
        self.now = now
    }

    public var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "Messages", trailing: trailing)
            if conversations.isEmpty {
                Spacer()
                VStack(spacing: Spacing.md) {
                    EmptyState(
                        title: notice == nil ? "No conversations yet" : "Messages aren’t available yet",
                        message: emptyMessage,
                        actionLabel: welcomesFriends ? "Add a friend" : nil,
                        isPrimaryAction: welcomesFriends,
                        onAction: welcomesFriends ? onAddFriend : nil
                    )
                    if notice != nil, let onRetry {
                        ActionButton("Try again", variant: .primary, action: onRetry)
                            .padding(.horizontal, Spacing.page)
                    }
                    // Without this the only way to a waiting request would be a
                    // list that someone with no conversations never sees. A
                    // failure keeps this screen exactly as it was, down to the
                    // one action it has always offered.
                    if welcomesFriends, incomingRequestCount > 0, let onOpenRequests {
                        requestsWaitingRow(onOpenRequests)
                            .padding(.horizontal, Spacing.page)
                    }
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.xs) {
                        if incomingRequestCount > 0, let onOpenRequests {
                            requestsWaitingRow(onOpenRequests)
                        }
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

    /// Nobody to talk to yet is a beginning, not a failure — but only when
    /// nothing actually failed. A notice keeps its own words and its own
    /// single action.
    private var welcomesFriends: Bool {
        onAddFriend != nil && notice == nil
    }

    private var emptyMessage: String {
        if let notice { return notice }
        return welcomesFriends
            ? "Add a friend to start talking."
            : "Your assigned conversations will appear here."
    }

    /// A friend request is waiting. Said once, quietly, as a row someone can
    /// open when they have the room for it — never a count, a badge, or a red
    /// dot, which would turn a kindness into a debt.
    private func requestsWaitingRow(_ onOpen: @escaping () -> Void) -> some View {
        Button(action: onOpen) {
            HStack(spacing: Spacing.sm) {
                Text(
                    incomingRequestCount == 1
                        ? "A friend request is waiting"
                        : "Friend requests are waiting"
                )
                .textStyle(.ui)
                .foregroundStyle(Palette.body)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon.chevronRight.image
                    .glyphFrame()
                    .foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .frame(minHeight: Metrics.targetTouch)
            .background(Palette.surface2, in: rowShape)
            .contentShape(rowShape)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens friend requests")
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
                quietMarker(preview)
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
                quietMarker(preview)
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
        Text(preview.hasDraft ? "Draft · \(snippet(preview))" : snippet(preview))
            .textStyle(.body)
            .foregroundStyle(preview.hasDraft ? Palette.notice : Palette.body)
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

    /// Marks a quiet conversation so it cannot be mistaken for one nobody has
    /// written in. The unread badge stays exactly as it is: quiet withholds the
    /// alert, not the count.
    @ViewBuilder private func quietMarker(_ preview: ChatConversationPreview) -> some View {
        if preview.mute.isQuiet(at: now) {
            Icon.moonFilled.image
                .glyphFrame()
                .foregroundStyle(Palette.muted)
                .accessibilityHidden(false)
                .accessibilityLabel("Quiet")
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
