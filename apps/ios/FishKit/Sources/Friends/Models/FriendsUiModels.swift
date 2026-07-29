import FriendsData

/// Add a friend is a two-step screen, never a results list: a username goes in
/// and at most one person comes back.
public enum AddFriendState: Sendable, Equatable {
    /// `fieldNotice` belongs beside the field (nothing was typed); `notice`
    /// belongs to the whole screen (the lookup never reached the server).
    case input(
        fieldNotice: String? = nil,
        notice: String? = nil,
        isSearching: Bool = false
    )

    /// `clientRequestId` is minted once per found person, so a retried tap
    /// replays the first request instead of sending a second one.
    case candidate(
        FriendCandidate,
        clientRequestId: String,
        isSending: Bool = false,
        isSent: Bool = false,
        notice: String? = nil
    )
}

public enum FriendRequestsState: Sendable, Equatable {
    case loading

    /// `respondingWith` keeps each request single-flight and remembers which
    /// answer is on its way, so the spinner sits on the button they tapped.
    case loaded(
        requests: [IncomingFriendRequest],
        respondingWith: [String: FriendRequestResponse] = [:],
        notice: String? = nil
    )

    case failed(notice: String)
}
