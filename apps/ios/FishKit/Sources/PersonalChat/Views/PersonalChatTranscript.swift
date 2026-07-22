import ChatData
import DesignSystem
import SwiftUI

/// Keyed lazy transcript, bottom anchored and capped to the shared chat width.
public struct PersonalChatTranscript: View {
    private let items: [TranscriptItem]
    private let olderMessages: OlderMessagesState
    private let onRetryMessage: (String) -> Void
    private let onRetryOlder: () -> Void
    private let onMessageAction: (MessageAction) -> Void
    private let onFocusMessage: (String) -> Void
    private let onVisibleMessage: (String) -> Void
    private let onCallBack: (String) -> Void
    private let reactionsEnabled: Bool
    private let attachmentCommands: (any AttachmentCommandProviding)?
    private let imageLoader: MessageImageLoader
    private let fileDownloader: AttachmentFileDownloader
    private let focusedMessageId: String?
    @Environment(\.fishReduceMotion) private var reduceMotion

    public init(
        items: [TranscriptItem],
        olderMessages: OlderMessagesState,
        onRetryMessage: @escaping (String) -> Void,
        onRetryOlder: @escaping () -> Void,
        onMessageAction: @escaping (MessageAction) -> Void = { _ in },
        focusedMessageId: String? = nil,
        onFocusMessage: @escaping (String) -> Void = { _ in },
        onVisibleMessage: @escaping (String) -> Void = { _ in },
        onCallBack: @escaping (String) -> Void = { _ in },
        reactionsEnabled: Bool = true,
        attachmentCommands: (any AttachmentCommandProviding)? = nil,
        imageLoader: MessageImageLoader = .shared,
        fileDownloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.items = items
        self.olderMessages = olderMessages
        self.onRetryMessage = onRetryMessage
        self.onRetryOlder = onRetryOlder
        self.onMessageAction = onMessageAction
        self.focusedMessageId = focusedMessageId
        self.onFocusMessage = onFocusMessage
        self.onVisibleMessage = onVisibleMessage
        self.onCallBack = onCallBack
        self.reactionsEnabled = reactionsEnabled
        self.attachmentCommands = attachmentCommands
        self.imageLoader = imageLoader
        self.fileDownloader = fileDownloader
    }

    public var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Spacing.xs) {
                OlderMessagesSlot(
                    state: olderMessages,
                    onRetry: onRetryOlder
                )
                ForEach(items) { item in
                    switch item {
                    case .daySeparator(_, let label):
                        MessageDaySeparator(label: label)
                            .padding(.top, Spacing.sm)
                    case .unreadDivider:
                        UnreadMessagesDivider()
                    case .message(let row):
                        focusTreatment(
                            MessageBubble(
                                row: row,
                                onRetry: onRetryMessage,
                                onAction: onMessageAction,
                                onReplyTap: onFocusMessage,
                                reactionsEnabled: reactionsEnabled,
                                attachmentCommands: attachmentCommands,
                                imageLoader: imageLoader,
                                fileDownloader: fileDownloader
                            )
                            .id(row.id),
                            isFocused: focusedMessageId == row.id
                        )
                        .onAppear { onVisibleMessage(row.id) }
                    case .callActivity(let activity):
                        CallActivityRow(activity: activity, onCallBack: onCallBack)
                    }
                }
            }
            .padding(.horizontal, Spacing.page)
            .padding(.vertical, Spacing.xs)
            .frame(maxWidth: Metrics.chatContentMaxWidth)
            .frame(maxWidth: .infinity)
            }
            .defaultScrollAnchor(.bottom)
            .scrollDismissesKeyboard(.interactively)
            .onAppear { scrollToFocusedMessage(using: proxy) }
            .onChange(of: focusedMessageId) { _, _ in
                scrollToFocusedMessage(using: proxy)
            }
            .onChange(of: messageIDs) { _, _ in
                scrollToFocusedMessage(using: proxy)
            }
        }
    }

    private var messageIDs: [String] {
        items.compactMap { item in
            guard case .message(let row) = item else { return nil }
            return row.id
        }
    }

    @ViewBuilder
    private func focusTreatment<Content: View>(
        _ content: Content,
        isFocused: Bool
    ) -> some View {
        if isFocused {
            content
                .padding(.vertical, Spacing.nudge)
                .background(
                    Palette.chatActive,
                    in: RoundedRectangle(
                        cornerRadius: Radius.card,
                        style: .continuous
                    )
                )
        } else {
            content
        }
    }

    private func scrollToFocusedMessage(using proxy: ScrollViewProxy) {
        guard let focusedMessageId, messageIDs.contains(focusedMessageId) else { return }
        if reduceMotion {
            proxy.scrollTo(focusedMessageId, anchor: .center)
        } else {
            withAnimation { proxy.scrollTo(focusedMessageId, anchor: .center) }
        }
    }
}
