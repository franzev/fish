import SwiftUI

struct ChatPreviewScreen: View {
    @State private var draft = ""
    @State private var messages = ChatPreviewData.messages

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                LazyVStack(spacing: Spacing.sm) {
                    ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                        MessageRow(
                            message: message,
                            grouped: isGrouped(message: message, at: index)
                        )
                    }

                    HStack(alignment: .bottom, spacing: Spacing.sm) {
                        AvatarView(name: ChatPreviewData.coach.name, size: .small)
                        TypingIndicatorView()
                        Spacer(minLength: Spacing.xl)
                    }
                    .padding(.top, Spacing.xs)
                }
                .padding(Spacing.md)
            }
            .background(Palette.bg)

            ChatInputBar(draft: $draft, onSend: appendMessage)
        }
        .background(Palette.bg)
    }

    private var header: some View {
        HStack(spacing: Spacing.md) {
            AvatarView(name: ChatPreviewData.coach.name)

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(ChatPreviewData.coach.name)
                    .font(Typography.heading)
                    .foregroundStyle(Palette.foreground)
                Text("Assigned coach conversation")
                    .font(Typography.caption)
                    .foregroundStyle(Palette.muted)
            }

            Spacer()
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .frame(minHeight: Sizes.control + Spacing.md)
        .background(Palette.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Palette.border)
                .frame(height: Stroke.hairline)
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
    Theme {
        ChatPreviewScreen()
    }
    .preferredColorScheme(.light)
}

#Preview("Chat - dark") {
    Theme {
        ChatPreviewScreen()
    }
    .preferredColorScheme(.dark)
}

#Preview("Chat - larger text") {
    Theme {
        ChatPreviewScreen()
    }
    .environment(\.dynamicTypeSize, .accessibility2)
}
