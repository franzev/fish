import Foundation

// The friends wire format: RPC reads keep the database's snake_case, while
// the `friend-command` Edge Function and the broadcast payloads speak
// camelCase. Unknown values never fail a decode here — a friends surface
// that cannot read one field still has to stay calm and refetch.

struct FriendProfileWire: Decodable {
    let id: String?
    let displayName: String?
    let username: String?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case username
    }

    /// A partial profile is no profile: the candidate collapses to
    /// `unavailable` rather than rendering a half-named person.
    var domain: FriendProfile? {
        guard let id, let displayName, let username else { return nil }
        return FriendProfile(id: id, displayName: displayName, username: username)
    }
}

struct FriendCandidateWire: Decodable {
    let status: String?
    let requestId: String?
    let profile: FriendProfileWire?

    enum CodingKeys: String, CodingKey {
        case status
        case requestId = "request_id"
        case profile
    }

    /// Mirrors the web mapping (`friend-repository.ts:108-118`): an
    /// unrecognised status and a missing profile both land on `unavailable`,
    /// and the request id survives either way so a pending request stays
    /// reviewable.
    var domain: FriendCandidate {
        let profile = profile?.domain
        let status: FriendCandidateStatus = switch self.status {
        case "none": .none
        case "friends": .friends
        case "outgoing_pending": .outgoingPending
        case "incoming_pending": .incomingPending
        default: .unavailable
        }
        return FriendCandidate(
            status: profile == nil ? .unavailable : status,
            profile: profile,
            requestId: requestId
        )
    }
}

struct IncomingFriendRequestWire: Decodable {
    let requestId: String
    let senderId: String
    let displayName: String
    let username: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
        case senderId = "sender_id"
        case displayName = "display_name"
        case username
        case createdAt = "created_at"
    }

    var domain: IncomingFriendRequest {
        IncomingFriendRequest(
            requestId: requestId,
            sender: FriendProfile(
                id: senderId,
                displayName: displayName,
                username: username
            ),
            createdAt: createdAt
        )
    }
}

// MARK: - RPC parameters

struct SearchFriendCandidateParams: Encodable {
    let username: String

    enum CodingKeys: String, CodingKey {
        case username = "p_username"
    }
}

struct ListIncomingFriendRequestsParams: Encodable {
    let limit: Int

    enum CodingKeys: String, CodingKey {
        case limit = "p_limit"
    }
}

struct EmptyFriendsParams: Encodable {}

// MARK: - Edge Function bodies

struct SendFriendRequestBody: Encodable {
    let action = "send-request"
    let targetId: String
    let clientRequestId: String
}

struct RespondFriendRequestBody: Encodable {
    let action = "respond-request"
    let requestId: String
    let response: String
}

struct FriendCommandResponseWire: Decodable {
    let request: FriendRequestWire?
}

struct FriendRequestWire: Decodable {
    let id: String
    let status: String

    var domain: FriendRequestOutcome {
        FriendRequestOutcome(requestId: id, status: status)
    }
}

struct FriendCommandFailureWire: Decodable {
    let code: String?
    let error: String?
}

// MARK: - Realtime payloads

struct FriendEventWire: Decodable {
    let reason: String?
    let requestId: String?
    let friendshipId: String?

    init(reason: String?, requestId: String? = nil, friendshipId: String? = nil) {
        self.reason = reason
        self.requestId = requestId
        self.friendshipId = friendshipId
    }

    /// The server never sends `stream_resumed` — that reason is raised by the
    /// client on a successful (re)subscribe — so any string it does not know
    /// becomes `unknown` and is still delivered: every event means refetch.
    var domain: FriendEvent {
        let reason: FriendEventReason = switch self.reason {
        case "request_created": .requestCreated
        case "request_accepted": .requestAccepted
        case "request_declined": .requestDeclined
        case "request_cancelled": .requestCancelled
        case "friendship_created": .friendshipCreated
        case "friendship_removed": .friendshipRemoved
        default: .unknown
        }
        return FriendEvent(
            reason: reason,
            requestId: requestId,
            friendshipId: friendshipId
        )
    }
}

// MARK: - Failure mapping

/// Turns a non-2xx body into a calm failure. The server's `{code, error}` is
/// preserved verbatim when it is there; anything unreadable degrades to the
/// one fallback line rather than inventing a message.
func friendFailure(data: Data, statusCode: Int?) -> FriendCommandFailure {
    if statusCode == 401 { return .notAuthenticated }
    let body = try? JSONDecoder().decode(FriendCommandFailureWire.self, from: data)
    return FriendCommandFailure(
        code: body?.code?.presentValue ?? FriendCommandFailure.unavailable.code,
        notice: body?.error?.presentValue ?? FriendCommandFailure.unavailable.notice,
        statusCode: statusCode
    )
}

private extension String {
    var presentValue: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}
