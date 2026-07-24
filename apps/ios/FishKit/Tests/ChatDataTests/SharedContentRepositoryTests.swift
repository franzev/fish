import ChatCore
import ChatData
import Foundation
import Testing

@Suite(.serialized)
struct SharedContentRepositoryTests {
    @Test func exactOwnerHydrationAndAuthorityLossNeverExposeCache() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [storedItem("item-a")]
        )
        let directory = TestConversationDirectory(conversationIds: ["conversation-a"])
        let repository = makeRepository(cache: cache, directory: directory)

        let visible = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(visible?.ownerIdentityId == "owner-a")
        #expect(visible?.items.map(\.itemId) == ["item-a"])

        directory.conversationIds = []
        let hidden = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(hidden == nil)
        #expect(try await cache.verifyOwnerPurged(ownerIdentityId: "owner-a", conversationId: "conversation-a"))
    }

    @Test func pagingRetainsOnlyIndexesZeroThroughThirtyNineAndUsesIndexFortyAsSentinel() async throws {
        let transport = TestURLProtocol.install(response: listingData(rows: 41))
        defer { transport.reset() }
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        let repository = makeRepository(cache: cache)
        let result = await repository.refreshSharedContent(
            token: requestToken(),
            category: nil
        )

        guard case let .success(page) = result else {
            Issue.record("expected an accepted page")
            return
        }
        #expect(transport.lastRequestBody?["p_limit"] as? Int == 40)
        #expect(page.items.map(\.itemId) == (0..<40).map { "item-\($0)" })
        #expect(page.nextCursor?.itemId == "item-39")
        #expect(page.hasMore)
        #expect(page.items.count == 40)

        let snapshot = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(snapshot?.items.count == 40)
        #expect(snapshot?.items.contains(where: { $0.itemId == "item-40" }) == false)
    }

    @Test func rowFortyOneIsRejectedBeforeAnyCacheMutation() async throws {
        let transport = TestURLProtocol.install(response: listingData(rows: 42))
        defer { transport.reset() }
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [storedItem("existing")]
        )
        let repository = makeRepository(cache: cache)

        let result = await repository.refreshSharedContent(token: requestToken(), category: nil)
        #expect(result == .failure(.invalidResponse))
        let snapshot = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(snapshot?.items.map(\.itemId) == ["existing"])
    }

    @Test func strictRowsRejectMixedConversationUnknownKindAndMalformedOrder() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        let repository = makeRepository(cache: cache)

        for response in [
            listingData(rows: 2, conversationId: "conversation-b"),
            listingData(rows: 1, kind: "unknown"),
            listingData(rows: 2, descending: false),
            listingData(rows: 1, omitField: "source_rank"),
        ] {
            let transport = TestURLProtocol.install(response: response)
            let result = await repository.refreshSharedContent(
                token: requestToken(requestId: UUID().uuidString),
                category: nil
            )
            #expect(result == .failure(.invalidResponse))
            transport.reset()
        }
        let snapshot = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(snapshot == nil)
    }

    @Test func staleOwnerGenerationRequestCursorAndReplaceResultsCannotMutateCache() async throws {
        let transport = TestURLProtocol.install(response: listingData(rows: 1))
        defer { transport.reset() }
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [storedItem("accepted")]
        )
        let repository = makeRepository(cache: cache)

        let current = requestToken(requestId: "current", generation: 7)
        let stale = requestToken(requestId: "stale", generation: 6)
        let first = await repository.refreshSharedContent(token: current, category: nil)
        #expect(first.isSuccess)
        let second = await repository.refreshSharedContent(token: stale, category: nil)
        #expect(second == .failure(.requestSuperseded))
        let snapshot = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(snapshot?.items.map(\.itemId) == ["item-0"])
    }

    @Test func identityRevocationRejectsOlderRequestsBeforeNetworkOrCacheMutation() async throws {
        let transport = TestURLProtocol.install(response: listingData(rows: 1))
        defer { transport.reset() }
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        let repository = makeRepository(cache: cache)

        await repository.revokeIdentityGeneration(2)
        let result = await repository.refreshSharedContent(
            token: requestToken(generation: 1),
            category: nil
        )

        #expect(result == .failure(.requestSuperseded))
        #expect(
            try await cache.verifyOwnerPurged(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a"
            )
        )
    }

    @Test func acceptedReplaceAndRepeatAreDuplicateFreeAndFailureRetainsVerifiedCache() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [storedItem("existing")]
        )
        let repository = makeRepository(cache: cache)
        let transport = TestURLProtocol.install(response: listingData(rows: 1))
        defer { transport.reset() }

        let token = requestToken(requestId: "repeat")
        #expect((await repository.refreshSharedContent(token: token, category: nil)).isSuccess)
        #expect((await repository.refreshSharedContent(token: token, category: nil)).isSuccess)
        let accepted = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(accepted?.items.map(\.itemId) == ["item-0"])

        transport.setFailure()
        #expect((await repository.refreshSharedContent(token: requestToken(), category: nil)).isFailure)
        let retained = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(retained?.items.map(\.itemId) == ["item-0"])
    }

    @Test func satisfiedConstrainedPathsRemainUsableAndSuppressLookaheadOnly() {
        let policy = SharedContentNetworkPolicy(
            usable: true,
            constrained: true,
            expensive: false
        )
        #expect(policy.usable)
        #expect(policy.constrained)
        #expect(!policy.lookaheadAllowed)
        #expect(policy.sharedContentPolicy.networkUsable)
        #expect(!policy.sharedContentPolicy.lookaheadAllowed)

        let expensive = SharedContentNetworkPolicy(
            usable: true,
            constrained: false,
            expensive: true
        )
        #expect(expensive.lookaheadAllowed)
    }

    @Test func publicRepositoryContractsDoNotExposeProviderOrPersistenceTypes() {
        let mirror = String(reflecting: SharedContentDataPage.self)
        #expect(!mirror.contains("Supabase"))
        #expect(!mirror.contains("NSManagedObject"))
        #expect(SharedContentRepositoryFailure.network.description == "network")
    }

    @Test func phase13StrictRowsRequireTwentyNineFieldsAndNullableNonNegativeDuration() {
        let decoder = Phase13DurationRowContract()
        let valid = phase13ListingRow(durationMs: 61_000)
        let legacy = phase13ListingRow(durationMs: nil)

        #expect(valid.count == 29)
        #expect(decoder.decode(valid)?.durationMs == 61_000)
        #expect(decoder.decode(legacy)?.durationMs == nil)

        var missing = valid
        missing.removeValue(forKey: "duration_ms")
        #expect(decoder.decode(missing) == nil)

        var extra = valid
        extra["delivery_url"] = "https://private.invalid/token"
        #expect(decoder.decode(extra) == nil)
        #expect(decoder.decode(phase13ListingRow(durationMs: -1)) == nil)
    }

    @Test func phase13DurationAcceptanceRequiresExactOwnerConversationRequestAndCursor() {
        let decoder = Phase13DurationRowContract()
        let token = Phase13DurationAcceptanceToken(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            requestId: "request-a",
            cursor: "cursor-a"
        )
        let row = phase13ListingRow(durationMs: 1_000)

        #expect(decoder.accept(
            row,
            verifiedOwnerIdentityId: "owner-a",
            token: token,
            completedRequestId: "request-a",
            completedCursor: "cursor-a"
        ))
        #expect(!decoder.accept(
            row,
            verifiedOwnerIdentityId: "owner-b",
            token: token,
            completedRequestId: "request-a",
            completedCursor: "cursor-a"
        ))
        #expect(!decoder.accept(
            row,
            verifiedOwnerIdentityId: "owner-a",
            token: token,
            completedRequestId: "stale-request",
            completedCursor: "cursor-a"
        ))
        #expect(!decoder.accept(
            row,
            verifiedOwnerIdentityId: "owner-a",
            token: token,
            completedRequestId: "request-a",
            completedCursor: "wrong-cursor"
        ))
    }

    @Test func durationRepositoryProductionContractAcceptsNullableAndRejectsNegativeBeforeCacheMutation() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        let repository = makeRepository(cache: cache)

        var transport = TestURLProtocol.install(response: listingData(rows: 1, durationMs: 61_000))
        var result = await repository.refreshSharedContent(
            token: requestToken(requestId: "trusted-duration"),
            category: nil
        )
        guard case let .success(page) = result else {
            Issue.record("expected trusted duration page")
            return
        }
        #expect(page.items.first?.durationMs == 61_000)
        transport.reset()

        transport = TestURLProtocol.install(response: listingData(rows: 1, durationMs: nil))
        result = await repository.refreshSharedContent(
            token: requestToken(requestId: "legacy-duration"),
            category: nil
        )
        guard case let .success(legacyPage) = result else {
            Issue.record("expected legacy nullable duration page")
            return
        }
        #expect(legacyPage.items.first?.durationMs == nil)
        transport.reset()

        transport = TestURLProtocol.install(response: listingData(rows: 1, durationMs: -1))
        result = await repository.refreshSharedContent(
            token: requestToken(requestId: "negative-duration"),
            category: nil
        )
        #expect(result == .failure(.invalidResponse))
        let snapshot = await firstSnapshot(
            from: repository.observeSharedContentSnapshot(conversationId: "conversation-a")
        )
        #expect(snapshot?.items.map(\.itemId) == ["item-0"])
        transport.reset()
    }
}

