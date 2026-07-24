import ChatCore
import ChatData
import Foundation
import PersonalChat
import Testing

@Suite(.serialized)
@MainActor
struct SharedContentGalleryModelTests {
    @Test func viewportReportsOnlyIntersectingItemsAndOneScreenOfLookahead() {
        let report = sharedContentViewportReport(
            orderedItemIDs: ["above", "visible-a", "visible-b", "lookahead", "far"],
            frames: [
                "above": CGRect(x: 0, y: -100, width: 100, height: 40),
                "visible-a": CGRect(x: 0, y: -10, width: 100, height: 40),
                "visible-b": CGRect(x: 0, y: 80, width: 100, height: 40),
                "lookahead": CGRect(x: 0, y: 120, width: 100, height: 40),
                "far": CGRect(x: 0, y: 240, width: 100, height: 40),
            ],
            viewportHeight: 100
        )

        #expect(report.visibleItemIDs == ["visible-a", "visible-b"])
        #expect(report.lookaheadItemIDs == ["lookahead"])
    }

    @Test func canonicalCategoriesArePopulatedOnlyAndOneOptionHidesTheControl() {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        model.acceptNewest([
            item("voice", category: .voice),
            item("file", category: .files),
            item("media", category: .media),
            item("link", category: .links),
        ])

        #expect(model.categories == [.media, .files, .links, .voice])
        #expect(model.selectedCategory == .media)
        #expect(model.categoryControlVisible)

        model.acceptNewest([item("only-file", category: .files)])
        #expect(model.categories == [.files])
        #expect(model.selectedCategory == .files)
        #expect(!model.categoryControlVisible)
    }

    @Test func selectionIsFirstRetainedOrFallbackAndAnchorsRemainPerCategory() {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([
            item("media", category: .media),
            item("file", category: .files),
            item("link", category: .links),
        ])
        #expect(model.selectedCategory == .media)

        model.select(.links)
        model.remember(anchor: .init(itemId: "link", focusId: "link-focus"), for: .links)
        model.select(.files)
        model.remember(anchor: .init(itemId: "file", focusId: "file-focus"), for: .files)
        model.acceptRealtime(item("file-2", category: .files))

        #expect(model.selectedCategory == .files)
        #expect(model.anchor(for: .links) == .init(itemId: "link", focusId: "link-focus"))
        #expect(model.anchor(for: .files) == .init(itemId: "file", focusId: "file-focus"))

        model.remove(itemId: "file")
        model.remove(itemId: "file-2")
        #expect(model.selectedCategory == .media)
    }

    @Test func acceptedRealtimeAddsCategoryWithoutChangingSelection() {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([item("file", category: .files)])

        #expect(model.acceptRealtime(item("voice", category: .voice)))
        #expect(model.categories == [.files, .voice])
        #expect(model.selectedCategory == .files)
        #expect(!model.acceptRealtime(item("wrong-owner", owner: "owner-b", category: .media)))
        #expect(model.categories == [.files, .voice])
    }

