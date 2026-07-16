import DesignSystem
import PersonalChat
import SwiftUI
import TestSupport
import UIComponents

private struct CatalogPage<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                content
            }
            .padding(Spacing.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Palette.bg)
        .navigationTitle(title)
    }
}

struct ButtonsPage: View {
    var body: some View {
        CatalogPage(title: "Buttons") {
            ActionButton(
                "Send message",
                variant: .primary,
                fullWidth: true
            ) {}
            ActionButton(
                "Sending message",
                variant: .primary,
                isLoading: true,
                fullWidth: true
            ) {}
            ActionButton("Save changes", variant: .secondary) {}
            ActionButton("Cancel", variant: .ghost) {}
            ActionButton("Save changes", variant: .secondary) {}
                .disabled(true)
        }
    }
}

struct IconButtonsPage: View {
    var body: some View {
        CatalogPage(title: "Icon buttons") {
            HStack(spacing: Spacing.md) {
                IconButton(
                    .send,
                    style: .solid,
                    accessibilityLabel: "Send message"
                ) {}
                IconButton(
                    .send,
                    style: .solid,
                    accessibilityLabel: "Sending message",
                    isBusy: true
                ) {}
                IconButton(
                    .back,
                    style: .quiet,
                    accessibilityLabel: "Back"
                ) {}
                IconButton(
                    .close,
                    style: .quiet,
                    accessibilityLabel: "Close"
                ) {}
                .disabled(true)
            }
        }
    }
}

struct TextFieldsPage: View {
    @State private var empty = ""
    @State private var filled = "maya@example.com"
    @State private var invalid = "maya@"

    var body: some View {
        CatalogPage(title: "Text fields") {
            InputField(label: "Full name", text: $empty)
            InputField(
                label: "Email",
                text: $filled,
                support: .hint("We only use this to sign you in")
            )
            InputField(
                label: "Email",
                text: $invalid,
                support: .error(
                    "That email doesn't look complete. Check the part after the @."
                )
            )
            InputField(
                label: "Coach",
                text: .constant("Sam Rivera")
            )
            .disabled(true)
        }
    }
}

struct AvatarsPage: View {
    var body: some View {
        CatalogPage(title: "Avatars") {
            HStack(spacing: Spacing.md) {
                Avatar(name: "Maya Chen", size: .sm)
                Avatar(name: "Maya Chen", size: .md)
                Avatar(name: "", size: .md)
                Avatar(name: "Sam Rivera", size: .profile)
            }
        }
    }
}

struct NoticesPage: View {
    var body: some View {
        CatalogPage(title: "Notices") {
            Notice(
                tone: .notice,
                title: "Reconnecting",
                message: "Your draft is safe while we reconnect."
            )
            Notice(
                tone: .error,
                title: "That didn't send",
                message: "Check your connection, then try again.",
                actionLabel: "Try sending again",
                onAction: {}
            )
            Notice(
                tone: .warning,
                title: "Almost at the message limit",
                message: "Messages can hold 4,000 characters."
            )
            Notice(tone: .success, title: "Message sent")
        }
    }
}

struct LoadingPage: View {
    var body: some View {
        CatalogPage(title: "Loading") {
            HStack(spacing: Spacing.xs) {
                SkeletonAvatar(size: .sm)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SkeletonBar(width: Metrics.skeletonAuthorWidth)
                    SkeletonBar()
                }
            }
            OlderMessagesSlot(state: .loading, onRetry: {})
            OlderMessagesSlot(state: .failed, onRetry: {})
        }
    }
}

struct EmptyStatesPage: View {
    var body: some View {
        CatalogPage(title: "Empty states") {
            EmptyState(
                title: "No messages yet",
                message: "This is the start of your conversation with Sam."
            )
            EmptyState(
                title: "This conversation isn't available",
                message: "If you think this is a mistake, tell your coach.",
                actionLabel: "Go back",
                onAction: {}
            )
        }
    }
}

struct TopBarsPage: View {
    var body: some View {
        CatalogPage(title: "Top bars") {
            TopBar(title: "Profile")
            TopBar(title: "Conversation", onBack: {})
            PersonalChatTopBar(
                participantName: PersonalChatFixtures.coachName,
                presence: PresenceUiModel(label: "Online", tone: .online),
                onBack: {}
            )
        }
    }
}

struct ChatStatesPage: View {
    private let fixtures: [(String, PersonalChatUiModel)] = [
        ("Loading", PersonalChatFixtures.loading),
        ("Empty", PersonalChatFixtures.empty),
        ("Loaded", PersonalChatFixtures.loaded),
        ("Unread", PersonalChatFixtures.unread),
        ("Loading earlier", PersonalChatFixtures.loadingEarlier),
        ("Earlier failed", PersonalChatFixtures.earlierFailed),
        ("Sending", PersonalChatFixtures.sending),
        ("Send failed", PersonalChatFixtures.sendFailed),
        ("Reconnecting", PersonalChatFixtures.reconnecting),
        ("Offline", PersonalChatFixtures.offline),
        ("Typing", PersonalChatFixtures.typing),
        ("Long content", PersonalChatFixtures.longContent),
        ("Unavailable", PersonalChatFixtures.unavailable),
    ]

    var body: some View {
        List(fixtures, id: \.0) { name, model in
            NavigationLink(name) { ChatStateHost(model: model) }
        }
        .navigationTitle("Chat states")
    }
}

struct ChatStateHost: View {
    let model: PersonalChatUiModel
    @State private var draft = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        PersonalChatScreen(
            model: model,
            draft: $draft,
            context: PersonalChatFixtures.context,
            onSend: { draft = "" },
            onRetryMessage: { _ in },
            onRetryOlder: {},
            onBack: { dismiss() }
        )
        .toolbar(.hidden, for: .navigationBar)
    }
}
