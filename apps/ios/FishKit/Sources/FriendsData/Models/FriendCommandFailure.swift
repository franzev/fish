import Foundation

/// Calm failure surface of the friends endpoints — `code` is the stable
/// machine code callers branch on, `notice` the user-facing sentence the
/// server (or the transport fallback) chose. Server copy passes through
/// verbatim; this client never rewrites it.
public struct FriendCommandFailure: Error, Equatable, Sendable {
    public let code: String
    public let notice: String
    public let statusCode: Int?

    public init(code: String, notice: String, statusCode: Int? = nil) {
        self.code = code
        self.notice = notice
        self.statusCode = statusCode
    }

    /// Transport-level fallback — the same copy the server sends when friends
    /// is switched off, so an unreachable function and a disabled feature
    /// read identically.
    public static let unavailable = Self(
        code: FriendCommandCode.friendsUnavailable,
        notice: "Friends is taking a break. Chat still works."
    )

    public static let notAuthenticated = Self(
        code: FriendCommandCode.notAuthenticated,
        notice: "Sign in to manage friends.",
        statusCode: 401
    )

    /// Server copy passes through verbatim; anything else reads as the one
    /// calm fallback line.
    public static func calmNotice(for error: Error) -> String {
        (error as? Self)?.notice ?? Self.unavailable.notice
    }
}

/// The `friend-command` codes a client branches on. Every other code is just
/// a calm message to show.
public enum FriendCommandCode {
    /// The request is already on its way — the answer the person wanted.
    public static let requestPending = "request_pending"
    /// Already friends — also the answer the person wanted.
    public static let alreadyFriends = "already_friends"
    /// They asked first: a re-search, not a failure.
    public static let incomingRequestExists = "incoming_request_exists"
    public static let requestAlreadyResolved = "request_already_resolved"
    public static let requestNotFound = "request_not_found"
    public static let rateLimited = "rate_limited"
    public static let notAuthenticated = "not_authenticated"
    public static let friendsUnavailable = "friends_unavailable"
}
