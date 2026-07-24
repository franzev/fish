import ChatCore
import Foundation

/// Authorized shared-content listing and cache reconciliation. Supabase wire
/// values are decoded and discarded inside this adapter; only safe repository
/// values cross the ChatData boundary.
public final class SupabaseSharedContentRepository:
    SharedContentProviding,
    SharedContentGenerationRevoking,
    @unchecked Sendable
{
    private static let pageSize = 40
    private static let categories: Set<String> = ["media", "files", "links", "voice"]
    private static let kinds: Set<String> = ["photo", "video", "gif", "sticker", "document", "link", "voice"]

    private let configuration: ChatBackendConfiguration
    private let cache: any SharedContentCaching
    private let directory: any ConversationDirectoryProviding
    private let verifiedOwner: @Sendable () async -> String?
    private let session: URLSession
    private let lock = NSLock()
    private var activeToken: SharedContentRequestToken?
    private var activeOwner: String?
    private var activeGeneration = 0

    public init(
        configuration: ChatBackendConfiguration,
        cache: any SharedContentCaching,
        directory: any ConversationDirectoryProviding,
        verifiedOwner: @escaping @Sendable () async -> String?,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.cache = cache
        self.directory = directory
        self.verifiedOwner = verifiedOwner
        self.session = session
    }

    public func observeSharedContentSnapshot(
        conversationId: String
    ) -> AsyncStream<StoredSharedContentSnapshot?> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let task = Task { [weak self] in
                guard let self else {
                    continuation.yield(nil)
                    continuation.finish()
                    return
                }
                let snapshot = await self.authorizedSnapshot(conversationId: conversationId)
                continuation.yield(snapshot)
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    public func refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?
    ) async -> SharedContentRepositoryResult<SharedContentDataPage> {
        guard !token.ownerIdentityId.isEmpty,
              !token.conversationId.isEmpty,
              !token.cycleId.isEmpty,
              !token.requestId.isEmpty,
              token.identityGeneration > 0,
              category == nil || Self.categories.contains(category!)
        else { return .failure(.invalidInput) }

        switch await authorize(token) {
        case .failure(let failure): return .failure(failure)
        case .success: break
        }

        do {
            let data = try await rpc(
                name: "list_conversation_shared_content",
                body: SharedContentListingRequest(token: token, category: category)
            )
            let page = try Self.decodePage(data: data, conversationId: token.conversationId)
            guard await accepts(token) else { return .failure(.requestSuperseded) }

            let storedItems = page.items.map(Self.storedItem)
            do {
                if token.replace {
                    try await cache.replaceNewestWindow(
                        ownerIdentityId: token.ownerIdentityId,
                        conversationId: token.conversationId,
                        identityGeneration: token.identityGeneration,
                        items: storedItems,
                        retainedOldestCursor: page.nextCursor.flatMap(Self.encodeCursor),
                        retainedHistoryComplete: !page.hasMore,
                        authoritativeEmptyConfirmed: page.items.isEmpty
                    )
                } else {
                    _ = try await cache.appendBrowsedPageAllocatingOrdinal(
                        ownerIdentityId: token.ownerIdentityId,
                        conversationId: token.conversationId,
                        identityGeneration: token.identityGeneration,
                        pageId: "shared-content-page-\(token.requestId)",
                        retainedCursor: page.nextCursor.flatMap(Self.encodeCursor),
                        items: storedItems,
                        retainedHistoryComplete: !page.hasMore
                    )
                }
            } catch is CancellationError {
                return .failure(.requestSuperseded)
            } catch SharedContentCacheFailure.staleGeneration {
                return .failure(.requestSuperseded)
            } catch {
                return .failure(.cache)
            }
            guard await accepts(token) else { return .failure(.requestSuperseded) }
            return .success(page)
        } catch is CancellationError {
            return .failure(.requestSuperseded)
        } catch let failure as SharedContentRepositoryFailure {
            return .failure(failure)
        } catch let failure as TransportFailure {
            return .failure(failure.repositoryFailure)
        } catch {
            return .failure(.invalidResponse)
        }
    }

    public func refreshSharedContentCategories(
        token: SharedContentRequestToken
    ) async -> SharedContentRepositoryResult<[String]> {
        guard !token.ownerIdentityId.isEmpty,
              !token.conversationId.isEmpty,
              token.identityGeneration > 0
        else { return .failure(.invalidInput) }
        switch await authorize(token) {
        case .failure(let failure): return .failure(failure)
        case .success: break
        }

        do {
            let data = try await rpc(
                name: "list_conversation_shared_content_categories",
                body: SharedContentCategoryRequest(conversationId: token.conversationId)
            )
            let categories = try Self.decodeCategories(data: data)
            guard await accepts(token) else { return .failure(.requestSuperseded) }
            return .success(categories)
        } catch is CancellationError {
            return .failure(.requestSuperseded)
        } catch let failure as TransportFailure {
            return .failure(failure.repositoryFailure)
        } catch {
            return .failure(.invalidResponse)
        }
    }

    private func authorizedSnapshot(conversationId: String) async -> StoredSharedContentSnapshot? {
        guard let owner = await verifiedOwner(), !owner.isEmpty, !conversationId.isEmpty else { return nil }
        do {
            let conversations = try await directory.conversations()
            guard conversations.contains(where: { $0.conversationId == conversationId }) else {
                try? await cache.purgeConversation(ownerIdentityId: owner, conversationId: conversationId)
                return nil
            }
            return try await cache.hydrateVerifiedOwner(
                verifiedOwnerId: owner,
                conversationId: conversationId
            )
        } catch {
            return nil
        }
    }

    private func authorize(
        _ token: SharedContentRequestToken
    ) async -> SharedContentRepositoryResult<Void> {
        guard let owner = await verifiedOwner(), owner == token.ownerIdentityId else {
            return .failure(.identityIneligible)
        }
        guard activate(token) else { return .failure(.requestSuperseded) }

        // Cache hydration is intentionally before the authoritative membership
        // check, but its contents never participate in that authorization.
        _ = try? await cache.hydrateVerifiedOwner(
            verifiedOwnerId: owner,
            conversationId: token.conversationId
        )

        do {
            let conversations = try await directory.conversations()
            guard conversations.contains(where: { $0.conversationId == token.conversationId }) else {
                try? await cache.purgeConversation(
                    ownerIdentityId: owner,
                    conversationId: token.conversationId
                )
                deactivate(token)
                return .failure(.authorization)
            }
            return .success(())
        } catch is CancellationError {
            return .failure(.requestSuperseded)
        } catch {
            return .failure(.network)
        }
    }

    private func activate(_ token: SharedContentRequestToken) -> Bool {
        lock.withLock {
            guard token.identityGeneration >= activeGeneration else { return false }
            if let activeOwner {
                if activeOwner == token.ownerIdentityId {
                    guard token.identityGeneration == activeGeneration else { return false }
                } else {
                    guard token.identityGeneration > activeGeneration else { return false }
                }
            }
            activeOwner = token.ownerIdentityId
            activeGeneration = token.identityGeneration
            activeToken = token
            return true
        }
    }

    public func revokeIdentityGeneration(_ generation: Int) async {
        guard generation > 0 else { return }
        lock.withLock {
            activeGeneration = max(activeGeneration, generation)
            activeOwner = nil
            activeToken = nil
        }
        await cache.revokeIdentityGeneration(through: generation)
    }

    private func accepts(_ token: SharedContentRequestToken) async -> Bool {
        guard let owner = await verifiedOwner(), owner == token.ownerIdentityId else { return false }
        return lock.withLock {
            activeOwner == token.ownerIdentityId &&
                activeGeneration == token.identityGeneration &&
                activeToken == token
        }
    }

    private func deactivate(_ token: SharedContentRequestToken) {
        lock.withLock {
            if activeToken == token { activeToken = nil }
        }
    }

    private func rpc<Request: Encodable>(
        name: String,
        body: Request
    ) async throws -> Data {
        guard let accessToken = await configuration.accessToken(), !accessToken.isEmpty else {
            throw TransportFailure.authentication
        }
        var request = URLRequest(
            url: configuration.supabaseUrl.appending(path: "rest/v1/rpc/\(name)")
        )
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(body)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw TransportFailure.network }
            guard (200..<300).contains(http.statusCode) else {
                if http.statusCode == 401 { throw TransportFailure.authentication }
                if http.statusCode == 403 { throw TransportFailure.authorization }
                throw TransportFailure.remote
            }
            return data
        } catch is CancellationError {
            throw CancellationError()
        } catch let failure as TransportFailure {
            throw failure
        } catch {
            throw TransportFailure.network
        }
    }

    private static func decodePage(
        data: Data,
        conversationId: String
    ) throws -> SharedContentDataPage {
        let rows = try StrictWireDecoder.decodeRows(data)
        guard rows.count <= pageSize + 1 else { throw SharedContentRepositoryFailure.invalidResponse }
        let items = rows.map(SharedContentDataItem.init)
        guard Set(items.map(\.itemId)).count == items.count,
              items.allSatisfy({ valid($0, conversationId: conversationId) }),
              items.dropFirst().enumerated().allSatisfy({ offset, item in
                  isOrderedBefore(items[offset], item)
              })
        else { throw SharedContentRepositoryFailure.invalidResponse }

        let retained = Array(items.prefix(pageSize))
        let cursor = retained.last.map {
            SharedContentDataCursor(
                sourceCreatedAt: $0.sourceCreatedAt,
                sourceMessageId: $0.sourceMessageId,
                sourceRank: $0.sourceRank,
                itemId: $0.itemId
            )
        }
        return SharedContentDataPage(
            items: retained,
            hasMore: rows.count == pageSize + 1,
            nextCursor: cursor
        )
    }

    private static func decodeCategories(data: Data) throws -> [String] {
        let categories = try StrictWireDecoder.decodeCategories(data)
        guard categories.allSatisfy(Self.categories.contains),
              Set(categories).count == categories.count
        else { throw SharedContentRepositoryFailure.invalidResponse }
        return categories
    }

    private static func valid(
        _ item: SharedContentDataItem,
        conversationId: String
    ) -> Bool {
        guard !item.itemId.isEmpty,
              item.conversationId == conversationId,
              !item.sourceMessageId.isEmpty,
              !item.senderId.isEmpty,
              !item.sourceCreatedAt.isEmpty,
              categories.contains(item.category),
              kinds.contains(item.kind),
              item.durationMs.map({ $0 >= 0 }) ?? true
        else { return false }
        switch (item.category, item.kind) {
        case ("media", "photo"), ("media", "video"):
            return item.attachmentId?.isEmpty == false
        case ("media", "gif"):
            return item.gifProvider?.isEmpty == false &&
                item.gifProviderContentId?.isEmpty == false && !item.canExport
        case ("media", "sticker"):
            return item.stickerId?.isEmpty == false && !item.canExport
        case ("files", "document"), ("voice", "voice"):
            return item.attachmentId?.isEmpty == false
        case ("links", "link"):
            return item.linkUrl?.isEmpty == false && item.linkHostname?.isEmpty == false
        default:
            return false
        }
    }

    private static func isOrderedBefore(
        _ left: SharedContentDataItem,
        _ right: SharedContentDataItem
    ) -> Bool {
        if left.sourceCreatedAt != right.sourceCreatedAt { return left.sourceCreatedAt > right.sourceCreatedAt }
        if left.sourceMessageId != right.sourceMessageId { return left.sourceMessageId > right.sourceMessageId }
        if left.sourceRank != right.sourceRank { return left.sourceRank > right.sourceRank }
        return left.itemId > right.itemId
    }

    private static func storedItem(_ item: SharedContentDataItem) -> StoredSharedContentItem {
        var link: [String: String] = [:]
        if let value = item.linkUrl { link["url"] = value }
        if let value = item.linkHostname { link["hostname"] = value }
        if let value = item.linkTitle { link["title"] = value }
        if let value = item.linkDescription { link["description"] = value }
        if let value = item.linkSiteName { link["site_name"] = value }
        let linkData = link.isEmpty ? nil : try? JSONSerialization.data(withJSONObject: link, options: [.sortedKeys])
        return StoredSharedContentItem(
            itemId: item.itemId,
            conversationId: item.conversationId,
            sourceMessageId: item.sourceMessageId,
            senderId: item.senderId,
            sourceCreatedAt: item.sourceCreatedAt,
            sourceRank: item.sourceRank,
            category: item.category,
            kind: item.kind,
            attachmentId: item.attachmentId,
            attachmentOriginalName: item.attachmentOriginalName,
            attachmentMimeType: item.attachmentMimeType,
            attachmentByteSize: item.attachmentByteSize,
            attachmentWidth: item.attachmentWidth,
            attachmentHeight: item.attachmentHeight,
            durationMs: item.durationMs,
            gifProvider: item.gifProvider,
            gifProviderContentId: item.gifProviderContentId,
            gifTitle: item.gifTitle,
            gifDescription: item.gifDescription,
            stickerId: item.stickerId,
            linkMetadataJson: linkData.flatMap { String(data: $0, encoding: .utf8) }
        )
    }

    private static func encodeCursor(_ cursor: SharedContentDataCursor) -> String? {
        try? String(data: JSONEncoder().encode(cursor), encoding: .utf8)
    }
}

