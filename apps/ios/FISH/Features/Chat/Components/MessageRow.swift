import SwiftUI

struct MessageRow: View {
    let message: ChatMessageView
    var grouped = false

    var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.sm) {
            if message.mine {
                Spacer(minLength: Spacing.xl)
            } else {
                avatarSlot
            }

            VStack(alignment: message.mine ? .trailing : .leading, spacing: Spacing.xs) {
                if !grouped {
                    metaRow
                }

                MessageBubble(text: message.body, mine: message.mine)

                if message.mine, let status = message.status {
                    Text(status.rawValue)
                        .font(Typography.caption)
                        .foregroundStyle(Palette.muted)
                }
            }
            .frame(maxWidth: 320, alignment: message.mine ? .trailing : .leading)

            if message.mine {
                avatarSlot
            } else {
                Spacer(minLength: Spacing.xl)
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
        HStack(spacing: Spacing.sm) {
            Text(message.mine ? message.author.role : message.author.name)
                .font(Typography.label)
                .foregroundStyle(Palette.foreground)
            Text(message.sentAt)
                .font(Typography.caption)
                .foregroundStyle(Palette.muted)
        }
    }
}

#Preview("Message rows") {
    Theme {
        VStack(spacing: Spacing.sm) {
            ForEach(ChatPreviewData.messages) { message in
                MessageRow(message: message)
            }
        }
        .padding(Spacing.md)
    }
}
