import Foundation
import Testing
@testable import FriendsData

/// Wire-level tests of the friends RPC reads against a stubbed transport:
/// request shape, success decoding, and calm error mapping. Serialized — the
/// URLProtocol stub is process state.
@Suite(.serialized)
struct RestFriendDirectoryTests {
    private func makeDirectory(token: String? = "session-token") -> RestFriendDirectory {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [DirectoryStubURLProtocol.self]
        return RestFriendDirectory(
            configuration: FriendsBackendConfiguration(
                supabaseUrl: URL(string: "https://fish.test")!,
                anonKey: "anon-key",
                accessToken: { token }
            ),
            session: URLSession(configuration: configuration)
        )
    }

    @Test func searchPostsTheUsernameParameterWithAuthHeaders() async throws {
        let recorded = DirectoryStubURLProtocol.record(
            status: 200,
            body: """
            {"status":"none","profile":{"id":"user-1",
             "display_name":"Maya","username":"maya"}}
            """
        )

        let candidate = try await makeDirectory().searchCandidate(username: "maya")

        let request = try #require(recorded.request())
        #expect(
            request.url?.absoluteString
                == "https://fish.test/rest/v1/rpc/search_friend_candidate"
        )
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer session-token")
        #expect(request.value(forHTTPHeaderField: "apikey") == "anon-key")
        #expect(request.timeoutInterval == 15)
        #expect(recorded.bodyJSON == ["p_username": "maya"])

        #expect(candidate.status == .none)
        #expect(candidate.profile?.username == "maya")
    }

    @Test func incomingRequestsAskForOnePage() async throws {
        let recorded = DirectoryStubURLProtocol.record(
            status: 200,
            body: """
            [{"request_id":"req-1","sender_id":"user-1","display_name":"Maya",
              "username":"maya","created_at":"2026-07-29T10:00:00.000Z"},
             {"request_id":"req-2","sender_id":"user-2","display_name":"Ada",
              "username":"ada","created_at":"2026-07-28T10:00:00.000Z"}]
            """
        )

        let requests = try await makeDirectory().listIncomingRequests()

        let sent = try #require(recorded.request())
        #expect(
            sent.url?.absoluteString
                == "https://fish.test/rest/v1/rpc/list_incoming_friend_requests"
        )
        #expect(recorded.bodyText == #"{"p_limit":50}"#)
        #expect(requests.map(\.requestId) == ["req-1", "req-2"])
        #expect(requests.first?.sender.displayName == "Maya")
    }

    @Test func countDecodesABareIntegerBody() async throws {
        let recorded = DirectoryStubURLProtocol.record(status: 200, body: "3")

        let count = try await makeDirectory().countIncomingRequests()

        #expect(count == 3)
        #expect(recorded.bodyText == "{}")
        #expect(
            recorded.request()?.url?.absoluteString
                == "https://fish.test/rest/v1/rpc/count_incoming_friend_requests"
        )
    }

    @Test func serverFailureSurfacesItsOwnCalmCopy() async throws {
        _ = DirectoryStubURLProtocol.record(
            status: 403,
            body: """
            {"code":"friends_unavailable",
             "error":"Friends isn’t available for this account."}
            """
        )

        await #expect(throws: FriendCommandFailure(
            code: "friends_unavailable",
            notice: "Friends isn’t available for this account.",
            statusCode: 403
        )) {
            try await makeDirectory().searchCandidate(username: "maya")
        }
    }

    @Test func unreadablePayloadFallsBackToTheOneLine() async throws {
        _ = DirectoryStubURLProtocol.record(status: 503, body: "<html>gateway</html>")

        await #expect(throws: FriendCommandFailure(
            code: "friends_unavailable",
            notice: "Friends is taking a break. Chat still works.",
            statusCode: 503
        )) {
            try await makeDirectory().listIncomingRequests()
        }
    }

    @Test func unauthorizedNeverSurfacesTheDatabaseError() async throws {
        _ = DirectoryStubURLProtocol.record(
            status: 401,
            body: #"{"message":"JWT expired"}"#
        )

        await #expect(throws: FriendCommandFailure.notAuthenticated) {
            try await makeDirectory().countIncomingRequests()
        }
    }

    @Test func unreadableSuccessBodyStaysCalm() async throws {
        _ = DirectoryStubURLProtocol.record(status: 200, body: "not json")

        await #expect(throws: FriendCommandFailure.unavailable) {
            try await makeDirectory().searchCandidate(username: "maya")
        }
    }

    @Test func missingSessionFailsWithoutNetwork() async throws {
        let recorded = DirectoryStubURLProtocol.record(status: 200, body: "3")

        await #expect(throws: FriendCommandFailure.notAuthenticated) {
            try await makeDirectory(token: nil).countIncomingRequests()
        }
        #expect(recorded.request() == nil)
    }
}