private enum TransportFailure: Error {
    case authentication
    case authorization
    case network
    case remote

    var repositoryFailure: SharedContentRepositoryFailure {
        switch self {
        case .authentication: .authentication
        case .authorization: .authorization
        case .network: .network
        case .remote: .network
        }
    }
}

private struct SharedContentListingRequest: Encodable, Sendable {
    let conversationId: String
    let category: String?
    let cursor: SharedContentDataCursor?

    init(token: SharedContentRequestToken, category: String?) {
        conversationId = token.conversationId
        self.category = category
        cursor = token.requestedCursor
    }

    enum CodingKeys: String, CodingKey {
        case conversationId = "p_conversation_id"
        case category = "p_category"
        case beforeCreatedAt = "p_before_created_at"
        case beforeMessageId = "p_before_message_id"
        case beforeSourceRank = "p_before_source_rank"
        case beforeItemId = "p_before_item_id"
        case limit = "p_limit"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(conversationId, forKey: .conversationId)
        try container.encodeIfPresent(category, forKey: .category)
        if let cursor {
            try container.encode(cursor.sourceCreatedAt, forKey: .beforeCreatedAt)
            try container.encode(cursor.sourceMessageId, forKey: .beforeMessageId)
            try container.encode(cursor.sourceRank, forKey: .beforeSourceRank)
            try container.encode(cursor.itemId, forKey: .beforeItemId)
        }
        try container.encode(40, forKey: .limit)
    }
}

