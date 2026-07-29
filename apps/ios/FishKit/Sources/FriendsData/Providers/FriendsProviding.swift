import Foundation

/// Reads over the `security definer` friends RPCs. Every call throws
/// `FriendCommandFailure` on rejection.
public protocol FriendDirectoryProviding: Sendable {
    /// `search_friend_candidate(p_username)` — one person, or a cause-less
    /// `unavailable` candidate.
    func searchCandidate(username: String) async throws -> FriendCandidate

    /// `list_incoming_friend_requests(p_limit)` — the newest pending
    /// requests waiting on the signed-in person.
    func listIncomingRequests() async throws -> [IncomingFriendRequest]

    /// `count_incoming_friend_requests()` — how many are waiting.
    func countIncomingRequests() async throws -> Int
}

/// Writes through the `friend-command` Edge Function. Failures carry the
/// server's code so callers can turn a conflict into the outcome the person
/// actually wanted.
public protocol FriendCommandsProviding: Sendable {
    func sendRequest(
        targetId: String,
        clientRequestId: String
    ) async throws -> FriendRequestOutcome

    func respondRequest(
        requestId: String,
        response: FriendRequestResponse
    ) async throws -> FriendRequestOutcome
}

/// Live wake-up hints for the signed-in person. The stream stays open for as
/// long as it is consumed — a failed or dropped subscription retries rather
/// than ending, because this channel is the only thing that tells a sender
/// their new conversation exists.
public protocol FriendEventsProviding: Sendable {
    func events(userId: String) -> AsyncStream<FriendEvent>
}

/// The realtime contract of migration 0021's broadcast triggers.
public enum FriendsRealtimeWire {
    public static let changedEvent = "friends.changed"

    public static func topic(userId: String) -> String {
        "friends:user:\(userId)"
    }
}