private func makeRepository(
    cache: any SharedContentCaching = try! CoreDataSharedContentCache(configuration: .inMemory()),
    directory: TestConversationDirectory = TestConversationDirectory(conversationIds: ["conversation-a"])
) -> SupabaseSharedContentRepository {
    let configuration = ChatBackendConfiguration(
        supabaseUrl: URL(string: "https://example.invalid")!,
        anonKey: "anon",
        accessToken: { "access" }
    )
    return SupabaseSharedContentRepository(
        configuration: configuration,
        cache: cache,
        directory: directory,
        verifiedOwner: { "owner-a" },
        session: TestURLProtocol.session
    )
}

private func requestToken(
    requestId: String = "request-a",
    generation: Int = 1,
    cursor: SharedContentDataCursor? = nil,
    replace: Bool = true
) -> SharedContentRequestToken {
    SharedContentRequestToken(
        ownerIdentityId: "owner-a",
        conversationId: "conversation-a",
        identityGeneration: generation,
        cycleId: "cycle-a",
        requestId: requestId,
        requestedCursor: cursor,
        replace: replace
    )
}

private func storedItem(_ itemId: String) -> StoredSharedContentItem {
    StoredSharedContentItem(
        itemId: itemId,
        conversationId: "conversation-a",
        sourceMessageId: "message-\(itemId)",
        senderId: "sender-a",
        sourceCreatedAt: "2026-01-01T00:00:00Z",
        sourceRank: 100,
        category: "media",
        kind: "photo",
        attachmentId: "attachment-\(itemId)",
        attachmentOriginalName: "image.webp",
        attachmentMimeType: "image/webp",
        attachmentByteSize: 1,
        attachmentWidth: 1,
        attachmentHeight: 1
    )
}

