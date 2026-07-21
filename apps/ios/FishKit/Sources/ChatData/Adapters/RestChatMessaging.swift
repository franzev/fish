import ChatCore
import Foundation

/// RLS-protected REST reads with stable composite cursors. Rows are enriched
/// in bounded batches before crossing the provider boundary.
public struct RestChatMessaging: ChatMessagingProviding {
    public static let defaultPageSize = 40
    public static let maximumPageSize = 100
    private static let maximumSearchPageSize = 99
    private static let reactionSummaryBatchSize = 50

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
        let response = try ChatWireDecoder.make().decode(SendResponse.self, from: data)
        return try await enrich([response.message.domain]).first ?? response.message.domain
    }

    public func messages(
        conversationId: String,
        before cursor: ChatMessageCursor?,
        limit requestedLimit: Int
    ) async throws -> ChatMessagePage {
        let limit = bounded(requestedLimit)
        var query = baseQuery(conversationId: conversationId)
        query += [
            URLQueryItem(name: "order", value: "created_at.desc,id.desc"),
            URLQueryItem(name: "limit", value: String(limit + 1)),
        ]
        if let cursor {
            query.append(URLQueryItem(
                name: "or",
                value: "(created_at.lt.\(cursor.createdAt),and(created_at.eq.\(cursor.createdAt),id.lt.\(cursor.id)))"
            ))
        }
        let rows = try await fetchRows(query: query)
        let hasMore = rows.count > limit
        let window = Array(rows.prefix(limit).reversed())
        let messages = try await enrich(window.map(\.domain))
        return ChatMessagePage(
            messages: messages,
            hasMoreOlder: hasMore,
            oldestCursor: messages.first.map(cursor(for:))
        )
    }

    public func newestWindow(
        conversationId: String,
        limit requestedLimit: Int
    ) async throws -> ChatNewestWindow {
        let page = try await messages(
            conversationId: conversationId,
            before: nil,
            limit: requestedLimit
        )
        async let reads = readStates(conversationId: conversationId)
        return try await ChatNewestWindow(
            messages: page.messages,
            readStates: reads,
            hasMoreOlder: page.hasMoreOlder,
            oldestCursor: page.oldestCursor
        )
    }

    public func messages(
        conversationId: String,
        after cursor: ChatMessageCursor,
        limit requestedLimit: Int
    ) async throws -> ChatBackfillPage {
        let limit = bounded(requestedLimit)
        var query = baseQuery(conversationId: conversationId)
        query += [
            URLQueryItem(
                name: "or",
                value: "(created_at.gt.\(cursor.createdAt),and(created_at.eq.\(cursor.createdAt),id.gt.\(cursor.id)))"
            ),
            URLQueryItem(name: "order", value: "created_at.asc,id.asc"),
            URLQueryItem(name: "limit", value: String(limit + 1)),
        ]
        let rows = try await fetchRows(query: query)
        return try await ChatBackfillPage(
            messages: enrich(Array(rows.prefix(limit)).map(\.domain)),
            needsReset: rows.count > limit
        )
    }

    public func messages(ids: [String]) async throws -> [ChatMessage] {
        let ids = Array(Set(ids.filter { !$0.isEmpty })).sorted()
        guard !ids.isEmpty else { return [] }
        guard ids.count <= 50 else {
            throw ChatCommandFailure.invalidRequest
        }
        let rows = try await fetchRows(query: [
            URLQueryItem(name: "select", value: Self.messageColumns),
            URLQueryItem(name: "id", value: "in.(\(ids.joined(separator: ",")))"),
            URLQueryItem(name: "order", value: "created_at.asc,id.asc"),
        ])
        return try await enrich(rows.map(\.domain))
    }

    public func searchMessages(
        conversationId: String,
        query: String,
        before cursor: ChatMessageSearchCursor?,
        limit requestedLimit: Int
    ) async throws -> ChatMessageSearchPage {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { throw ChatCommandFailure.invalidRequest }
        let limit = min(max(1, requestedLimit), Self.maximumSearchPageSize)
        let data = try await authenticatedRequest(
            path: "rest/v1/rpc/search_chat_messages",
            method: "POST",
            body: JSONEncoder().encode(SearchMessagesRequest(
                conversationId: conversationId,
                query: query,
                cursor: cursor,
                limit: limit
            ))
        )
        let rows = try ChatWireDecoder.make().decode([ChatMessageWire].self, from: data)
        let retained = Array(rows.prefix(limit))
        let hits = retained.map { row in
            ChatMessageSearchHit(
                id: row.id,
                conversationId: row.conversationId,
                senderId: row.senderId,
                body: row.body,
                createdAt: row.createdAt
            )
        }
        let nextCursor = rows.count > limit
            ? hits.last.map { hit in
                ChatMessageSearchCursor(
                    createdAt: ChatTimestamp.string(hit.createdAt),
                    id: hit.id
                )
            }
            : nil
        return ChatMessageSearchPage(hits: hits, nextCursor: nextCursor)
    }

    // MARK: - Reads and enrichment

    private func readStates(conversationId: String) async throws -> [ChatReadState] {
        let data = try await get(
            table: "message_reads",
            query: [
                URLQueryItem(
                    name: "select",
                    value: "user_id,last_delivered_message_id,delivered_at,last_read_message_id,read_at"
                ),
                URLQueryItem(name: "conversation_id", value: "eq.\(conversationId)"),
            ]
        )
        return try ChatWireDecoder.make().decode([ChatReadStateWire].self, from: data).map(\.domain)
    }

    private func enrich(_ messages: [ChatMessage]) async throws -> [ChatMessage] {
        guard !messages.isEmpty else { return [] }
        let ids = messages.map(\.id)
        async let hydratedAttachments = hydration.readyAttachments(forMessageIds: ids)
        async let gifs = gifRows(messageIds: ids)
        async let reactions = reactionRows(messageIds: ids)
        let (attachments, gifsByMessage, reactionsByMessage) = try await (
            hydratedAttachments,
            gifs,
            reactions
        )
        return messages.map { message in
            message.enriched(
                gif: gifsByMessage[message.id],
                reactions: reactionsByMessage[message.id] ?? message.reactions,
                attachments: attachments[message.id] ?? message.attachments
            )
        }
    }

    private func gifRows(messageIds: [String]) async throws -> [String: ChatGif] {
        do {
            let data = try await get(
                table: "message_gifs",
                query: [
                    URLQueryItem(
                        name: "select",
                        value: "message_id,provider,provider_content_id,title,description,source_url,poster_url,preview_url,media_url,width,height"
                    ),
                    URLQueryItem(name: "message_id", value: "in.(\(messageIds.joined(separator: ",")))"),
                ]
            )
            let rows = try ChatWireDecoder.make().decode([ChatGifWire].self, from: data)
            return Dictionary(uniqueKeysWithValues: rows.compactMap { row in
                row.messageId.map { ($0, row.domain) }
            })
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            return [:]
        }
    }

    private struct ReactionSummaryRequest: Encodable {
        let messageIds: [String]

        enum CodingKeys: String, CodingKey {
            case messageIds = "p_message_ids"
        }
    }

    private struct ReactionSummaryRow: Decodable {
        let messageId: String
        let emoji: String
        let count: Int
        let byMe: Bool

        enum CodingKeys: String, CodingKey {
            case messageId = "message_id"
            case emoji
            case count
            case byMe = "by_me"
        }

        var domain: ChatReaction {
            ChatReaction(emoji: emoji, count: count, byMe: byMe)
        }
    }

    private func reactionRows(messageIds: [String]) async throws -> [String: [ChatReaction]] {
        do {
            let ids = Array(Set(messageIds.filter { !$0.isEmpty })).sorted()
            var reactions: [String: [ChatReaction]] = [:]
            for start in stride(
                from: 0,
                to: ids.count,
                by: Self.reactionSummaryBatchSize
            ) {
                let end = min(start + Self.reactionSummaryBatchSize, ids.count)
                let batch = Array(ids[start..<end])
                let data = try await authenticatedRequest(
                    path: "rest/v1/rpc/list_message_reaction_summaries",
                    method: "POST",
                    body: JSONEncoder().encode(ReactionSummaryRequest(messageIds: batch))
                )
                let rows = try JSONDecoder().decode([ReactionSummaryRow].self, from: data)
                for row in rows {
                    reactions[row.messageId, default: []].append(row.domain)
                }
            }
            return reactions
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            return [:]
        }
    }

    private static let messageColumns = [
        "id", "conversation_id", "sender_id", "sender_role", "body",
        "client_request_id", "created_at", "edited_at", "deleted_at",
        "reply_to_message_id", "sticker_id",
    ].joined(separator: ",")

    private func baseQuery(conversationId: String) -> [URLQueryItem] {
        [
            URLQueryItem(name: "select", value: Self.messageColumns),
            URLQueryItem(name: "conversation_id", value: "eq.\(conversationId)"),
        ]
    }

    private func fetchRows(query: [URLQueryItem]) async throws -> [ChatMessageWire] {
        let data = try await get(table: "messages", query: query)
        return try ChatWireDecoder.make().decode([ChatMessageWire].self, from: data)
    }

    private func get(table: String, query: [URLQueryItem]) async throws -> Data {
        guard var components = URLComponents(
            url: configuration.supabaseUrl.appending(path: "rest/v1/\(table)"),
            resolvingAgainstBaseURL: false
        ) else { throw ChatCommandFailure.unavailable }
        components.queryItems = query
        guard let url = components.url else { throw ChatCommandFailure.unavailable }
        return try await authenticatedRequest(url: url, method: "GET", body: nil)
    }

    private func authenticatedRequest(path: String, method: String, body: Data?) async throws -> Data {
        try await authenticatedRequest(
            url: configuration.supabaseUrl.appending(path: path),
            method: method,
            body: body
        )
    }

    private func authenticatedRequest(url: URL, method: String, body: Data?) async throws -> Data {
        guard let token = await configuration.accessToken() else {
            throw ChatCommandFailure.notAuthenticated
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.httpBody = body
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
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

    private func bounded(_ limit: Int) -> Int {
        min(max(1, limit), Self.maximumPageSize)
    }

    private func cursor(for message: ChatMessage) -> ChatMessageCursor {
        ChatMessageCursor(createdAt: ChatTimestamp.string(message.createdAt), id: message.id)
    }
}

private struct SendResponse: Decodable { let message: ChatMessageWire }

private struct SearchMessagesRequest: Encodable {
    let conversationId: String
    let query: String
    let beforeCreatedAt: String?
    let beforeId: String?
    let limit: Int
    let sortDirection: String

    init(
        conversationId: String,
        query: String,
        cursor: ChatMessageSearchCursor?,
        limit: Int
    ) {
        self.conversationId = conversationId
        self.query = query
        beforeCreatedAt = cursor?.createdAt
        beforeId = cursor?.id
        self.limit = limit + 1
        sortDirection = "desc"
    }

    enum CodingKeys: String, CodingKey {
        case conversationId = "p_conversation_id"
        case query = "p_query"
        case beforeCreatedAt = "p_before_created_at"
        case beforeId = "p_before_id"
        case limit = "p_limit"
        case sortDirection = "p_sort_direction"
    }
}

struct ChatFailureWire: Decodable {
    let code: String?
    let error: String?
}

func chatFailure(
    data: Data,
    statusCode: Int?,
    fallbackCode: String,
    fallbackNotice: String
) -> ChatCommandFailure {
    if statusCode == 401 { return .notAuthenticated }
    let failure = try? JSONDecoder().decode(ChatFailureWire.self, from: data)
    return ChatCommandFailure(
        code: failure?.code ?? fallbackCode,
        notice: failure?.error ?? fallbackNotice,
        statusCode: statusCode
    )
}
