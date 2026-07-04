import SwiftUI

struct MessageRow: View {
    let message: ChatMessageView
    var grouped = false

    var body: some View {
        HStack(alignment: .bottom, spacing: FISHSpacing.sm) {
            if message.mine {
                Spacer(minLength: FISHSpacing.xl)
            } else {
                avatarSlot
            }

            VStack(alignment: message.mine ? .trailing : .leading, spacing: FISHSpacing.xs) {
                if !grouped {
                    metaRow
                }

                MessageBubble(text: message.body, mine: message.mine)

                if message.mine, let status = message.status {
                    Text(status.rawValue)
                        .font(FISHType.caption)
                        .foregroundStyle(FISHColors.muted)
                }
            }
            .frame(maxWidth: 320, alignment: message.mine ? .trailing : .leading)

            if message.mine {
                avatarSlot
            } else {
                Spacer(minLength: FISHSpacing.xl)
            }
        }
    }

    private var avatarSlot: some View {
        Group {
            if grouped {
                Color.clear
                    .frame(width: AvatarSize.small.value, height: AvatarSize.small.value)
            } else {
                AvatarView(name: message.author.name, size: .small)
            }
        }
    }

    private var metaRow: some View {
        HStack(spacing: FISHSpacing.sm) {
            Text(message.mine ? message.author.role : message.author.name)
                .font(FISHType.label)
                .foregroundStyle(FISHColors.foreground)
            Text(message.sentAt)
                .font(FISHType.caption)
                .foregroundStyle(FISHColors.muted)
        }
    }
}

#Preview("Message rows") {
    FISHTheme {
        VStack(spacing: FISHSpacing.sm) {
            ForEach(ChatPreviewData.messages) { message in
                MessageRow(message: message)
            }
        }
        .padding(FISHSpacing.md)
    }
}
