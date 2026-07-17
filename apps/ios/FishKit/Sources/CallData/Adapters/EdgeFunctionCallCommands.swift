import Foundation

/// Live adapter for the `call-command` Edge Function — the same wire behavior
/// as the web `SupabaseCallCommandService`: one POST per command, a 15-second
/// timeout, and `{ code, error }` payloads surfaced as calm
/// `CallCommandFailure`s with the web's fallback copy.
public struct EdgeFunctionCallCommands: CallCommandProviding {
    static let requestTimeout: TimeInterval = 15

    private let configuration: CallBackendConfiguration
    private let session: URLSession

    public init(configuration: CallBackendConfiguration, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
    }

    public func initiate(
        recipientId: String,
        kind: CallKind,
        clientRequestId: String
    ) async throws -> CallCommandReply {
        try await send([
            "action": "initiate",
            "recipientId": recipientId,
            "kind": kind.rawValue,
            "clientRequestId": clientRequestId,
        ])
    }

    public func accept(callId: String) async throws -> CallCommandReply {
        try await send(["action": "accept", "callId": callId])
    }

    public func reject(callId: String) async throws -> CallCommandReply {
        try await send(["action": "reject", "callId": callId])
    }

    public func cancel(callId: String) async throws -> CallCommandReply {
        try await send(["action": "cancel", "callId": callId])
    }

    public func end(callId: String) async throws -> CallCommandReply {
        try await send(["action": "end", "callId": callId])
    }

    public func join(callId: String) async throws -> CallCommandReply {
        try await send(["action": "join", "callId": callId])
    }

    // MARK: - Transport

    private struct CommandResponse: Decodable {
        let call: ClientCall?
        let connection: CallConnection?
        let code: String?
        let error: String?
    }

    private func send(_ body: [String: String]) async throws -> CallCommandReply {
        guard let token = await configuration.accessToken() else {
            throw CallCommandFailure(
                code: "not_authenticated",
                notice: "Sign in before starting a call."
            )
        }

        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "functions/v1/call-command")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = Self.requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw CallCommandFailure.unavailable
        }

        let payload = try? JSONDecoder().decode(CommandResponse.self, from: data)
        guard
            let http = response as? HTTPURLResponse,
            (200..<300).contains(http.statusCode)
        else {
            throw CallCommandFailure(
                code: payload?.code ?? CallCommandFailure.unavailable.code,
                notice: payload?.error ?? CallCommandFailure.unavailable.notice
            )
        }
        guard let call = payload?.call else {
            throw CallCommandFailure.unavailable
        }
        return CallCommandReply(call: call, connection: payload?.connection)
    }
}
