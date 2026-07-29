import Foundation
import Testing
@testable import FriendsData

/// The deployed friends contract as this client reads it: the candidate jsonb
/// of `search_friend_candidate`, the rows of `list_incoming_friend_requests`,
/// the `friend-command` bodies, and the broadcast payloads of migration 0021.
struct FriendsWireTests {
    private func candidate(_ json: String) throws -> FriendCandidate {
        try JSONDecoder()
            .decode(FriendCandidateWire.self, from: Data(json.utf8))
            .domain
    }

    private static let profileJSON = """
    {"id":"33333333-3333-4333-8333-333333333333",
     "display_name":"Maya","username":"maya"}
    """

    private static let profile = FriendProfile(
        id: "33333333-3333-4333-8333-333333333333",
        displayName: "Maya",
        username: "maya"
    )

    @Test func strangerDecodesAsAddable() throws {
        let candidate = try candidate(
            #"{"status":"none","profile":\#(Self.profileJSON)}"#
        )
        #expect(candidate == FriendCandidate(status: .none, profile: Self.profile))
    }

    @Test func existingFriendDecodesWithoutRequestId() throws {
        let candidate = try candidate(
            #"{"status":"friends","profile":\#(Self.profileJSON)}"#
        )
        #expect(candidate == FriendCandidate(status: .friends, profile: Self.profile))
    }