private func listingData(
    rows count: Int,
    conversationId: String = "conversation-a",
    kind: String = "photo",
    descending: Bool = true,
    durationMs: Int64? = nil,
    omitField: String? = nil
) -> Data {
    let rows: [[String: Any]] = (0..<count).map { index in
        let order = descending ? index : count - index
        var row: [String: Any] = [
            "item_id": "item-\(index)",
            "conversation_id": conversationId,
            "source_message_id": "message-\(index)",
            "sender_id": "sender-a",
            "source_created_at": "2026-01-01T00:00:\(String(format: "%02d", 59 - order))Z",
            "source_rank": 100 - index,
            "category": "media",
            "kind": kind,
            "attachment_id": "attachment-\(index)",
            "attachment_original_name": "image.webp",
            "attachment_mime_type": "image/webp",
            "attachment_byte_size": 1,
            "attachment_width": 1,
            "attachment_height": 1,
            "attachment_display_path": "display/\(index)",
            "attachment_thumbnail_path": "thumbnail/\(index)",
            "duration_ms": durationMs ?? NSNull(),
            "gif_provider": NSNull(),
            "gif_provider_content_id": NSNull(),
            "gif_title": NSNull(),
            "gif_description": NSNull(),
            "sticker_id": NSNull(),
            "link_url": NSNull(),
            "link_hostname": NSNull(),
            "link_title": NSNull(),
            "link_description": NSNull(),
            "link_site_name": NSNull(),
            "can_delete": false,
            "can_export": true,
        ]
        if kind == "unknown" { row["attachment_id"] = NSNull() }
        if let omitField { row.removeValue(forKey: omitField) }
        return row
    }
    return try! JSONSerialization.data(withJSONObject: rows)
}

private final class TestConversationDirectory: ConversationDirectoryProviding, @unchecked Sendable {
    var conversationIds: [String]
    private let lock = NSLock()

    init(conversationIds: [String]) { self.conversationIds = conversationIds }

    func conversations() async throws -> [ChatConversationPreview] {
        lock.withLock {
            conversationIds.map { id in
                ChatConversationPreview(
                    conversationId: id,
                    participantId: "participant-a",
                    participantRole: "coach",
                    participantDisplayName: "Coach",
                    latestMessageSenderId: nil,
                    latestMessageText: "",
                    latestMessageCreatedAt: nil,
                    unreadCount: 0
                )
            }
        }
    }

    func navigationAttention() async throws -> [ChatNavigationAttention] { [] }
    func attentionEvents(conversationIds: [String]) -> AsyncStream<String> {
        AsyncStream { $0.finish() }
    }
}

private func firstValue<T>(from stream: AsyncStream<T>) async -> T? {
    for await value in stream { return value }
    return nil
}

