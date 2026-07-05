import SwiftUI

struct Input: View {
    let label: String
    @Binding var value: String
    var placeholder = ""
    var hint: String?
    var notice: String?
    var error: String?
    var secure = false

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(label)
                .font(Typography.label)
                .foregroundStyle(Palette.foreground)

            Group {
                if secure {
                    SecureField(placeholder, text: $value)
                } else {
                    TextField(placeholder, text: $value)
                }
            }
                .font(Typography.body)
                .foregroundStyle(Palette.foreground)
                .textInputAutocapitalization(.sentences)
                .focused($isFocused)
                .frame(minHeight: Sizes.control)
                .padding(.horizontal, Spacing.md)
                .background(Palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                        .stroke(borderColor, lineWidth: error == nil ? Stroke.hairline : Stroke.focus)
                )

            HStack(spacing: Spacing.sm) {
                if let message {
                    if notice != nil || error != nil {
                        Circle()
                            .stroke(messageColor, lineWidth: Stroke.icon)
                            .frame(width: Sizes.icon, height: Sizes.icon)
                            .overlay(
                                Text(error == nil ? "i" : "!")
                                    .font(Typography.caption)
                                    .foregroundStyle(messageColor)
                            )
                    }

                    Text(message)
                        .font(Typography.caption)
                        .foregroundStyle(messageColor)
                }
            }
            .frame(minHeight: Sizes.helper, alignment: .leading)
        }
    }

    private var message: String? {
        error ?? notice ?? hint
    }

    private var messageColor: Color {
        if error != nil { return Palette.error }
        if notice != nil { return Palette.notice }
        return Palette.muted
    }

    private var borderColor: Color {
        if error != nil { return Palette.error }
        if notice != nil { return Palette.borderStrong }
        if isFocused { return Palette.primary }
        return Palette.border
    }
}

#Preview("Text fields") {
    @Previewable @State var email = "you@work.com"
    @Previewable @State var password = ""
    @Previewable @State var newPassword = "samepassword"

    Theme {
        VStack(spacing: Spacing.md) {
            Input(
                label: "Email",
                value: $email,
                hint: "Use the email your coach invited."
            )
            Input(
                label: "Password",
                value: $password,
                placeholder: "Password",
                notice: "That email and password do not match. Try again?"
            )
            Input(
                label: "New password",
                value: $newPassword,
                error: "That is the same password as before. Pick a new one."
            )
        }
        .padding(Spacing.lg)
    }
}
