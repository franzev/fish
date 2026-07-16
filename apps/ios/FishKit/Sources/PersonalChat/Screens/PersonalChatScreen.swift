import ChatData
import DesignSystem
import SwiftUI
import UIComponents

public struct TranscriptContext: Sendable {
    public let now: Date
    public let calendar: Calendar
    public let locale: Locale

    public init(
        now: Date = Date(),
        calendar: Calendar = .current,
        locale: Locale = .current
    ) {
        self.now = now
        self.calendar = calendar
        self.locale = locale
    }
}

/// Stateless one-to-one conversation: presentation model in, user intents out.
/// The only local state is the media picker sheet's visibility — staged media
/// travels through the `selection` binding the host owns, like the draft.
public struct PersonalChatScreen: View {
    private let model: PersonalChatUiModel
    @Binding private var draft: String
    @Binding private var selection: ComposerSelection
    private let gifProvider: any GifProviding
    private let context: TranscriptContext
    private let onSend: () -> Void
    private let onRetryMessage: (String) -> Void
    private let onRetryOlder: () -> Void
    private let onBack: (() -> Void)?

    @State private var isMediaPickerPresented = false

    public init(
        model: PersonalChatUiModel,
        draft: Binding<String>,
        selection: Binding<ComposerSelection>,
        gifProvider: any GifProviding,
        context: TranscriptContext = TranscriptContext(),
        onSend: @escaping () -> Void,
        onRetryMessage: @escaping (String) -> Void,
        onRetryOlder: @escaping () -> Void,
        onBack: (() -> Void)? = nil
    ) {
        self.model = model
        self._draft = draft
        self._selection = selection
        self.gifProvider = gifProvider
        self.context = context
        self.onSend = onSend
        self.onRetryMessage = onRetryMessage
        self.onRetryOlder = onRetryOlder
        self.onBack = onBack
    }

    nonisolated static func composerState(
        for model: PersonalChatUiModel
    ) -> ComposerSendState {
        if model.connection == .offline { return .offline }
        let isSending = model.messages.contains {
            $0.direction == .outgoing && $0.delivery == .sending
        }
        return isSending ? .sending : .ready
    }

    public var body: some View {
        VStack(spacing: 0) {
            PersonalChatTopBar(
                participantName: model.participantName,
                presence: model.presence,
                onBack: onBack
            )
            switch model.phase {
            case .unavailable:
                Spacer()
                EmptyState(
                    title: "This conversation isn't available",
                    message: "If you think this is a mistake, tell your coach.",
                    actionLabel: onBack != nil ? "Go back" : nil,
                    onAction: onBack
                )
                Spacer()
            case .loading:
                TranscriptSkeleton()
            case .ready:
                if model.messages.isEmpty {
                    Spacer()
                    EmptyState(
                        title: "No messages yet",
                        message: "This is the start of your conversation with \(model.participantName)."
                    )
                    Spacer()
                } else {
                    PersonalChatTranscript(
                        items: TranscriptBuilder.build(
                            messages: model.messages,
                            unreadAfterMessageId: model.unreadAfterMessageId,
                            calendar: context.calendar,
                            now: context.now,
                            locale: context.locale
                        ),
                        olderMessages: model.olderMessages,
                        onRetryMessage: onRetryMessage,
                        onRetryOlder: onRetryOlder
                    )
                }
            }
            if model.phase != .unavailable {
                if ChatConnectionNotice.content(for: model.connection) != nil {
                    ChatConnectionNotice(state: model.connection)
                        .padding(.bottom, Spacing.xs)
                }
                if model.isParticipantTyping {
                    TypingIndicator(name: model.participantName)
                }
                MessageComposer(
                    draft: $draft,
                    selection: $selection,
                    sendState: Self.composerState(for: model),
                    onSend: onSend,
                    onOpenMediaPicker: { isMediaPickerPresented = true }
                )
            }
        }
        .background(Palette.bg)
        .sheet(isPresented: $isMediaPickerPresented) {
            MediaPickerSheet(
                gifProvider: gifProvider,
                gifDisabled: model.connection == .offline,
                stickerDisabled: model.connection == .offline,
                onSelectEmoji: { draft += $0 },
                onSelectGif: { selection = .gif($0, searchQuery: $1) },
                onSelectSticker: { selection = .sticker($0) }
            )
        }
    }
}

private struct TranscriptSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(alignment: .top, spacing: Spacing.xs) {
                    SkeletonAvatar(size: .sm)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        SkeletonBar(width: Metrics.skeletonAuthorWidth)
                        SkeletonBar()
                        SkeletonBar()
                    }
                }
            }
        }
        .padding(Spacing.page)
        .frame(
            maxWidth: .infinity,
            maxHeight: .infinity,
            alignment: .top
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading conversation")
    }
}
