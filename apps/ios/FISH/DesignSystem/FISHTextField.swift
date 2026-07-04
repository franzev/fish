import SwiftUI

struct FISHTextField: View {
    let label: String
    @Binding var value: String
    var placeholder = ""
    var hint: String?
    var notice: String?
    var error: String?

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: FISHSpacing.sm) {
            Text(label)
                .font(FISHType.label)
                .foregroundStyle(FISHColors.foreground)

            TextField(placeholder, text: $value)
                .font(FISHType.body)
                .foregroundStyle(FISHColors.foreground)
                .textInputAutocapitalization(.sentences)
                .focused($isFocused)
                .frame(minHeight: FISHSizes.control)
                .padding(.horizontal, FISHSpacing.md)
                .background(FISHColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: FISHRadius.control, style: .continuous)
                        .stroke(borderColor, lineWidth: error == nil ? FISHStroke.hairline : FISHStroke.focus)
                )

            HStack(spacing: FISHSpacing.sm) {
                if let message {
                    if notice != nil || error != nil {
                        Circle()
                            .stroke(messageColor, lineWidth: FISHStroke.icon)
                            .frame(width: FISHSizes.icon, height: FISHSizes.icon)
                            .overlay(
                                Text(error == nil ? "i" : "!")
                                    .font(FISHType.caption)
                                    .foregroundStyle(messageColor)
                            )
                    }

                    Text(message)
                        .font(FISHType.caption)
                        .foregroundStyle(messageColor)
                }
            }
            .frame(minHeight: FISHSizes.helper, alignment: .leading)
        }
    }

    private var message: String? {
        error ?? notice ?? hint
    }

    private var messageColor: Color {
        if error != nil { return FISHColors.error }
        if notice != nil { return FISHColors.notice }
        return FISHColors.muted
    }

    private var borderColor: Color {
        if error != nil { return FISHColors.error }
        if notice != nil { return FISHColors.borderStrong }
        if isFocused { return FISHColors.primary }
        return FISHColors.border
    }
}

#Preview("Text fields") {
    @Previewable @State var email = "you@work.com"
    @Previewable @State var password = ""
    @Previewable @State var newPassword = "samepassword"

    FISHTheme {
        VStack(spacing: FISHSpacing.md) {
            FISHTextField(
                label: "Email",
                value: $email,
                hint: "Use the email your coach invited."
            )
            FISHTextField(
                label: "Password",
                value: $password,
                placeholder: "Password",
                notice: "That email and password do not match. Try again?"
            )
            FISHTextField(
                label: "New password",
                value: $newPassword,
                error: "That is the same password as before. Pick a new one."
            )
        }
        .padding(FISHSpacing.lg)
    }
}
