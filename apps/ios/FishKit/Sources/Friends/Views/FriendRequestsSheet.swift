import DesignSystem
import FriendsData
import SwiftUI
import UIComponents

/// The list and one request's review are the same sheet: back walks review →
/// list → out, so there is never more than one decision on the page.
public struct FriendRequestsSheet: View {
    enum Page: Hashable {
        case list
        case review
    }

    private let model: FriendRequestsModel
    private let onClose: () -> Void

    public init(model: FriendRequestsModel, onClose: @escaping () -> Void) {
        self.model = model
        self.onClose = onClose
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                TopBar(
                    title: "Friend requests",
                    onBack: backAction,
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

    /// The review is the only page with somewhere to go back to; leaving the
    /// list is the close control's job.
    private var page: Page {
        model.selectedRequest == nil ? .list : .review
    }

    private var backAction: (() -> Void)? {
        guard page != .list else { return nil }
        return { goBack() }
    }

    private func goBack() {
        switch page {
        case .list: break
        case .review: model.clearSelection()
        }
    }

    @ViewBuilder private var pageContent: some View {
        switch page {
        case .list: listPage
        case .review: reviewPage
        }
    }

    // MARK: - Pages

    @ViewBuilder private var listPage: some View {
        switch model.state {
        case .loading:
            loadingPlaceholder
        case .failed(let notice):
            VStack(alignment: .leading, spacing: Spacing.md) {
                Notice(title: notice, tone: .notice)
                ActionButton("Try again", variant: .secondary, fullWidth: true) {
                    model.load()
                }
            }
        case .loaded(let requests, _, let notice):
            VStack(alignment: .leading, spacing: Spacing.md) {
                if let notice {
                    Notice(title: notice, tone: .notice)
                }
                if requests.isEmpty {
                    Text("No requests right now. New ones will appear here.")
                        .textStyle(.body)
                        .foregroundStyle(Palette.body)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, Spacing.md)
                } else {
                    VStack(spacing: Spacing.xs) {
                        ForEach(requests, id: \.requestId) { request in
                            FriendRequestRow(request: request) {
                                model.select(request)
                            }
                        }
                    }
                }
            }
        }
    }

    /// One person fills this page, so it is the page — not a card floating on
    /// it. Keeping the actions on the sheet's own surface also leaves the
    /// waiting button's quiet fill visible instead of hiding it inside a fill
    /// of the same weight.
    @ViewBuilder private var reviewPage: some View {
        if let request = model.selectedRequest {
            let responding = respondingWith(request.requestId)
            VStack(alignment: .leading, spacing: Spacing.md) {
                if case .loaded(_, _, let notice) = model.state, let notice {
                    Notice(title: notice, tone: .notice)
                }
                FriendIdentity(
                    displayName: request.sender.displayName,
                    username: request.sender.username
                )
                Text("Wants to be friends. Accept when you’re ready — there’s no rush.")
                    .textStyle(.body)
                    .foregroundStyle(Palette.body)
                    .fixedSize(horizontal: false, vertical: true)
                // The spinner belongs on the button they tapped: watching
                // Accept spin after choosing Decline is the app telling them
                // the wrong thing about their own choice.
                ActionButton(
                    "Accept request",
                    variant: .primary,
                    isLoading: responding == .accept,
                    fullWidth: true
                ) {
                    model.respond(requestId: request.requestId, response: .accept)
                }
                .disabled(responding != nil)
                ActionButton(
                    "Decline",
                    variant: .ghost,
                    isLoading: responding == .decline,
                    fullWidth: true
                ) {
                    model.respond(requestId: request.requestId, response: .decline)
                }
                .disabled(responding != nil)
            }
            .padding(.top, Spacing.xs)
        }
    }

    /// Shaped like the rows that are coming, so nothing jumps when they
    /// arrive. The placeholders carry the row's quiet fill themselves — a row
    /// background of the same weight would swallow them.
    private var loadingPlaceholder: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Loading friend requests…")
                .textStyle(.caption)
                .foregroundStyle(Palette.body)
            VStack(spacing: Spacing.xs) {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: Spacing.sm) {
                        SkeletonAvatar(size: .md)
                        VStack(alignment: .leading, spacing: Spacing.twoXs) {
                            SkeletonBar()
                            SkeletonBar(width: Metrics.skeletonAuthorWidth)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .frame(minHeight: Metrics.targetTouch)
                }
            }
        }
    }

    private func respondingWith(_ requestId: String) -> FriendRequestResponse? {
        guard case .loaded(_, let respondingWith, _) = model.state else { return nil }
        return respondingWith[requestId]
    }
}
