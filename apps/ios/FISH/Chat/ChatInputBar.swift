import SwiftUI

struct ChatInputBar: View {
    @Binding var draft: String
    let onSend: (String) -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: FISHSpacing.sm) {
            iconButton(systemName: "face.smiling", label: "Add emoji")
            iconButton(systemName: "paperclip", label: "Attach file")

            TextField("Message", text: $draft, axis: .vertical)
                .font(FISHType.body)
                .foregroundStyle(FISHColors.foreground)
                .lineLimit(1...4)
                .focused($isFocused)
                .frame(minHeight: FISHSizes.control)
                .padding(.horizontal, FISHSpacing.md)
                .background(FISHColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous)
                        .stroke(isFocused ? FISHColors.primary : FISHColors.border, lineWidth: FISHStroke.hairline)
                )
                .accessibilityLabel("Message")

            FISHButton(
                fullWidth: false,
                action: send
            ) {
                Image(systemName: "paperplane.fill")
                    .font(FISHType.label)
                    .frame(width: FISHSizes.icon, height: FISHSizes.icon)
            }
            .disabled(!canSend)
            .accessibilityLabel("Send message")
        }
        .padding(FISHSpacing.md)
        .background(FISHColors.surface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(FISHColors.border)
                .frame(height: FISHStroke.hairline)
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
        Button(action: {}) {
            Image(systemName: systemName)
                .font(FISHType.label)
                .foregroundStyle(FISHColors.muted)
                .frame(width: FISHSizes.control, height: FISHSizes.control)
                .background(Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

#Preview("Input bar") {
    @Previewable @State var draft = "Could I say it this way?"

    FISHTheme {
        ChatInputBar(draft: $draft, onSend: { _ in })
    }
}