    @Test func globalEarlierStateSuppressesDuplicatesAndAcceptsPagesWithoutSelectedCategory() {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([item("media", category: .media)], retainedCursor: "cursor-1")
        model.select(.media)

        let request = try! #require(model.beginEarlier(requestId: "earlier-1"))
        #expect(model.earlierState == .busy)
        #expect(model.beginEarlier(requestId: "duplicate") == nil)

        #expect(model.acceptEarlier(
            request,
            items: [item("file", category: .files), item("file", category: .files)],
            nextCursor: "cursor-2"
        ))
        #expect(model.selectedCategory == .media)
        #expect(model.items.map(\.itemId) == ["media", "file"])
        #expect(model.categories == [.media, .files])
        #expect(model.earlierState == .ready)

        let failed = try! #require(model.beginEarlier(requestId: "earlier-2"))
        model.failEarlier(failed)
        #expect(model.items.map(\.itemId) == ["media", "file"])
        #expect(model.earlierState == .failed)
    }

    @Test func categorySwitchNeverStartsRecovery() {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([
            item("media", category: .media),
            item("file", category: .files),
        ])
        model.open()

        model.select(.files)
        model.select(.media)

        #expect(model.recoveryOpenCount == 1)
        #expect(model.selectedCategory == .media)
    }

    @Test func identityChangeDuringRefreshAndEarlierWorkRejectsEveryOldOwnerCompletion() {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([item("owner-a-item", category: .media)])
        let refresh = model.beginRefresh(requestId: "refresh-a")
        model.acceptNewest([item("owner-a-item", category: .media)], retainedCursor: "cursor-a")
        let earlier = try! #require(model.beginEarlier(requestId: "earlier-a"))

        model.bind(ownerIdentityId: "owner-b", conversationId: "conversation-b")

        #expect(!model.acceptRefresh(
            refresh,
            items: [item("stale-refresh", category: .files)],
            retainedCursor: nil
        ))
        #expect(!model.acceptEarlier(
            earlier,
            items: [item("stale-earlier", category: .links)],
            nextCursor: nil
        ))
        #expect(model.items.isEmpty)
        #expect(model.categories.isEmpty)

        model.acceptNewest([
            item(
                "owner-b-item",
                owner: "owner-b",
                conversation: "conversation-b",
                generation: 2,
                category: .voice
            ),
        ])
        #expect(model.items.map(\.itemId) == ["owner-b-item"])
    }

    @Test func popSignOutAndOwnerSwitchRevokeSessionAndExposeOnlySafeProjection() throws {
        let model = GalleryModelContract()
        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([item("safe-item", category: .links)])
        model.remember(anchor: .init(itemId: "safe-item", focusId: "safe-focus"), for: .links)

        let encoded = try JSONEncoder().encode(model.displayItems)
        let json = String(decoding: encoded, as: UTF8.self)
        #expect(json.contains("safe-item"))
        #expect(!json.contains("owner-a"))
        #expect(!json.contains("https://"))
        #expect(!json.contains("token"))
        #expect(!json.contains("path"))

        model.close()
        #expect(model.items.isEmpty)
        #expect(model.selectedCategory == nil)
        #expect(model.anchor(for: .links) == nil)

        model.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        model.acceptNewest([item("signed-in", category: .media)])
        model.revokeIdentityGeneration()
        #expect(model.items.isEmpty)
        #expect(model.boundOwnerIdentityId == nil)
    }

    @Test func productionModelProjectsSafeLocalizedRowsAndClearsItsSession() async throws {
        let provider = GalleryProductionProvider(
            snapshot: productionSnapshot()
        )
        let store = SharedContentStore(provider: provider)
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        let model = SharedContentGalleryModel(
            store: store,
            locale: Locale(identifier: "en_US")
        )

        #expect(model.categories == [.media, .files, .links, .voice])
        #expect(model.selectedCategory == .media)
        #expect(model.showCategoryControl)
        #expect(!model.itemSelectionEnabled)

        model.selectCategory(.files)
        let file = try #require(model.items.first)
        guard case .file(let fileItem) = file else {
            Issue.record("Expected a safe file projection")
            return
        }
        #expect(fileItem.filename == "guide.pdf")
        #expect(fileItem.friendlyType == "PDF")
        #expect(fileItem.sizeLabel?.isEmpty == false)
        #expect(!fileItem.accessibilityLabel.contains("application/pdf"))

        model.selectCategory(.links)
        let link = try #require(model.items.first)
        guard case .link(let linkItem) = link else {
            Issue.record("Expected a safe link projection")
            return
        }
        #expect(linkItem.title == "A safe title")
        #expect(linkItem.hostname == "example.test")
        #expect(!linkItem.accessibilityLabel.contains("https://"))

        model.selectCategory(.voice)
        #expect(model.items.count == 2)
        guard case .voice(let knownDuration) = model.items[0],
              case .voice(let legacyDuration) = model.items[1]
        else {
            Issue.record("Expected safe voice projections")
            return
        }
        #expect(knownDuration.durationLabel == "1:02:03")
        #expect(legacyDuration.durationLabel == "Duration unavailable")

        model.remember(
            anchor: .init(
                itemId: "voice-known",
                scrollOffset: 18,
                focusedItemId: "voice-known"
            ),
            for: .voice
        )
        #expect(model.anchor(for: .voice)?.itemId == "voice-known")
        #expect(model.anchor(for: .voice)?.scrollOffset == 18)
        #expect(model.anchor(for: .voice)?.focusedItemId == "voice-known")
        #expect(!model.selectItem("voice-known"))

        let recoveryCount = store.recoveryCycleCount
        model.selectCategory(.media)
        model.selectCategory(.voice)
        #expect(store.recoveryCycleCount == recoveryCount)

        model.close()
        #expect(model.categories.isEmpty)
        #expect(model.selectedCategory == nil)
        #expect(model.anchor(for: .voice) == nil)
        #expect(store.acceptedItems.isEmpty)
    }

    @Test func productionModelLoadsMediaThroughOpaqueHandleAndProviderNeutralRequest() async throws {
        let recorder = ThumbnailRequestRecorder()
        let provider = GalleryProductionProvider(snapshot: productionSnapshot())
        let store = SharedContentStore(provider: provider)
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        let model = SharedContentGalleryModel(
            store: store,
            thumbnailLoader: { request, intent in
                await recorder.record(request: request, intent: intent)
                return Data([1, 2, 3])
            }
        )

        guard case .media(let media) = try #require(model.items.first) else {
            Issue.record("Expected a media projection")
            return
        }
        #expect(media.thumbnailHandle.itemId == "media")
        #expect(media.thumbnailHandle.contentVersion == "2026-07-23T00:00:00.000Z")
        #expect(
            await model.thumbnailData(for: media.thumbnailHandle)
                == Data([1, 2, 3])
        )

        let recorded = await recorder.recorded
        #expect(recorded?.request.ownerIdentityId == "owner-a")
        #expect(recorded?.request.conversationId == "conversation-a")
        #expect(recorded?.request.itemId == "media")
        #expect(recorded?.request.attachmentId == "attachment-media")
        #expect(recorded?.request.sourceMessageId == "message-media")
        #expect(recorded?.request.kind == "photo")
        #expect(recorded?.intent == .visibleThumbnail)
    }
}

