import CallData
import Foundation
import Testing

/// Wire-level tests of the `call-command` adapter against a stubbed
/// transport: request shape, success decoding, calm error mapping, and the
/// web-parity fallback copy. Serialized — the URLProtocol stub is shared
/// process state.
@Suite(.serialized)
struct EdgeFunctionCallCommandsTests {
    private static let sampleCallJSON = """
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "lessonSlotId": null,
      "coachId": "22222222-2222-4222-8222-222222222222",
      "clientId": "33333333-3333-4333-8333-333333333333",
      "initiatedBy": "22222222-2222-4222-8222-222222222222",
      "kind": "video",
      "status": "connecting",
      "expiresAt": "2026-07-17T10:00:45.000Z",
      "acceptedAt": "2026-07-17T10:00:10.000Z",
      "connectedAt": null,
      "endedAt": null,
      "endReason": null,
      "createdAt": "2026-07-17T10:00:00.000Z",
      "updatedAt": "2026-07-17T10:00:10.000Z"
    }
    """

    private func makeCommands(
        token: String? = "session-token"
    ) -> EdgeFunctionCallCommands {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return EdgeFunctionCallCommands(
            configuration: CallBackendConfiguration(
                supabaseUrl: URL(string: "https://fish.test")!,
                anonKey: "anon-key",
                accessToken: { token }
            ),
            session: URLSession(configuration: configuration)
        )
    }

    @Test func initiateSendsActionBodyAndAuthHeaders() async throws {
        let recorded = StubURLProtocol.record(
            status: 200,
            body: "{ \"call\": \(Self.sampleCallJSON) }"
        )
        let commands = makeCommands()

        let reply = try await commands.initiate(
            recipientId: "33333333-3333-4333-8333-333333333333",
            kind: .video,
            clientRequestId: "request-1"
        )

        let request = try #require(recorded.request())
        #expect(request.url?.absoluteString == "https://fish.test/functions/v1/call-command")
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer session-token")
        #expect(request.value(forHTTPHeaderField: "apikey") == "anon-key")
        #expect(request.timeoutInterval == 15)

        let body = try #require(recorded.bodyJSON())
        #expect(body["action"] == "initiate")
        #expect(body["recipientId"] == "33333333-3333-4333-8333-333333333333")
        #expect(body["kind"] == "video")
        #expect(body["clientRequestId"] == "request-1")

        #expect(reply.call.status == .connecting)
        #expect(reply.connection == nil)
    }

    @Test func acceptDecodesConnection() async throws {
        _ = StubURLProtocol.record(
            status: 200,
            body: """
            {
              "call": \(Self.sampleCallJSON),
              "connection": {
                "serverUrl": "wss://livekit.test",
                "participantToken": "livekit-jwt"
              }
            }
            """
        )
        let commands = makeCommands()

        let reply = try await commands.accept(callId: "11111111-1111-4111-8111-111111111111")

        #expect(reply.connection == CallConnection(
            serverUrl: "wss://livekit.test",
            participantToken: "livekit-jwt"
        ))
    }

    @Test func serverErrorSurfacesCalmNotice() async throws {
        _ = StubURLProtocol.record(
            status: 409,
            body: """
            { "code": "participant_busy",
              "error": "They’re already in a call. Try again a little later." }
            """
        )
        let commands = makeCommands()

        await #expect(throws: CallCommandFailure(
            code: "participant_busy",
            notice: "They’re already in a call. Try again a little later."
        )) {
            try await commands.initiate(
                recipientId: "33333333-3333-4333-8333-333333333333",
                kind: .audio,
                clientRequestId: "request-2"
            )
        }
    }

    @Test func unreadablePayloadFallsBackToWebCopy() async throws {
        _ = StubURLProtocol.record(status: 503, body: "<html>bad gateway</html>")
        let commands = makeCommands()

        await #expect(throws: CallCommandFailure.unavailable) {
            try await commands.end(callId: "11111111-1111-4111-8111-111111111111")
        }
        #expect(
            CallCommandFailure.unavailable.notice
                == "Calling is taking a break. Messages still work."
        )
    }

    @Test func successWithoutCallIsUnavailable() async throws {
        _ = StubURLProtocol.record(status: 200, body: "{}")
        let commands = makeCommands()

        await #expect(throws: CallCommandFailure.unavailable) {
            try await commands.join(callId: "11111111-1111-4111-8111-111111111111")
        }
    }

    @Test func missingSessionFailsWithoutNetwork() async throws {
        let commands = makeCommands(token: nil)

        await #expect(throws: CallCommandFailure(
            code: "not_authenticated",
            notice: "Sign in before starting a call."
        )) {
            try await commands.reject(callId: "11111111-1111-4111-8111-111111111111")
        }
    }
}
