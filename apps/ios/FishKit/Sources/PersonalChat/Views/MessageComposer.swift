import DesignSystem
import SwiftUI
import UIComponents

public enum ComposerSendState: Sendable, Equatable {
    case ready
    case sending
    case offline
}

/// The chat's single primary action. Blank and offline drafts expose no send
/// affordance; sending preserves a busy control even after the draft clears.
public struct MessageComposer: View {
    @Binding private var draft: String
    private let sendState: ComposerSendState
    private let onSend: () -> Void

    public init(
        draft: Binding<String>,
        sendState: ComposerSendState,
        onSend: @escaping () -> Void
    ) {
        self._draft = draft
        self.sendState = sendState
        self.onSend = onSend
    }

    nonisolated static func showsSend(
        draft: String,
        sendState: ComposerSendState
    ) -> Bool {
        if sendState == .sending { return true }
        if sendState == .offline { return false }
        return ChatRules.isSendable(draft)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.twoXs) {
            Text("Message")
                .textStyle(.label)
                .foregroundStyle(Palette.muted)
            HStack(alignment: .bottom, spacing: Spacing.xs) {
                TextField("", text: $draft, axis: .vertical)
                    .textInputStyle(.body)
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1...6)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.compact)
                    .background(Palette.surface)
                    .clipShape(RoundedRectangle(
                        cornerRadius: Radius.control,
                        style: .continuous
                    ))
                    .overlay {
                        RoundedRectangle(
                            cornerRadius: Radius.control,
                            style: .continuous
                        )
                        .strokeBorder(Palette.border, lineWidth: 1)
                    }
                    .frame(maxHeight: Metrics.composerMaxHeight)
                    .accessibilityLabel("Message")
                if Self.showsSend(draft: draft, sendState: sendState) {
                    IconButton(
                        .send,
                        style: .solid,
                        accessibilityLabel: "Send message",
                        isBusy: sendState == .sending
                    ) {
                        guard ChatRules.isSendable(draft) else { return }
                        onSend()
                    }
                }
            }
            if let guidance = ChatRules.counterGuidance(draft) {
                Text(guidance)
                    .textStyle(.caption)
                    .foregroundStyle(
                        draft.count > ChatRules.maxMessageLength
                            ? Palette.error
                            : Palette.muted
                    )
                    .fixedSize(horizontal: false, vertical: true)
            }
            if sendState == .offline {
                Text(
                    "You're offline. Your draft is saved and will be ready to send when you reconnect."
                )
                .textStyle(.caption)
                .foregroundStyle(Palette.notice)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, Spacing.page)
        .padding(.vertical, Spacing.xs)
        .background(Palette.bg)
    }
}
