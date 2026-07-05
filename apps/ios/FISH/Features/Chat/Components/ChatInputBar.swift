import SwiftUI

struct ChatInputBar: View {
    @Binding var draft: String
    let onSend: (String) -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.sm) {
            iconButton(systemName: "face.smiling", label: "Add emoji")
            iconButton(systemName: "paperclip", label: "Attach file")

            TextField("Message", text: $draft, axis: .vertical)
                .font(Typography.body)
                .foregroundStyle(Palette.foreground)
                .lineLimit(1...4)
                .focused($isFocused)
                .frame(minHeight: Sizes.control)
                .padding(.horizontal, Spacing.md)
                .background(Palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                        .stroke(isFocused ? Palette.primary : Palette.border, lineWidth: Stroke.hairline)
                )
                .accessibilityLabel("Message")

            Button(
                fullWidth: false,
                action: send
            ) {
                Image(systemName: "paperplane.fill")
                    .font(Typography.label)
                    .frame(width: Sizes.icon, height: Sizes.icon)
            }
            .disabled(!canSend)
            .accessibilityLabel("Send message")
        }
        .padding(Spacing.md)
        .background(Palette.surface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Palette.border)
                .frame(height: Stroke.hairline)
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func send() {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        onSend(trimmed)
        draft = ""
    }

    private func iconButton(systemName: String, label: String) -> some View {
        SwiftUI.Button(action: {}) {
            Image(systemName: systemName)
                .font(Typography.label)
                .foregroundStyle(Palette.muted)
                .frame(width: Sizes.control, height: Sizes.control)
                .background(Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

#Preview("Input bar") {
    @Previewable @State var draft = "Could I say it this way?"

    Theme {
        ChatInputBar(draft: $draft, onSend: { _ in })
    }
}
