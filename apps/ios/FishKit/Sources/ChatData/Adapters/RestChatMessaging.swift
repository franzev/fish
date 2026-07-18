import Foundation

/// Minimal live send/fetch slice for the attachment lab and future chat data
/// layer. Realtime remains outside this feature; fetched rows are hydrated in
/// one attachment batch before they cross the provider boundary.
public struct RestChatMessaging: ChatMessagingProviding {
    private let configuration: ChatBackendConfiguration
    private let hydration: any AttachmentHydrating
    private let session: URLSession

    public init(
        configuration: ChatBackendConfiguration,
        hydration: any AttachmentHydrating,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.hydration = hydration
        self.session = session
    }

    public func send(_ command: SendChatMessageRequest) async throws -> ChatMessage {
        let data = try await authenticatedRequest(
            path: "functions/v1/send-message",
            method: "POST",
            body: JSONEncoder().encode(command)
        )
        let response = try Self.makeDecoder().decode(SendResponse.self, from: data)
        return response.message.domain
    }

    public func messages(conversationId: String) async throws -> [ChatMessage] {
        guard var components = URLComponents(
            url: configuration.supabaseUrl.appending(path: "rest/v1/messages"),
            resolvingAgainstBaseURL: false
        ) else { throw AttachmentCommandFailure.unavailable }
        components.queryItems = [
            URLQueryItem(name: "select", value: "id,conversation_id,sender_id,sender_role,body,created_at"),
            URLQueryItem(name: "conversation_id", value: "eq.\(conversationId)"),
            URLQueryItem(name: "deleted_at", value: "is.null"),
            URLQueryItem(name: "order", value: "created_at.asc,id.asc"),
        ]
        guard let url = components.url else { throw AttachmentCommandFailure.unavailable }
        let data = try await authenticatedRequest(url: url, method: "GET", body: nil)
        let rows = try Self.makeDecoder().decode([MessageWire].self, from: data)
        let attachments = try await hydration.readyAttachments(
            forMessageIds: rows.map(\.id)
        )
        return rows.map { $0.domain.withAttachments(attachments[$0.id] ?? []) }
    }

    private func authenticatedRequest(
        path: String,
        method: String,
        body: Data?
    ) async throws -> Data {
        try await authenticatedRequest(
            url: configuration.supabaseUrl.appending(path: path),
            method: method,
            body: body
        )
    }

    private func authenticatedRequest(
        url: URL,
        method: String,
        body: Data?
    ) async throws -> Data {
        guard let token = await configuration.accessToken() else {
            throw AttachmentCommandFailure(
                code: "not_authenticated",
                notice: "Sign in to continue.",
                statusCode: 401
            )
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.httpBody = body
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            let failure = try? JSONDecoder().decode(MessagingFailure.self, from: data)
            throw AttachmentCommandFailure(
                code: failure?.code ?? "send_unavailable",
                notice: failure?.error ?? "That did not send yet. Keep this open and try again.",
                statusCode: (response as? HTTPURLResponse)?.statusCode
            )
        }
        return data
    }

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: value) { return date }
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Invalid ISO-8601 date"
            )
        }
        return decoder
    }
}

private struct SendResponse: Decodable { let message: MessageWire }
private struct MessagingFailure: Decodable { let code: String?; let error: String? }

private struct MessageWire: Decodable {
    let id: String
    let conversationId: String
    let senderId: String
    let senderRole: String
    let body: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, body
        case conversationId = "conversation_id"
        case senderId = "sender_id"
        case senderRole = "sender_role"
        case createdAt = "created_at"
    }

    var domain: ChatMessage {
        ChatMessage(
            id: id,
            conversationId: conversationId,
            senderId: senderId,
            senderRole: senderRole,
            body: body,
            createdAt: createdAt
        )
    }
}