private func firstSnapshot(
    from stream: AsyncStream<StoredSharedContentSnapshot?>
) async -> StoredSharedContentSnapshot? {
    for await value in stream { return value }
    return nil
}

private extension SharedContentRepositoryResult {
    var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }

    var isFailure: Bool { !isSuccess }
}

private struct Phase13DurationAcceptanceToken {
    let ownerIdentityId: String
    let conversationId: String
    let requestId: String
    let cursor: String?
}

private struct Phase13DurationProjection: Equatable {
    let durationMs: Int64?
}

private struct Phase13DurationRowContract {
    private let requiredFields: Set<String> = [
        "item_id",
        "conversation_id",
        "source_message_id",
        "sender_id",
        "source_created_at",
        "source_rank",
        "category",
        "kind",
        "attachment_id",
        "attachment_original_name",
        "attachment_mime_type",
        "attachment_byte_size",
        "attachment_width",
        "attachment_height",
        "attachment_display_path",
        "attachment_thumbnail_path",
        "gif_provider",
        "gif_provider_content_id",
        "gif_title",
        "gif_description",
        "sticker_id",
        "link_url",
        "link_hostname",
        "link_title",
        "link_description",
        "link_site_name",
        "duration_ms",
        "can_delete",
        "can_export",
    ]

    func decode(_ row: [String: Any]) -> Phase13DurationProjection? {
        guard Set(row.keys) == requiredFields else { return nil }
        if row["duration_ms"] is NSNull {
            return .init(durationMs: nil)
        }
        guard let duration = row["duration_ms"] as? Int, duration >= 0 else { return nil }
        return .init(durationMs: Int64(duration))
    }

    func accept(
        _ row: [String: Any],
        verifiedOwnerIdentityId: String,
        token: Phase13DurationAcceptanceToken,
        completedRequestId: String,
        completedCursor: String?
    ) -> Bool {
        guard decode(row) != nil else { return false }
        return verifiedOwnerIdentityId == token.ownerIdentityId
            && row["conversation_id"] as? String == token.conversationId
            && completedRequestId == token.requestId
            && completedCursor == token.cursor
    }
}

private func phase13ListingRow(durationMs: Int?) -> [String: Any] {
    [
        "item_id": "item-a",
        "conversation_id": "conversation-a",
        "source_message_id": "message-a",
        "sender_id": "sender-a",
        "source_created_at": "2026-07-24T00:00:00Z",
        "source_rank": 1,
        "category": "voice",
        "kind": "voice",
        "attachment_id": "attachment-a",
        "attachment_original_name": "voice.m4a",
        "attachment_mime_type": "audio/mp4",
        "attachment_byte_size": 1_024,
        "attachment_width": NSNull(),
        "attachment_height": NSNull(),
        "attachment_display_path": "display/a",
        "attachment_thumbnail_path": NSNull(),
        "gif_provider": NSNull(),
        "gif_provider_content_id": NSNull(),
        "gif_title": NSNull(),
        "gif_description": NSNull(),
        "sticker_id": NSNull(),
        "link_url": NSNull(),
        "link_hostname": NSNull(),
        "link_title": NSNull(),
        "link_description": NSNull(),
        "link_site_name": NSNull(),
        "duration_ms": durationMs ?? NSNull(),
        "can_delete": false,
        "can_export": false,
    ]
}

private final class TestURLProtocol: URLProtocol, @unchecked Sendable {
    static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [TestURLProtocol.self]
        return URLSession(configuration: configuration)
    }()

    private static let lock = NSLock()
    nonisolated(unsafe) private static var responseData = Data()
    nonisolated(unsafe) private static var failing = false
    nonisolated(unsafe) private static var body: [String: Any]?

    static var lastRequestBody: [String: Any]? { lock.withLock { body } }

    @discardableResult
    static func install(response: Data) -> TestURLProtocol.Type {
        lock.withLock {
            responseData = response
            failing = false
            body = nil
        }
        return self
    }

    static func setFailure() { lock.withLock { failing = true } }
    static func reset() { lock.withLock { responseData = Data(); failing = false; body = nil } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let state = Self.lock.withLock { (Self.responseData, Self.failing) }
        let bodyData = request.httpBody ?? request.httpBodyStream.flatMap(Self.read)
        if let data = bodyData,
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            Self.lock.withLock { Self.body = object }
        }
        if state.1 {
            client?.urlProtocol(self, didFailWithError: URLError(.networkConnectionLost))
            return
        }
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: state.0)
        client?.urlProtocolDidFinishLoading(self)
    }

    private static func read(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(contentsOf: buffer[0..<count])
        }
        return data
    }

    override func stopLoading() {}
}