    @Test func pendingDirectionsKeepTheirRequestId() throws {
        let outgoing = try candidate("""
        {"status":"outgoing_pending","request_id":"req-1","profile":\(Self.profileJSON)}
        """)
        #expect(outgoing == FriendCandidate(
            status: .outgoingPending,
            profile: Self.profile,
            requestId: "req-1"
        ))

        let incoming = try candidate("""
        {"status":"incoming_pending","request_id":"req-2","profile":\(Self.profileJSON)}
        """)
        #expect(incoming == FriendCandidate(
            status: .incomingPending,
            profile: Self.profile,
            requestId: "req-2"
        ))
    }

    @Test func unavailableStaysCauseLess() throws {
        let candidate = try candidate(#"{"status":"unavailable"}"#)
        #expect(candidate == FriendCandidate(status: .unavailable))
    }

    @Test func unknownStatusCollapsesToUnavailable() throws {
        let candidate = try candidate(
            #"{"status":"pending_review","profile":\#(Self.profileJSON)}"#
        )
        #expect(candidate.status == .unavailable)
        #expect(candidate.profile == Self.profile)
    }

    @Test func missingProfileCollapsesToUnavailableAndKeepsTheRequestId() throws {
        let candidate = try candidate(
            #"{"status":"incoming_pending","request_id":"req-3"}"#
        )
        #expect(candidate == FriendCandidate(
            status: .unavailable,
            profile: nil,
            requestId: "req-3"
        ))
    }

    @Test func partialProfileIsNoProfile() throws {
        let candidate = try candidate("""
        {"status":"none","profile":{"id":"user-1","display_name":"Maya"}}
        """)
        #expect(candidate == FriendCandidate(status: .unavailable))
    }

    @Test func incomingRequestRowsDecodeServerKeys() throws {
        let rows = try JSONDecoder().decode(
            [IncomingFriendRequestWire].self,
            from: Data("""
            [{"request_id":"req-1",
              "sender_id":"33333333-3333-4333-8333-333333333333",
              "display_name":"Maya","username":"maya",
              "created_at":"2026-07-29T10:00:00.000Z"}]
            """.utf8)
        )
        #expect(rows.map(\.domain) == [IncomingFriendRequest(
            requestId: "req-1",
            sender: Self.profile,
            createdAt: "2026-07-29T10:00:00.000Z"
        )])
    }

    @Test func commandResponseDecodesTheRequestRow() throws {
        let response = try JSONDecoder().decode(
            FriendCommandResponseWire.self,
            from: Data("""
            {"request":{"id":"req-1",
             "senderId":"user-1","recipientId":"user-2","status":"pending",
             "createdAt":"2026-07-29T10:00:00.000Z",
             "updatedAt":"2026-07-29T10:00:00.000Z","respondedAt":null}}
            """.utf8)
        )
        #expect(response.request?.domain == FriendRequestOutcome(
            requestId: "req-1",
            status: FriendRequestStatus.pending
        ))

        let empty = try JSONDecoder().decode(
            FriendCommandResponseWire.self,
            from: Data("{}".utf8)
        )
        #expect(empty.request == nil)
    }

    @Test func serverFailureCopyPassesThroughVerbatim() {
        let failure = friendFailure(
            data: Data("""
            {"code":"already_friends","error":"You’re already friends."}
            """.utf8),
            statusCode: 409
        )
        #expect(failure == FriendCommandFailure(
            code: FriendCommandCode.alreadyFriends,
            notice: "You’re already friends.",
            statusCode: 409
        ))
    }

    @Test func unreadableFailureBodyFallsBackToTheOneLine() {
        let failure = friendFailure(
            data: Data("<html>bad gateway</html>".utf8),
            statusCode: 503
        )
        #expect(failure.code == FriendCommandCode.friendsUnavailable)
        #expect(failure.notice == "Friends is taking a break. Chat still works.")
        #expect(failure.statusCode == 503)
        #expect(
            FriendCommandFailure.unavailable.notice
                == "Friends is taking a break. Chat still works."
        )
    }

    @Test func blankFailureFieldsFallBackToTheOneLine() {
        let failure = friendFailure(
            data: Data(#"{"code":"","error":"   "}"#.utf8),
            statusCode: 500
        )
        #expect(failure.code == FriendCommandFailure.unavailable.code)
        #expect(failure.notice == FriendCommandFailure.unavailable.notice)
    }

    @Test func unauthorizedNeverSurfacesTheRawBody() {
        let failure = friendFailure(
            data: Data(#"{"message":"JWT expired"}"#.utf8),
            statusCode: 401
        )
        #expect(failure == FriendCommandFailure.notAuthenticated)
        #expect(failure.notice == "Sign in to manage friends.")
    }

    @Test func broadcastReasonsMapToEveryServerValue() {
        let expected: [String: FriendEventReason] = [
            "request_created": .requestCreated,
            "request_accepted": .requestAccepted,
            "request_declined": .requestDeclined,
            "request_cancelled": .requestCancelled,
            "friendship_created": .friendshipCreated,
            "friendship_removed": .friendshipRemoved,
        ]
        for (wire, reason) in expected {
            #expect(FriendEventWire(reason: wire).domain.reason == reason)
        }
    }

    @Test func requestAndFriendshipPayloadsKeepTheirIds() throws {
        let request = try JSONDecoder().decode(
            FriendEventWire.self,
            from: Data("""
            {"reason":"request_created","requestId":"req-1",
             "occurredAt":"2026-07-29T10:00:00.000Z"}
            """.utf8)
        )
        #expect(request.domain == FriendEvent(reason: .requestCreated, requestId: "req-1"))

        let friendship = try JSONDecoder().decode(
            FriendEventWire.self,
            from: Data("""
            {"reason":"friendship_created","friendshipId":"friendship-1",
             "occurredAt":"2026-07-29T10:00:00.000Z"}
            """.utf8)
        )
        #expect(friendship.domain == FriendEvent(
            reason: .friendshipCreated,
            friendshipId: "friendship-1"
        ))
    }

    @Test func unrecognisedReasonsAreStillDelivered() {
        #expect(FriendEventWire(reason: "friendship_paused").domain.reason == .unknown)
        #expect(FriendEventWire(reason: nil).domain.reason == .unknown)
    }

    /// `streamResumed` is raised by the client on a successful (re)subscribe.
    /// No server string may ever produce it — including the one that looks
    /// like it would.
    @Test func theWireCanNeverProduceStreamResumed() {
        #expect(FriendEventWire(reason: "stream_resumed").domain.reason == .unknown)
        #expect(FriendEventWire(reason: "streamResumed").domain.reason == .unknown)
    }

    @Test func realtimeTopicAndEventMatchTheDeployedTriggers() {
        #expect(
            FriendsRealtimeWire.topic(userId: "user-1") == "friends:user:user-1"
        )
        #expect(FriendsRealtimeWire.changedEvent == "friends.changed")
    }
}
