import Foundation

public struct RestConversationDirectory: ConversationDirectoryProviding {
    private let configuration: ChatBackendConfiguration
    private let attention: @Sendable ([String]) -> AsyncStream<String>
    private let session: URLSession

    public init(
        configuration: ChatBackendConfiguration,
        attentionEvents: @escaping @Sendable ([String]) -> AsyncStream<String> = { _ in
            AsyncStream { $0.finish() }
        },
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        attention = attentionEvents
        self.session = session
    }

    public func conversations() async throws -> [ChatConversationPreview] {
        let rows = try await rpc(
            "list_direct_conversation_previews",
            body: EmptyRequest(),
            as: [ConversationPreviewWire].self
        )
        return rows.map(\.domain)
    }

    public func navigationAttention() async throws -> [ChatNavigationAttention] {
        let rows = try await rpc(
            "list_navigation_attention",
            body: EmptyRequest(),
            as: [NavigationAttentionWire].self
        )
        return rows.map(\.domain)
    }

    public func attentionEvents(conversationIds: [String]) -> AsyncStream<String> {
        attention(Array(Set(conversationIds)).sorted())
    }

    private func rpc<Request: Encodable, Response: Decodable>(
        _ name: String,
        body: Request,
        as type: Response.Type
    ) async throws -> Response {
        guard let token = await configuration.accessToken() else {
            throw ChatCommandFailure.notAuthenticated
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "rest/v1/rpc/\(name)")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else {
                throw chatFailure(
                    data: data,
                    statusCode: (response as? HTTPURLResponse)?.statusCode,
                    fallbackCode: "directory_unavailable",
                    fallbackNotice: "Conversations aren’t available yet. Try again."
                )
            }
            return try JSONDecoder().decode(type, from: data)
        } catch is CancellationError {
            throw CancellationError()
        } catch let failure as ChatCommandFailure {
            throw failure
        } catch {
            throw ChatCommandFailure(
                code: "directory_unavailable",
                notice: "Conversations aren’t available yet. Try again."
            )
        }
    }
}

private struct EmptyRequest: Encodable {}

private struct ConversationPreviewWire: Decodable {
    let conversationId: String
    let participantId: String
    let participantRole: String
    let participantDisplayName: String
    let latestMessageSenderId: String?
    let latestMessageText: String?
    let latestMessageCreatedAt: String?
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case participantId = "participant_id"
        case participantRole = "participant_role"
        case participantDisplayName = "participant_display_name"
        case latestMessageSenderId = "latest_message_sender_id"
        case latestMessageText = "latest_message_text"
        case latestMessageCreatedAt = "latest_message_created_at"
        case unreadCount = "unread_count"
    }

    var domain: ChatConversationPreview {
        ChatConversationPreview(
            conversationId: conversationId,
            participantId: participantId,
            participantRole: participantRole,
            participantDisplayName: participantDisplayName,
            latestMessageSenderId: latestMessageSenderId,
            latestMessageText: latestMessageText ?? "",
            latestMessageCreatedAt: ChatTimestamp.date(latestMessageCreatedAt),
            unreadCount: unreadCount
        )
    }
}

private struct NavigationAttentionWire: Decodable {
    let surface: String
    let entityId: String
    let conversationId: String?
    let unreadCount: Int
    let mentionCount: Int
    let newActivity: Bool

    enum CodingKeys: String, CodingKey {
        case surface
        case entityId = "entity_id"
        case conversationId = "conversation_id"
        case unreadCount = "unread_count"
        case mentionCount = "mention_count"
        case newActivity = "new_activity"
    }

    var domain: ChatNavigationAttention {
        ChatNavigationAttention(
            surface: surface,
            entityId: entityId,
            conversationId: conversationId,
            unreadCount: unreadCount,
            mentionCount: mentionCount,
            newActivity: newActivity
        )
    }
}