private actor ThumbnailRequestRecorder {
    private(set) var recorded:
        (request: SharedContentMediaThumbnailRequest, intent: SharedContentFetchIntent)?

    func record(
        request: SharedContentMediaThumbnailRequest,
        intent: SharedContentFetchIntent
    ) {
        recorded = (request, intent)
    }
}

private final class GalleryProductionProvider: SharedContentProviding, @unchecked Sendable {
    private let snapshot: StoredSharedContentSnapshot

    init(snapshot: StoredSharedContentSnapshot) {
        self.snapshot = snapshot
    }

    func observeSharedContentSnapshot(
        conversationId: String
    ) -> AsyncStream<StoredSharedContentSnapshot?> {
        AsyncStream { continuation in
            continuation.yield(snapshot.conversationId == conversationId ? snapshot : nil)
            continuation.finish()
        }
    }

    func refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?
    ) async -> SharedContentRepositoryResult<SharedContentDataPage> {
        _ = (token, category)
        return .success(.init(items: [], hasMore: false, nextCursor: nil))
    }

    func refreshSharedContentCategories(
        token: SharedContentRequestToken
    ) async -> SharedContentRepositoryResult<[String]> {
        _ = token
        return .success([])
    }
}

private func productionSnapshot() -> StoredSharedContentSnapshot {
    func stored(
        _ itemId: String,
        rank: Int,
        category: String,
        kind: String,
        filename: String? = nil,
        mimeType: String? = nil,
        byteSize: Int64? = nil,
        durationMs: Int64? = nil,
        linkMetadataJson: String? = nil
    ) -> StoredSharedContentItem {
        StoredSharedContentItem(
            itemId: itemId,
            conversationId: "conversation-a",
            sourceMessageId: "message-\(itemId)",
            senderId: "sender-a",
            sourceCreatedAt: "2026-07-23T00:00:00.000Z",
            sourceRank: rank,
            category: category,
            kind: kind,
            attachmentId: ["photo", "document", "voice"].contains(kind)
                ? "attachment-\(itemId)"
                : nil,
            attachmentOriginalName: filename,
            attachmentMimeType: mimeType,
            attachmentByteSize: byteSize,
            durationMs: durationMs,
            linkMetadataJson: linkMetadataJson
        )
    }

    return StoredSharedContentSnapshot(
        schemaVersion: 1,
        ownerIdentityId: "owner-a",
        conversationId: "conversation-a",
        items: [
            stored("media", rank: 0, category: "media", kind: "photo"),
            stored(
                "file",
                rank: 1,
                category: "files",
                kind: "document",
                filename: "guide.pdf",
                mimeType: "application/pdf",
                byteSize: 2_048
            ),
            stored(
                "link",
                rank: 2,
                category: "links",
                kind: "link",
                linkMetadataJson:
                    #"{"hostname":"example.test","title":"A safe title","url":"https://example.test/private"}"#
            ),
            stored(
                "voice-known",
                rank: 3,
                category: "voice",
                kind: "voice",
                durationMs: 3_723_000
            ),
            stored(
                "voice-legacy",
                rank: 4,
                category: "voice",
                kind: "voice"
            ),
        ],
        source: .verifiedDeviceCache,
        stale: false,
        retainedHistoryComplete: true,
        authoritativeEmptyConfirmed: false,
        retainedOldestCursor: nil,
        newestWindowProtected: true
    )
}

