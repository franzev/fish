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
    private let onVisibleMessage: (String) -> Void
    private let attachmentCommands: (any AttachmentCommandProviding)?
    private let imageLoader: MessageImageLoader
    private let fileDownloader: AttachmentFileDownloader

    public init(
        items: [TranscriptItem],
        olderMessages: OlderMessagesState,
        onRetryMessage: @escaping (String) -> Void,
        onRetryOlder: @escaping () -> Void,
        onMessageAction: @escaping (MessageAction) -> Void = { _ in },
        onVisibleMessage: @escaping (String) -> Void = { _ in },
        attachmentCommands: (any AttachmentCommandProviding)? = nil,
        imageLoader: MessageImageLoader = .shared,
        fileDownloader: AttachmentFileDownloader = AttachmentFileDownloader()
    ) {
        self.items = items
        self.olderMessages = olderMessages
        self.onRetryMessage = onRetryMessage
        self.onRetryOlder = onRetryOlder
        self.onMessageAction = onMessageAction
        self.onVisibleMessage = onVisibleMessage
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
                        MessageBubble(
                            row: row,
                            onRetry: onRetryMessage,
                            onAction: onMessageAction,
                            onReplyTap: { id in
                                withAnimation { proxy.scrollTo(id, anchor: .center) }
                            },
                            attachmentCommands: attachmentCommands,
                            imageLoader: imageLoader,
                            fileDownloader: fileDownloader
                        )
                        .id(row.id)
                        .onAppear { onVisibleMessage(row.id) }
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
        }
    }
}