private struct SharedContentCategoryRequest: Encodable, Sendable {
    let conversationId: String
    enum CodingKeys: String, CodingKey { case conversationId = "p_conversation_id" }
}

private struct SharedContentRowWire: Decodable, Sendable {
    let itemId: String
    let conversationId: String
    let sourceMessageId: String
    let senderId: String
    let sourceCreatedAt: String
    let sourceRank: Int
    let category: String
    let kind: String
    let attachmentId: String?
    let attachmentOriginalName: String?
    let attachmentMimeType: String?
    let attachmentByteSize: Int64?
    let attachmentWidth: Int?
    let attachmentHeight: Int?
    let attachmentDisplayPath: String?
    let attachmentThumbnailPath: String?
    let durationMs: Int64?
    let gifProvider: String?
    let gifProviderContentId: String?
    let gifTitle: String?
    let gifDescription: String?
    let stickerId: String?
    let linkUrl: String?
    let linkHostname: String?
    let linkTitle: String?
    let linkDescription: String?
    let linkSiteName: String?
    let canDelete: Bool
    let canExport: Bool

    enum CodingKeys: String, CodingKey {
        case itemId = "item_id", conversationId = "conversation_id"
        case sourceMessageId = "source_message_id", senderId = "sender_id"
        case sourceCreatedAt = "source_created_at", sourceRank = "source_rank"
        case category, kind
        case attachmentId = "attachment_id", attachmentOriginalName = "attachment_original_name"
        case attachmentMimeType = "attachment_mime_type", attachmentByteSize = "attachment_byte_size"
        case attachmentWidth = "attachment_width", attachmentHeight = "attachment_height"
        case attachmentDisplayPath = "attachment_display_path", attachmentThumbnailPath = "attachment_thumbnail_path"
        case durationMs = "duration_ms"
        case gifProvider = "gif_provider", gifProviderContentId = "gif_provider_content_id"
        case gifTitle = "gif_title", gifDescription = "gif_description"
        case stickerId = "sticker_id"
        case linkUrl = "link_url", linkHostname = "link_hostname", linkTitle = "link_title"
        case linkDescription = "link_description", linkSiteName = "link_site_name"
        case canDelete = "can_delete", canExport = "can_export"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        itemId = try values.decode(String.self, forKey: .itemId)
        conversationId = try values.decode(String.self, forKey: .conversationId)
        sourceMessageId = try values.decode(String.self, forKey: .sourceMessageId)
        senderId = try values.decode(String.self, forKey: .senderId)
        sourceCreatedAt = try values.decode(String.self, forKey: .sourceCreatedAt)
        sourceRank = try values.decode(Int.self, forKey: .sourceRank)
        category = try values.decode(String.self, forKey: .category)
        kind = try values.decode(String.self, forKey: .kind)
        attachmentId = try values.decodeIfPresent(String.self, forKey: .attachmentId)
        attachmentOriginalName = try values.decodeIfPresent(String.self, forKey: .attachmentOriginalName)
        attachmentMimeType = try values.decodeIfPresent(String.self, forKey: .attachmentMimeType)
        attachmentByteSize = try values.decodeIfPresent(Int64.self, forKey: .attachmentByteSize)
        attachmentWidth = try values.decodeIfPresent(Int.self, forKey: .attachmentWidth)
        attachmentHeight = try values.decodeIfPresent(Int.self, forKey: .attachmentHeight)
        attachmentDisplayPath = try values.decodeIfPresent(String.self, forKey: .attachmentDisplayPath)
        attachmentThumbnailPath = try values.decodeIfPresent(String.self, forKey: .attachmentThumbnailPath)
        durationMs = try values.decodeIfPresent(Int64.self, forKey: .durationMs)
        gifProvider = try values.decodeIfPresent(String.self, forKey: .gifProvider)
        gifProviderContentId = try values.decodeIfPresent(String.self, forKey: .gifProviderContentId)
        gifTitle = try values.decodeIfPresent(String.self, forKey: .gifTitle)
        gifDescription = try values.decodeIfPresent(String.self, forKey: .gifDescription)
        stickerId = try values.decodeIfPresent(String.self, forKey: .stickerId)
        linkUrl = try values.decodeIfPresent(String.self, forKey: .linkUrl)
        linkHostname = try values.decodeIfPresent(String.self, forKey: .linkHostname)
        linkTitle = try values.decodeIfPresent(String.self, forKey: .linkTitle)
        linkDescription = try values.decodeIfPresent(String.self, forKey: .linkDescription)
        linkSiteName = try values.decodeIfPresent(String.self, forKey: .linkSiteName)
        canDelete = try values.decode(Bool.self, forKey: .canDelete)
        canExport = try values.decode(Bool.self, forKey: .canExport)
    }

