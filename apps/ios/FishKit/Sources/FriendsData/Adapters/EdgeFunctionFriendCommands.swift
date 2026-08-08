import Foundation

/// Live adapter for the `friend-command` Edge Function — one POST per
/// command, a 15-second timeout, and `{code, error}` bodies surfaced as calm
/// `FriendCommandFailure`s so callers can branch on the code (a conflict is
/// often the answer the person wanted).
public struct EdgeFunctionFriendCommands: FriendCommandsProviding {
    static let requestTimeout: TimeInterval = 15

    private let configuration: FriendsBackendConfiguration
    private let session: URLSession
    private let encoder = JSONEncoder()

    public init(
        configuration: FriendsBackendConfiguration,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.session = session
    }

    public func sendRequest(
        targetId: String,
        clientRequestId: String
    ) async throws -> FriendRequestOutcome {
        try await send(
            SendFriendRequestBody(
                targetId: targetId,
                clientRequestId: clientRequestId
            )
        )
    }

    public func respondRequest(
        requestId: String,
        response: FriendRequestResponse
    ) async throws -> FriendRequestOutcome {
        try await send(
            RespondFriendRequestBody(
                requestId: requestId,
                response: response.rawValue
            )
        )
    }

    public func blockUser(targetId: String) async throws {
        try await sendCommand(BlockUserBody(targetId: targetId))
    }

    public func reportUser(targetId: String) async throws {
        try await sendCommand(ReportUserBody(targetId: targetId))
    }

    /// The success body is `{request: {...}}`. A 2xx carrying no request row
    /// still means friends could not do the thing, so it degrades to the one
    /// fallback line rather than inventing a message here.
    private func send<Request: Encodable>(
        _ body: Request
    ) async throws -> FriendRequestOutcome {
        let data = try await post(body)
        guard let outcome = try? JSONDecoder()
            .decode(FriendCommandResponseWire.self, from: data)
            .request?.domain
        else {
            throw FriendCommandFailure.unavailable
        }
        return outcome
    }

    /// block-user and report-user answer `{done: boolean}` instead of
    /// `send`'s `{request: {...}}` — a 2xx with no readable `done` still
    /// means the command did not go through. Careful before routing
    /// unblock-user here: its RPC returns `false` for a no-op unblock, which
    /// this helper would misread as a failure.
    private func sendCommand<Request: Encodable>(_ body: Request) async throws {
        let data = try await post(body)
        guard (try? JSONDecoder().decode(FriendCommandDoneWire.self, from: data))?.done == true
        else {
            throw FriendCommandFailure.unavailable
        }
    }

    private func post<Request: Encodable>(_ body: Request) async throws -> Data {
        guard let token = await configuration.accessToken() else {
            throw FriendCommandFailure.notAuthenticated
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "functions/v1/friend-command")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = Self.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw FriendCommandFailure.unavailable
        }
        let http = response as? HTTPURLResponse
        guard let http, (200..<300).contains(http.statusCode) else {
            throw friendFailure(data: data, statusCode: http?.statusCode)
        }
        return data
    }
}
