import DesignSystem
import SwiftUI

/// Keyed lazy transcript, bottom anchored and capped to the shared chat width.
public struct PersonalChatTranscript: View {
    private let items: [TranscriptItem]
    private let olderMessages: OlderMessagesState
    private let onRetryMessage: (String) -> Void
    private let onRetryOlder: () -> Void

    public init(
        items: [TranscriptItem],
        olderMessages: OlderMessagesState,
        onRetryMessage: @escaping (String) -> Void,
        onRetryOlder: @escaping () -> Void
    ) {
        self.items = items
        self.olderMessages = olderMessages
        self.onRetryMessage = onRetryMessage
        self.onRetryOlder = onRetryOlder
    }

    public var body: some View {
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
                        MessageBubble(row: row, onRetry: onRetryMessage)
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
