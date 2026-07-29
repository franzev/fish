import Foundation

/// What `search_friend_candidate` says about one person, in the caller's
/// terms. `unavailable` is deliberately cause-less: no account, blocked,
/// a coach, a recent decline, and a malformed username all land here so a
/// client can never probe for the reason.
public enum FriendCandidateStatus: Sendable, Equatable {
    case none
    case friends
    case outgoingPending
    case incomingPending
    case unavailable
}

/// The public face of a person in the friends flow — never an email, never a
/// role, never anything the search itself did not return.
public struct FriendProfile: Sendable, Equatable {
    public let id: String
    public let displayName: String
    public let username: String

    public init(id: String, displayName: String, username: String) {
        self.id = id
        self.displayName = displayName
        self.username = username
    }
}

/// One searched-for person. `profile` is absent exactly when the status is
/// `unavailable`; `requestId` is present when a pending request already ties
/// the two accounts together.
public struct FriendCandidate: Sendable, Equatable {
    public let status: FriendCandidateStatus
    public let profile: FriendProfile?
    public let requestId: String?

    public init(
        status: FriendCandidateStatus,
        profile: FriendProfile? = nil,
        requestId: String? = nil
    ) {
        self.status = status
        self.profile = profile
        self.requestId = requestId
    }
}

/// One pending request waiting on the signed-in person. Timestamps stay
/// ISO-8601 strings on the model (the `ClientCall`/`PresenceSnapshot`
/// precedent); presentation parses them.
public struct IncomingFriendRequest: Sendable, Equatable {
    public let requestId: String
    public let sender: FriendProfile
    public let createdAt: String

    public init(requestId: String, sender: FriendProfile, createdAt: String) {
        self.requestId = requestId
        self.sender = sender
        self.createdAt = createdAt
    }
}

/// Why a friend event arrived. Every reason means the same thing to a
/// consumer — refetch — so an unrecognised server reason is still delivered
/// as `unknown` rather than dropped.
public enum FriendEventReason: Sendable, Equatable, CaseIterable {
    case requestCreated
    case requestAccepted
    case requestDeclined
    case requestCancelled
    case friendshipCreated
    case friendshipRemoved
    /// Raised by the client, never by the server: the channel just
    /// (re)subscribed, so anything that happened while it was down was never
    /// delivered.
    case streamResumed
    case unknown

    /// Whether this reason can mean a conversation exists that the
    /// conversation directory has never heard of — the one thing friends
    /// exists to prevent going unnoticed.
    ///
    /// The stream resuming counts: whatever happened while the channel was
    /// down was never delivered, and a session's first subscribe resumes too,
    /// so signing in asks once. Everything else is a request's own lifecycle,
    /// which changes what is waiting but never what can be talked in.
    public var refreshesDirectory: Bool {
        switch self {
        case .friendshipCreated, .requestAccepted, .streamResumed:
            true
        case .requestCreated, .requestDeclined, .requestCancelled,
             .friendshipRemoved, .unknown:
            false
        }
    }
}

/// A wake-up hint from the `friends:user:{id}` channel. The payload carries
/// ids and a reason only; canonical state always comes from a refetch.
public struct FriendEvent: Sendable, Equatable {
    public let reason: FriendEventReason
    public let requestId: String?
    public let friendshipId: String?

    public init(
        reason: FriendEventReason,
        requestId: String? = nil,
        friendshipId: String? = nil
    ) {
        self.reason = reason
        self.requestId = requestId
        self.friendshipId = friendshipId
    }
}

/// The state a request landed in. `requestId` is absent when a conflict the
/// server reported (`request_pending`, `already_friends`) is translated into
/// the outcome the person actually wanted.
public struct FriendRequestOutcome: Sendable, Equatable {
    public let requestId: String?
    public let status: String

    public init(requestId: String?, status: String) {
        self.requestId = requestId
        self.status = status
    }
}

/// The two answers to an incoming request the `friend-command` function
/// accepts.
public enum FriendRequestResponse: String, Sendable, Equatable {
    case accept
    case decline
}

/// The `friend_requests.status` values this client reasons about.
public enum FriendRequestStatus {
    public static let pending = "pending"
    public static let accepted = "accepted"
    public static let declined = "declined"
    public static let cancelled = "cancelled"
}
