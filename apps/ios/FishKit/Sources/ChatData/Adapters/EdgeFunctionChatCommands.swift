import ChatCore
import Foundation

public struct EdgeFunctionChatCommands: ChatCommandProviding {
    private let configuration: ChatBackendConfiguration
    private let session: URLSession

    public init(
        configuration: ChatBackendConfiguration,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.session = session
    }

    public func execute(_ command: ChatMessageCommand) async throws -> ChatMessage {
        let body: AnyEncodable
        switch command {
        case .edit(let messageId, let messageBody):
            body = AnyEncodable(EditCommand(messageId: messageId, body: messageBody))
        case .delete(let messageId):
            body = AnyEncodable(DeleteCommand(messageId: messageId))
        case .toggleReaction(let messageId, let emoji):
            body = AnyEncodable(ReactionCommand(messageId: messageId, emoji: emoji))
        }
        let data = try await post(body)
        return try ChatWireDecoder.make().decode(MessageResponse.self, from: data).message.domain
    }

    public func reportGif(messageId: String) async throws {
        let data = try await post(AnyEncodable(ReportCommand(messageId: messageId)))
        let response = try JSONDecoder().decode(ReportResponse.self, from: data)
        guard response.reported else {
            throw ChatCommandFailure(
                code: "report_unavailable",
                notice: "That report did not send yet. Try again."
            )
        }
    }

    public func markReadState(
        conversationId: String,
        lastDeliveredMessageId: String?,
        lastReadMessageId: String?
    ) async throws -> ChatReadState {
        let body = ReadCommand(
            conversationId: conversationId,
            lastDeliveredMessageId: lastDeliveredMessageId,
            lastReadMessageId: lastReadMessageId
        )
        do {
            let data = try await post(AnyEncodable(body))
            return try JSONDecoder().decode(ReadResponse.self, from: data).readState.domain
        } catch is CancellationError {
            throw CancellationError()
        } catch let failure as ChatCommandFailure {
            if failure.code == ChatCommandFailure.notAuthenticated.code { throw failure }
            throw ChatCommandFailure(
                code: failure.code,
                notice: ChatCommandFailure.markReadUnavailable.notice,
                statusCode: failure.statusCode
            )
        } catch {
            throw ChatCommandFailure.markReadUnavailable
        }
    }

    public func unreadSummary(conversationId: String) async throws -> ChatUnreadSummary {
        guard let token = await configuration.accessToken() else {
            throw ChatCommandFailure.notAuthenticated
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "rest/v1/rpc/get_chat_unread_summary")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(UnreadCommand(conversationId: conversationId))
        let data = try await responseData(for: request)
        let row = try JSONDecoder().decode([UnreadSummaryWire].self, from: data).first
        return ChatUnreadSummary(
            count: row?.unreadCount ?? 0,
            oldestUnreadAt: ChatTimestamp.date(row?.oldestUnreadAt),
            latestUnreadMessageId: row?.latestUnreadMessageId
        )
    }

    private func post(_ body: AnyEncodable) async throws -> Data {
        guard let token = await configuration.accessToken() else {
            throw ChatCommandFailure.notAuthenticated
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "functions/v1/chat-command")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        return try await responseData(for: request)
    }

    private func responseData(for request: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else {
                throw chatFailure(
                    data: data,
                    statusCode: (response as? HTTPURLResponse)?.statusCode,
                    fallbackCode: "chat_unavailable",
                    fallbackNotice: ChatCommandFailure.unavailable.notice
                )
            }
            return data
        } catch is CancellationError {
            throw CancellationError()
        } catch let failure as ChatCommandFailure {
            throw failure
        } catch {
            throw ChatCommandFailure.unavailable
        }
    }
}

private struct EditCommand: Encodable {
    let action = "edit-message"
    let messageId: String
    let body: String
}

private struct DeleteCommand: Encodable {
    let action = "delete-message"
    let messageId: String
}

private struct ReactionCommand: Encodable {
    let action = "toggle-reaction"
    let messageId: String
    let emoji: String
}

private struct ReportCommand: Encodable {
    let action = "report-gif"
    let messageId: String
}

private struct ReadCommand: Encodable {
    let action = "mark-read-state"
    let conversationId: String
    let lastDeliveredMessageId: String?
    let lastReadMessageId: String?
}

private struct UnreadCommand: Encodable {
    let conversationId: String
    enum CodingKeys: String, CodingKey { case conversationId = "p_conversation_id" }
}

private struct MessageResponse: Decodable { let message: ChatMessageWire }
private struct ReportResponse: Decodable { let reported: Bool }
private struct ReadResponse: Decodable { let readState: ChatReadStateWire }

private struct UnreadSummaryWire: Decodable {
    let unreadCount: Int
    let oldestUnreadAt: String?
    let latestUnreadMessageId: String?

    enum CodingKeys: String, CodingKey {
        case unreadCount = "unread_count"
        case oldestUnreadAt = "oldest_unread_at"
        case latestUnreadMessageId = "latest_unread_message_id"
    }
}

private struct AnyEncodable: Encodable, @unchecked Sendable {
    private let encodeValue: (Encoder) throws -> Void

    init(_ value: some Encodable) {
        encodeValue = value.encode(to:)
    }

    func encode(to encoder: Encoder) throws { try encodeValue(encoder) }
}