    var domain: SharedContentDataItem {
        SharedContentDataItem(
            itemId: itemId,
            conversationId: conversationId,
            sourceMessageId: sourceMessageId,
            senderId: senderId,
            sourceCreatedAt: sourceCreatedAt,
            sourceRank: sourceRank,
            category: category,
            kind: kind,
            attachmentId: attachmentId,
            attachmentOriginalName: attachmentOriginalName,
            attachmentMimeType: attachmentMimeType,
            attachmentByteSize: attachmentByteSize,
            attachmentWidth: attachmentWidth,
            attachmentHeight: attachmentHeight,
            attachmentDisplayPath: attachmentDisplayPath,
            attachmentThumbnailPath: attachmentThumbnailPath,
            durationMs: durationMs,
            gifProvider: gifProvider,
            gifProviderContentId: gifProviderContentId,
            gifTitle: gifTitle,
            gifDescription: gifDescription,
            stickerId: stickerId,
            linkUrl: linkUrl,
            linkHostname: linkHostname,
            linkTitle: linkTitle,
            linkDescription: linkDescription,
            linkSiteName: linkSiteName,
            canDelete: canDelete,
            canExport: canExport
        )
    }
}

private extension SharedContentDataItem {
    init(_ wire: SharedContentRowWire) { self = wire.domain }
}