private enum GalleryCategory: String, Codable, CaseIterable {
    case media
    case files
    case links
    case voice
}

private struct GalleryAcceptedItem: Equatable {
    let itemId: String
    let ownerIdentityId: String
    let conversationId: String
    let identityGeneration: Int
    let category: GalleryCategory
}

private struct GalleryDisplayItem: Codable, Equatable {
    let itemId: String
    let category: GalleryCategory
}

private struct GalleryAnchor: Equatable {
    let itemId: String
    let focusId: String
}

private struct GalleryRequest: Equatable {
    let ownerIdentityId: String
    let conversationId: String
    let identityGeneration: Int
    let requestId: String
    let cursor: String?
}

private enum GalleryEarlierState: Equatable {
    case hidden
    case ready
    case busy
    case failed
}

@MainActor
private final class GalleryModelContract {
    private(set) var boundOwnerIdentityId: String?
    private(set) var boundConversationId: String?
    private(set) var identityGeneration = 0
    private(set) var items: [GalleryAcceptedItem] = []
    private(set) var selectedCategory: GalleryCategory?
    private(set) var retainedCursor: String?
    private(set) var earlierState: GalleryEarlierState = .hidden
    private(set) var recoveryOpenCount = 0

    private var anchors: [GalleryCategory: GalleryAnchor] = [:]
    private var pendingEarlier: GalleryRequest?

    var categories: [GalleryCategory] {
        GalleryCategory.allCases.filter { category in
            items.contains { $0.category == category }
        }
    }

    var categoryControlVisible: Bool { categories.count > 1 }

    var displayItems: [GalleryDisplayItem] {
        items.map { .init(itemId: $0.itemId, category: $0.category) }
    }

    func bind(ownerIdentityId: String?, conversationId: String?) {
        identityGeneration += 1
        boundOwnerIdentityId = ownerIdentityId
        boundConversationId = conversationId
        clearSession()
    }

    func open() {
        guard boundOwnerIdentityId != nil, boundConversationId != nil else { return }
        recoveryOpenCount += 1
    }

    func close() {
        clearSession()
    }

    func revokeIdentityGeneration() {
        identityGeneration += 1
        boundOwnerIdentityId = nil
        boundConversationId = nil
        clearSession()
    }

