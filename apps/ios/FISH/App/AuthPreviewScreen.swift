import SwiftUI

private enum AuthRoute {
    case login
    case createAccount
    case checkInbox
    case signedIn
}

struct AuthPreviewScreen: View {
    @State private var route: AuthRoute = .login
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var triedCreateAccount = false

    var body: some View {
        if route == .signedIn {
            AppShell(
                displayName: name.isEmpty ? "Alex Rivera" : name,
                coachName: "Maya Chen",
                onSignOut: {
                    resetPasswords()
                    route = .login
                }
            )
        } else {
            authBody
        }
    }

    private var authBody: some View {
        ScrollView {
            VStack {
                Spacer(minLength: Spacing.xxl)
                Card {
                    content
                }
                .frame(maxWidth: Sizes.content)
                Spacer(minLength: Spacing.xxl)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.xxl)
        }
        .background(Palette.bg)
    }

    @ViewBuilder
    private var content: some View {
        switch route {
        case .login:
            AuthForm(
                title: "Log in",
                fields: {
                    Input(label: "Email", value: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    Input(label: "Password", value: $password, secure: true)
                },
                primary: "Log in",
                onPrimary: { route = .signedIn },
                secondary: "Continue with Google",
                onSecondary: { route = .signedIn },
                footer: {
                    AuthTextLink(prefix: "New here? ", text: "Create account") {
                        route = .createAccount
                    }
                }
            )

        case .createAccount:
            AuthForm(
                title: "Create your account",
                fields: {
                    Input(label: "Name", value: $name)
                    Input(label: "Email", value: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    Input(
                        label: "Password",
                        value: $password,
                        hint: "At least 8 characters.",
                        secure: true
                    )
                    Input(
                        label: "Confirm password",
                        value: $confirmPassword,
                        error: confirmPasswordError,
                        secure: true
                    )
                },
                primary: "Create account",
                onPrimary: createAccount,
                secondary: "Sign up with Google",
                onSecondary: { route = .signedIn },
                footer: {
                    AuthTextLink(prefix: "Already have an account? ", text: "Log in") {
                        resetPasswords()
                        route = .login
                    }
                }
            )

        case .checkInbox:
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Header(
                    title: "Check your inbox",
                    message: "We sent a link to \(email.isEmpty ? "you@work.com" : email). Open it on this device to continue."
                )
                Button(fullWidth: true, action: {}) {
                    Text("Resend the email")
                }
                AuthTextLink(text: "Back to log in") {
                    resetPasswords()
                    route = .login
                }
            }

        case .signedIn:
            EmptyView()
        }
    }

    private var confirmPasswordError: String? {
        guard triedCreateAccount || !confirmPassword.isEmpty else { return nil }
        return password == confirmPassword ? nil : "Passwords don't match yet."
    }

    private func createAccount() {
        triedCreateAccount = true
        guard password == confirmPassword else { return }
        route = .checkInbox
    }

    private func resetPasswords() {
        password = ""
        confirmPassword = ""
        triedCreateAccount = false
    }
}

private struct AuthForm<Fields: View, Footer: View>: View {
    let title: String
    let fields: Fields
    let primary: String
    let onPrimary: () -> Void
    let secondary: String
    let onSecondary: () -> Void
    let footer: Footer

    init(
        title: String,
        @ViewBuilder fields: () -> Fields,
        primary: String,
        onPrimary: @escaping () -> Void,
        secondary: String,
        onSecondary: @escaping () -> Void,
        @ViewBuilder footer: () -> Footer
    ) {
        self.title = title
        self.fields = fields()
        self.primary = primary
        self.onPrimary = onPrimary
        self.secondary = secondary
        self.onSecondary = onSecondary
        self.footer = footer()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            Header(title: title, message: nil)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                fields
            }
            Button(fullWidth: true, action: onPrimary) {
                Text(primary)
            }
            Button(variant: .secondary, fullWidth: true, action: onSecondary) {
                Text(secondary)
            }
            footer
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}

private struct Header: View {
    let title: String
    let message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(Typography.display)
                .foregroundStyle(Palette.foreground)
            if let message {
                Text(message)
                    .font(Typography.body)
                    .foregroundStyle(Palette.body)
            }
        }
    }
}

private struct AuthTextLink: View {
    var prefix = ""
    let text: String
    let action: () -> Void

    var body: some View {
        SwiftUI.Button(action: action) {
            HStack(spacing: 0) {
                if !prefix.isEmpty {
                    Text(prefix)
                        .foregroundStyle(Palette.muted)
                }
                Text(text)
                    .fontWeight(.medium)
                    .foregroundStyle(Palette.foreground)
            }
            .font(Typography.caption)
            .frame(minHeight: Sizes.control)
        }
    }
}

#Preview("Auth preview") {
    Theme {
        AuthPreviewScreen()
    }
}