private enum StrictWireDecoder {
    private static let rowKeys: Set<String> = [
        "item_id", "conversation_id", "source_message_id", "sender_id", "source_created_at", "source_rank",
        "category", "kind", "attachment_id", "attachment_original_name", "attachment_mime_type",
        "attachment_byte_size", "attachment_width", "attachment_height", "attachment_display_path",
        "attachment_thumbnail_path", "duration_ms", "gif_provider", "gif_provider_content_id", "gif_title", "gif_description",
        "sticker_id", "link_url", "link_hostname", "link_title", "link_description", "link_site_name",
        "can_delete", "can_export"
    ]

    static func decodeRows(_ data: Data) throws -> [SharedContentRowWire] {
        let json = try JSONSerialization.jsonObject(with: data)
        guard let array = json as? [Any], array.count <= 41 else {
            throw SharedContentRepositoryFailure.invalidResponse
        }
        for value in array {
            guard let object = value as? [String: Any], Set(object.keys) == rowKeys else {
                throw SharedContentRepositoryFailure.invalidResponse
            }
        }
        return try JSONDecoder().decode([SharedContentRowWire].self, from: data)
    }

    static func decodeCategories(_ data: Data) throws -> [String] {
        let json = try JSONSerialization.jsonObject(with: data)
        guard let array = json as? [Any] else { throw SharedContentRepositoryFailure.invalidResponse }
        for value in array {
            guard let object = value as? [String: Any], Set(object.keys) == ["category"] else {
                throw SharedContentRepositoryFailure.invalidResponse
            }
        }
        struct Category: Decodable { let category: String }
        return try JSONDecoder().decode([Category].self, from: data).map(\.category)
    }
}