    func acceptNewest(_ incoming: [GalleryAcceptedItem], retainedCursor: String? = nil) {
        items = accepted(incoming).uniqueByItemId()
        self.retainedCursor = retainedCursor
        pendingEarlier = nil
        earlierState = retainedCursor == nil ? .hidden : .ready
        reconcileSelection()
    }

    @discardableResult
    func acceptRealtime(_ incoming: GalleryAcceptedItem) -> Bool {
        guard accepted([incoming]).count == 1 else { return false }
        items = (items + [incoming]).uniqueByItemId()
        reconcileSelection()
        return true
    }

    func remove(itemId: String) {
        items.removeAll { $0.itemId == itemId }
        reconcileSelection()
    }

    func select(_ category: GalleryCategory) {
        guard categories.contains(category) else { return }
        selectedCategory = category
    }

    func remember(anchor: GalleryAnchor, for category: GalleryCategory) {
        anchors[category] = anchor
    }

    func anchor(for category: GalleryCategory) -> GalleryAnchor? {
        anchors[category]
    }

    func beginRefresh(requestId: String) -> GalleryRequest {
        currentRequest(requestId: requestId, cursor: nil)
    }

    func acceptRefresh(
        _ request: GalleryRequest,
        items: [GalleryAcceptedItem],
        retainedCursor: String?
    ) -> Bool {
        guard isCurrent(request) else { return false }
        acceptNewest(items, retainedCursor: retainedCursor)
        return true
    }

    func beginEarlier(requestId: String) -> GalleryRequest? {
        guard earlierState == .ready || earlierState == .failed else { return nil }
        let request = currentRequest(requestId: requestId, cursor: retainedCursor)
        pendingEarlier = request
        earlierState = .busy
        return request
    }

    func acceptEarlier(
        _ request: GalleryRequest,
        items incoming: [GalleryAcceptedItem],
        nextCursor: String?
    ) -> Bool {
        guard pendingEarlier == request, isCurrent(request) else { return false }
        items = (items + accepted(incoming)).uniqueByItemId()
        retainedCursor = nextCursor
        pendingEarlier = nil
        earlierState = nextCursor == nil ? .hidden : .ready
        reconcileSelection()
        return true
    }

    func failEarlier(_ request: GalleryRequest) {
        guard pendingEarlier == request, isCurrent(request) else { return }
        pendingEarlier = nil
        earlierState = .failed
    }

    private func currentRequest(requestId: String, cursor: String?) -> GalleryRequest {
        GalleryRequest(
            ownerIdentityId: boundOwnerIdentityId ?? "",
            conversationId: boundConversationId ?? "",
            identityGeneration: identityGeneration,
            requestId: requestId,
            cursor: cursor
        )
    }

    private func isCurrent(_ request: GalleryRequest) -> Bool {
        request.ownerIdentityId == boundOwnerIdentityId
            && request.conversationId == boundConversationId
            && request.identityGeneration == identityGeneration
    }

    private func accepted(_ incoming: [GalleryAcceptedItem]) -> [GalleryAcceptedItem] {
        incoming.filter {
            $0.ownerIdentityId == boundOwnerIdentityId
                && $0.conversationId == boundConversationId
                && $0.identityGeneration == identityGeneration
        }
    }

    private func reconcileSelection() {
        let populated = categories
        if let selectedCategory, populated.contains(selectedCategory) { return }
        selectedCategory = populated.first
    }

    private func clearSession() {
        items = []
        selectedCategory = nil
        retainedCursor = nil
        earlierState = .hidden
        anchors = [:]
        pendingEarlier = nil
    }
}

private func item(
    _ itemId: String,
    owner: String = "owner-a",
    conversation: String = "conversation-a",
    generation: Int = 1,
    category: GalleryCategory
) -> GalleryAcceptedItem {
    GalleryAcceptedItem(
        itemId: itemId,
        ownerIdentityId: owner,
        conversationId: conversation,
        identityGeneration: generation,
        category: category
    )
}

private extension Array where Element == GalleryAcceptedItem {
    func uniqueByItemId() -> [GalleryAcceptedItem] {
        var seen = Set<String>()
        return filter { seen.insert($0.itemId).inserted }
    }
}
