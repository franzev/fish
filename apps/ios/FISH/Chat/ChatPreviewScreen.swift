import SwiftUI

struct ChatPreviewScreen: View {
    @State private var draft = ""
    @State private var messages = ChatPreviewData.messages

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                LazyVStack(spacing: FISHSpacing.sm) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                        MessageRow(
                            message: message,
                            grouped: isGrouped(message: message, at: index)
                        )
                    }

                    HStack(alignment: .bottom, spacing: FISHSpacing.sm) {
                        AvatarView(name: ChatPreviewData.coach.name, size: .small)
                        TypingIndicatorView()
                        Spacer(minLength: FISHSpacing.xl)
                    }
                    .padding(.top, FISHSpacing.xs)
                }
                .padding(FISHSpacing.md)
            }
            .background(FISHColors.bg)

            ChatInputBar(draft: $draft, onSend: appendMessage)
        }
        .background(FISHColors.bg)
    }

    private var header: some View {
        HStack(spacing: FISHSpacing.md) {
            AvatarView(name: ChatPreviewData.coach.name)

            VStack(alignment: .leading, spacing: FISHSpacing.xs) {
                Text(ChatPreviewData.coach.name)
                    .font(FISHType.heading)
                    .foregroundStyle(FISHColors.foreground)
                Text("Assigned coach conversation")
                    .font(FISHType.caption)
                    .foregroundStyle(FISHColors.muted)
            }

            Spacer()
        }
        .padding(.horizontal, FISHSpacing.md)
        .padding(.vertical, FISHSpacing.sm)
        .frame(minHeight: FISHSizes.control + FISHSpacing.md)
        .background(FISHColors.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(FISHColors.border)
                .frame(height: FISHStroke.hairline)
        }
    }

    private func isGrouped(message: ChatMessageView, at index: Int) -> Bool {
        guard index > 0 else { return false }
        let previous = messages[index - 1]
        return previous.author.id == message.author.id && previous.mine == message.mine
    }

    private func appendMessage(_ body: String) {
        messages.append(
            ChatMessageView(
                id: UUID().uuidString,
                author: ChatPreviewData.client,
                body: body,
                sentAt: "Now",
                mine: true,
                status: .sent
            )
        )
    }
}

#Preview("Chat - light") {
    FISHTheme {
        ChatPreviewScreen()
    }
    .preferredColorScheme(.light)
}

#Preview("Chat - dark") {
    FISHTheme {
        ChatPreviewScreen()
    }
    .preferredColorScheme(.dark)
}

#Preview("Chat - larger text") {
    FISHTheme {
        ChatPreviewScreen()
    }
    .environment(\.dynamicTypeSize, .accessibility2)
}
