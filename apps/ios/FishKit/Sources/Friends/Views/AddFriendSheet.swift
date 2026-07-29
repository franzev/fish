import DesignSystem
import FriendsData
import SwiftUI
import UIComponents

/// One username in, at most one person out. Never a list of people, and never
/// a reason why someone is out of reach: every cause reads the same sentence.
public struct AddFriendSheet: View {
    private let model: AddFriendModel
    private let onClose: () -> Void

    /// Held above the state switch so "Search again" comes back to the
    /// username they typed, ready to correct rather than retype.
    @State private var username = ""

    public init(model: AddFriendModel, onClose: @escaping () -> Void) {
        self.model = model
        self.onClose = onClose
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                TopBar(
                    title: "Add a friend",
                    trailing: TopBarAction(
                        icon: .close,
                        accessibilityLabel: "Close",
                        action: onClose
                    )
                )
                pageContent
                    .padding(.horizontal, Spacing.page)
            }
            .padding(.bottom, Spacing.lg)
        }
        .background(Palette.surface)
    }

    @ViewBuilder private var pageContent: some View {
        switch model.state {
        case .input(let fieldNotice, let notice, let isSearching):
            usernameSearch(
                fieldNotice: fieldNotice,
                notice: notice,
                isSearching: isSearching
            )
        case .candidate(let candidate, _, let isSending, let isSent, let notice):
            candidateCard(
                candidate,
                isSending: isSending,
                isSent: isSent,
                notice: notice
            )
        }
    }

    // MARK: - Pages

    @ViewBuilder private func usernameSearch(
        fieldNotice: String?,
        notice: String?,
        isSearching: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            if let notice {
                Notice(title: notice, tone: .notice)
            }
            InputField(
                label: "Username",
                text: $username,
                support: fieldNotice.map(InputField.Support.notice)
                    ?? .hint("Usernames look like @sam_lee. Ask your friend for theirs."),
                submitLabel: .search,
                onSubmit: { model.search(username) },
                autoFocus: true
            )
            ActionButton(
                "Search",
                variant: .primary,
                isLoading: isSearching,
                fullWidth: true
            ) {
                model.search(username)
            }
        }
    }

    @ViewBuilder private func candidateCard(
        _ candidate: FriendCandidate,
        isSending: Bool,
        isSent: Bool,
        notice: String?
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            if let notice {
                Notice(title: notice, tone: .notice)
            }
            // Every reason someone cannot be added reads the same. Nothing
            // here tells a sender whether they were blocked, declined, or
            // never existed.
            if let profile = candidate.profile, candidate.status != .unavailable {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    FriendIdentity(
                        displayName: profile.displayName,
                        username: profile.username
                    )
                    if let copy = outcomeCopy(candidate, isSent: isSent) {
                        Text(copy)
                            .textStyle(.body)
                            .foregroundStyle(Palette.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    cardAction(candidate, isSending: isSending, isSent: isSent)
                }
                .padding(Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    Palette.surface2,
                    in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                )
            } else {
                Notice(
                    title: "That person isn’t available. Check the username and try again.",
                    tone: .notice
                )
            }
            ActionButton("Search again", variant: .ghost, fullWidth: true) {
                model.searchAgain()
            }
        }
    }

    // MARK: - Card pieces

    private func outcomeCopy(_ candidate: FriendCandidate, isSent: Bool) -> String? {
        if isSent || candidate.status == .outgoingPending {
            return "Request sent. They’ll see it when they’re ready."
        }
        switch candidate.status {
        case .friends: return "You’re already friends."
        case .incomingPending: return "They already sent you a request."
        default: return nil
        }
    }

    /// At most one primary action on the card, and never beside Search.
    @ViewBuilder private func cardAction(
        _ candidate: FriendCandidate,
        isSending: Bool,
        isSent: Bool
    ) -> some View {
        if isSent || candidate.status == .outgoingPending || candidate.status == .friends {
            EmptyView()
        } else if candidate.status == .incomingPending {
            ActionButton("Review request", variant: .primary, fullWidth: true) {
                model.reviewRequest()
            }
        } else {
            ActionButton(
                "Add friend",
                variant: .primary,
                isLoading: isSending,
                fullWidth: true
            ) {
                model.sendRequest()
            }
        }
    }
}
