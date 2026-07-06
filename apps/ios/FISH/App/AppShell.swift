import SwiftUI

private enum AppDestination: Hashable {
    case home
    case messages
    case profile
}

struct AppShell: View {
    var displayName = "Alex Rivera"
    var coachName = "Maya Chen"
    var onSignOut: () -> Void = {}

    @State private var selected: AppDestination = .home

    var body: some View {
        TabView(selection: $selected) {
            HomeTab(displayName: displayName, coachName: coachName)
                .tabItem { Label("Home", systemImage: "house") }
                .tag(AppDestination.home)

            MessagesTab(coachName: coachName)
                .tabItem { Label("Messages", systemImage: "message") }
                .tag(AppDestination.messages)

            ProfileTab(
                displayName: displayName,
                coachName: coachName,
                onSignOut: onSignOut
            )
            .tabItem { Label("Profile", systemImage: "person") }
            .tag(AppDestination.profile)
        }
        .background(Palette.bg)
    }
}

private struct HomeTab: View {
    let displayName: String
    let coachName: String

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    Text("Welcome back, \(displayName.firstName)")
                        .font(Typography.display)
                        .foregroundStyle(Palette.foreground)

                    Card {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text("Nothing to practice yet today.")
                                .font(Typography.bodyMedium)
                                .foregroundStyle(Palette.foreground)
                            Text("\(coachName) will add your next step when you're ready.")
                                .font(Typography.body)
                                .foregroundStyle(Palette.body)
                        }
                    }
                }
                .frame(maxWidth: Sizes.content, alignment: .leading)
                .padding(Spacing.lg)
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .background(Palette.bg)
        }
    }
}

private struct MessagesTab: View {
    let coachName: String

    var body: some View {
        NavigationStack {
            List {
                NavigationLink {
                    ChatPreviewScreen()
                } label: {
                    HStack(spacing: Spacing.md) {
                        AvatarView(name: coachName)
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            Text(coachName)
                                .font(Typography.bodyMedium)
                                .foregroundStyle(Palette.foreground)
                            Text("Your coach will say hello soon. Nothing to do yet.")
                                .font(Typography.caption)
                                .foregroundStyle(Palette.muted)
                                .lineLimit(2)
                        }
                    }
                    .frame(minHeight: Sizes.control)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Palette.bg)
            .navigationTitle("Messages")
        }
    }
}

private struct ProfileTab: View {
    let displayName: String
    let coachName: String
    let onSignOut: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.lg) {
                    VStack(spacing: Spacing.sm) {
                        AvatarView(name: displayName, size: .large)
                        Text(displayName)
                            .font(Typography.display)
                            .foregroundStyle(Palette.foreground)
                        Text("Learning English")
                            .font(Typography.caption)
                            .foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity)

                    Card {
                        HStack(spacing: Spacing.md) {
                            AvatarView(name: coachName)
                            VStack(alignment: .leading, spacing: Spacing.xs) {
                                Text(coachName)
                                    .font(Typography.bodyMedium)
                                    .foregroundStyle(Palette.foreground)
                                Text("Your English coach")
                                    .font(Typography.caption)
                                    .foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(Typography.caption)
                                .foregroundStyle(Palette.muted)
                        }
                    }

                    Card {
                        VStack(spacing: 0) {
                            SettingsRow(label: "Appearance", value: "System")
                            Divider().background(Palette.border)
                            SettingsRow(label: "Notifications", value: "Quiet")
                            Divider().background(Palette.border)
                            SettingsRow(label: "Language", value: "English")
                            Divider().background(Palette.border)
                            Button(variant: .ghost, fullWidth: true, action: onSignOut) {
                                Text("Log out")
                            }
                        }
                    }
                }
                .frame(maxWidth: Sizes.content)
                .padding(Spacing.lg)
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .background(Palette.bg)
        }
    }
}

private struct SettingsRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: Spacing.md) {
            Text(label)
                .font(Typography.body)
                .foregroundStyle(Palette.foreground)
            Spacer()
            Text(value)
                .font(Typography.caption)
                .foregroundStyle(Palette.muted)
        }
        .frame(minHeight: Sizes.control)
    }
}

private extension String {
    var firstName: String {
        split(separator: " ").first.map(String.init) ?? self
    }
}

#Preview("App shell") {
    Theme {
        AppShell()
    }
}
