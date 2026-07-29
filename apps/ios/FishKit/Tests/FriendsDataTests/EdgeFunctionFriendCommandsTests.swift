import Foundation
import Testing
@testable import FriendsData

/// Wire-level tests of the `friend-command` adapter against a stubbed
/// transport: the outbound body the deployed function validates, success
/// decoding, and the codes callers branch on. Serialized — the URLProtocol
/// stub is process state.
@Suite(.serialized)
struct EdgeFunctionFriendCommandsTests {
    private static let requestJSON = """
    {"id":"req-1",
     "senderId":"11111111-1111-4111-8111-111111111111",
     "recipientId":"33333333-3333-4333-8333-333333333333",
     "status":"pending",
     "createdAt":"2026-07-29T10:00:00.000Z",
     "updatedAt":"2026-07-29T10:00:00.000Z",
     "respondedAt":null}
    """

    private func makeCommands(
        token: String? = "session-token"
    ) -> EdgeFunctionFriendCommands {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CommandStubURLProtocol.self]
        return EdgeFunctionFriendCommands(
            configuration: FriendsBackendConfiguration(
                supabaseUrl: URL(string: "https://fish.test")!,
                anonKey: "anon-key",
                accessToken: { token }
            ),
            session: URLSession(configuration: configuration)
        )
    }

    @Test func sendPostsTheCamelCaseActionBodyWithAuthHeaders() async throws {
        let recorded = CommandStubURLProtocol.record(
            status: 200,
            body: "{ \"request\": \(Self.requestJSON) }"
        )

        let outcome = try await makeCommands().sendRequest(
            targetId: "33333333-3333-4333-8333-333333333333",
            clientRequestId: "request-1"
        )

        let request = try #require(recorded.request())
        #expect(
            request.url?.absoluteString
                == "https://fish.test/functions/v1/friend-command"
        )
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer session-token")
        #expect(request.value(forHTTPHeaderField: "apikey") == "anon-key")
        #expect(request.timeoutInterval == 15)

        let body = try #require(recorded.bodyJSON)
        #expect(body == [
            "action": "send-request",
            "targetId": "33333333-3333-4333-8333-333333333333",
            "clientRequestId": "request-1",
        ])

        #expect(outcome == FriendRequestOutcome(requestId: "req-1", status: "pending"))
    }

    @Test func respondPostsTheResponseLiteral() async throws {
        let recorded = CommandStubURLProtocol.record(
            status: 200,
            body: """
            {"request":{"id":"req-1","senderId":"user-1","recipientId":"user-2",
             "status":"accepted","createdAt":"2026-07-29T10:00:00.000Z",
             "updatedAt":"2026-07-29T10:01:00.000Z",
             "respondedAt":"2026-07-29T10:01:00.000Z"}}
            """
        )

        let outcome = try await makeCommands().respondRequest(
            requestId: "req-1",
            response: .accept
        )

        #expect(try #require(recorded.bodyJSON) == [
            "action": "respond-request",
            "requestId": "req-1",
            "response": "accept",
        ])
        #expect(outcome == FriendRequestOutcome(
            requestId: "req-1",
            status: FriendRequestStatus.accepted
        ))
    }

    @Test func declineSendsItsOwnLiteral() async throws {
        let recorded = CommandStubURLProtocol.record(
            status: 200,
            body: """
            {"request":{"id":"req-1","senderId":"user-1","recipientId":"user-2",
             "status":"declined","createdAt":"2026-07-29T10:00:00.000Z",
             "updatedAt":"2026-07-29T10:01:00.000Z",
             "respondedAt":"2026-07-29T10:01:00.000Z"}}
            """
        )

        let outcome = try await makeCommands().respondRequest(
            requestId: "req-1",
            response: .decline
        )

        #expect(recorded.bodyJSON?["response"] == "decline")
        #expect(outcome.status == FriendRequestStatus.declined)
    }

    /// A conflict is often the answer the person wanted, so the code has to
    /// survive the transport intact — and the server's sentence with it.
    @Test func conflictKeepsTheServerCodeAndCopy() async throws {
        _ = CommandStubURLProtocol.record(
            status: 409,
            body: """
            {"code":"incoming_request_exists",
             "error":"They already sent you a request. Review it when you’re ready."}
            """
        )

        await #expect(throws: FriendCommandFailure(
            code: FriendCommandCode.incomingRequestExists,
            notice: "They already sent you a request. Review it when you’re ready.",
            statusCode: 409
        )) {
            try await makeCommands().sendRequest(
                targetId: "33333333-3333-4333-8333-333333333333",
                clientRequestId: "request-2"
            )
        }
    }

    @Test func unreadablePayloadFallsBackToTheOneLine() async throws {
        _ = CommandStubURLProtocol.record(status: 503, body: "<html>gateway</html>")

        await #expect(throws: FriendCommandFailure(
            code: FriendCommandCode.friendsUnavailable,
            notice: "Friends is taking a break. Chat still works.",
            statusCode: 503
        )) {
            try await makeCommands().respondRequest(requestId: "req-1", response: .accept)
        }
    }

    @Test func unauthorizedMapsToTheSignInNotice() async throws {
        _ = CommandStubURLProtocol.record(
            status: 401,
            body: #"{"code":"not_authenticated","error":"Sign in to manage friends."}"#
        )

        await #expect(throws: FriendCommandFailure.notAuthenticated) {
            try await makeCommands().sendRequest(
                targetId: "33333333-3333-4333-8333-333333333333",
                clientRequestId: "request-3"
            )
        }
    }

    @Test func successWithoutARequestRowIsUnavailable() async throws {
        _ = CommandStubURLProtocol.record(status: 200, body: "{}")

        await #expect(throws: FriendCommandFailure.unavailable) {
            try await makeCommands().respondRequest(requestId: "req-1", response: .decline)
        }
    }

    @Test func missingSessionFailsWithoutNetwork() async throws {
        let recorded = CommandStubURLProtocol.record(
            status: 200,
            body: "{ \"request\": \(Self.requestJSON) }"
        )

        await #expect(throws: FriendCommandFailure.notAuthenticated) {
            try await makeCommands(token: nil).sendRequest(
                targetId: "33333333-3333-4333-8333-333333333333",
                clientRequestId: "request-4"
            )
        }
        #expect(recorded.request() == nil)
    }
}
