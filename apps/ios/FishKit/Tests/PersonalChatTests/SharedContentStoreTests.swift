import ChatCore
import ChatData
import Foundation
import PersonalChat
import Testing

@Suite(.serialized)
@MainActor
struct SharedContentStoreTests {
    @Test func triggersCoalesceAndMeaningfulForegroundStartsARecoveryCycle() async {
        let harness = StoreHarness()
        let store = harness.store()

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        store.open()
        store.foreground()
        store.reconnect()
        store.realtime()
        await harness.releaseNextSleep()
        await harness.waitForProviderCallCount(1)

        #expect(harness.provider.refreshCount == 1)
        #expect(store.recoveryCycleCount == 1)
    }

    @Test func foregroundRefreshRequiresFiveMinutes() async {
        let harness = StoreHarness()
        let store = harness.store()

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        store.didEnterBackground()
        harness.clock.advance(by: .seconds(299))
        store.foreground()
        #expect(harness.sleeper.pendingCount == 0)

        harness.clock.advance(by: .seconds(1))
        store.foreground()
        await harness.waitForPendingSleep()
        #expect(harness.sleeper.pendingCount == 1)
    }

    @Test func failureRetriesOnceWithInjectedJitterThenEnablesManualRetry() async {
        let harness = StoreHarness(refreshResults: [.failure(.network), .failure(.network)])
        let store = harness.store()

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        store.open()
        await harness.releaseNextSleep()
        await harness.waitForProviderCallCount(1)
        #expect(harness.sleeper.lastDuration == .milliseconds(1_123))

        await harness.releaseNextSleep()
        await harness.waitForProviderCallCount(2)
        #expect(store.presentation.manualRetry == .enabled)
        #expect(harness.provider.refreshCount == 2)
    }

    @Test func unavailableConnectivityCancelsRetryWithoutLosingCachedContent() async {
        let snapshot = StoreHarness.snapshot(items: ["cached-item"], complete: false)
        let harness = StoreHarness(snapshot: snapshot, refreshResults: [.failure(.network)])
        let store = harness.store()

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        store.open()
        await harness.releaseNextSleep()
        await harness.waitForProviderCallCount(1)
        store.connectivityChanged(.init(usable: false, constrained: false, expensive: false))

        #expect(store.cachedItemKeys == ["cached-item"])
        #expect(store.presentation.notice == .offlineCached)
        #expect(store.presentation.manualRetry == .hidden)
        await harness.releaseNextSleep()
        await Task.yield()
        #expect(harness.provider.refreshCount == 1)
    }

    @Test func cachedAndAuthoritativeTruthRemainDistinct() async {
        let snapshot = StoreHarness.snapshot(items: ["cached-item"], complete: false)
        let harness = StoreHarness(snapshot: snapshot)
        let store = harness.store()

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        #expect(store.presentation.source == "verified-device-cache")
        #expect(store.presentation.retainedHistoryComplete == false)
        #expect(store.presentation.boundary == .onlineIncomplete)

        harness.provider.setResults([.success(.init(items: [], hasMore: false, nextCursor: nil))])
        store.open()
        await harness.releaseNextSleep()
        await harness.waitForProviderCallCount(1)

        #expect(store.cachedItemKeys.isEmpty)
        #expect(store.presentation.source == "authoritative")
        #expect(store.presentation.unavailableReason == .authoritativeEmpty)
    }

    @Test func cacheHydrationUsesPersistedCursorInsteadOfDerivingItFromRetainedRows() async {
        let harness = StoreHarness(snapshot: StoreHarness.snapshot(items: ["cached-item"], complete: false))
        let store = harness.store()
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        store.loadEarlier()
        await harness.waitForProviderCallCount(1)

        #expect(harness.provider.lastRefresh?.requestedCursor?.sourceMessageId == "persisted-message")
        #expect(harness.provider.lastRefresh?.requestedCursor?.itemId == "persisted-item")
    }

    @Test func productionCacheHydratesMixedItemsAndRetainedCursorWithoutInventingStrings() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        let cursor = SharedContentDataCursor(
            sourceCreatedAt: "2026-07-20T00:00:00.000Z",
            sourceMessageId: "message-link",
            sourceRank: 0,
            itemId: "link"
        )
        let encodedCursor = String(decoding: try JSONEncoder().encode(cursor), as: UTF8.self)
        let items = [
            StoredSharedContentItem(
                itemId: "photo",
                conversationId: "conversation-a",
                sourceMessageId: "message-photo",
                senderId: "sender-a",
                sourceCreatedAt: "2026-07-24T04:00:00.000Z",
                sourceRank: 0,
                category: "media",
                kind: "photo",
                attachmentId: "attachment-photo",
                attachmentOriginalName: "photo.jpg",
                attachmentMimeType: "image/jpeg",
                attachmentByteSize: 1_024,
                attachmentWidth: 640,
                attachmentHeight: 480
            ),
            StoredSharedContentItem(
                itemId: "file",
                conversationId: "conversation-a",
                sourceMessageId: "message-file",
                senderId: "sender-a",
                sourceCreatedAt: "2026-07-24T03:00:00.000Z",
                sourceRank: 0,
                category: "files",
                kind: "document",
                attachmentId: "attachment-file",
                attachmentOriginalName: "guide.pdf",
                attachmentMimeType: "application/pdf",
                attachmentByteSize: 2_048
            ),
            StoredSharedContentItem(
                itemId: "voice",
                conversationId: "conversation-a",
                sourceMessageId: "message-voice",
                senderId: "sender-a",
                sourceCreatedAt: "2026-07-24T02:00:00.000Z",
                sourceRank: 0,
                category: "voice",
                kind: "voice",
                attachmentId: "attachment-voice",
                attachmentOriginalName: "voice.m4a",
                attachmentMimeType: "audio/mp4",
                attachmentByteSize: 4_096,
                durationMs: 12_000
            ),
            StoredSharedContentItem(
                itemId: "link",
                conversationId: "conversation-a",
                sourceMessageId: "message-link",
                senderId: "sender-a",
                sourceCreatedAt: "2026-07-24T01:00:00.000Z",
                sourceRank: 0,
                category: "links",
                kind: "link",
                linkMetadataJson: #"{"hostname":"example.test","title":"A calm link"}"#
            ),
        ]

        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: items,
            retainedOldestCursor: encodedCursor,
            retainedHistoryComplete: false,
            authoritativeEmptyConfirmed: false
        )
        let hydrated = try #require(try await cache.hydrateVerifiedOwner(
            verifiedOwnerId: "owner-a",
            conversationId: "conversation-a"
        ))

        #expect(hydrated.items.map(\.itemId) == ["photo", "file", "voice", "link"])
        #expect(hydrated.items[0].linkMetadataJson == nil)
        #expect(hydrated.items[3].attachmentId == nil)
        #expect(hydrated.retainedOldestCursor == encodedCursor)

        let harness = StoreHarness(snapshot: hydrated)
        let store = harness.store()
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        #expect(store.acceptedItems.map(\.itemId) == ["photo", "file", "voice", "link"])
        #expect(store.cachedItemKeys == ["photo", "file", "voice", "link"])
        #expect(store.earlierState == .ready)

        store.loadEarlier()
        await harness.waitForProviderCallCount(1)
        #expect(harness.provider.lastRefresh?.requestedCursor == cursor)
    }

    @Test func routeOpenRefreshPreservesHydratedHistorySelectionAnchorAndDeepestCursor() async {
        let cachedIds = (0..<60).map { "cached-\($0)" }
        let refreshedItems =
            (0..<5).map { StoreHarness.dataItem("new-\($0)", category: "media", kind: "photo") } +
            (0..<35).map { StoreHarness.dataItem("cached-\($0)", category: "media", kind: "photo") }
        let boundary = refreshedItems.last!
        let harness = StoreHarness(
            snapshot: StoreHarness.snapshot(items: cachedIds, complete: false),
            refreshResults: [
                .success(.init(
                    items: refreshedItems,
                    hasMore: true,
                    nextCursor: boundary.cursor
                )),
            ]
        )
        let store = harness.store()
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        let model = SharedContentGalleryModel(store: store)
        model.selectCategory(.media)
        model.remember(
            anchor: .init(
                itemId: "cached-50",
                scrollOffset: 144,
                focusedItemId: "cached-50"
            ),
            for: .media
        )

        model.open()
        await harness.releaseNextSleep()
        await harness.waitForProviderCallCount(1)

        #expect(store.acceptedItems.map(\.itemId) ==
            (0..<5).map { "new-\($0)" } + cachedIds)
        #expect(store.cachedItemKeys == store.acceptedItems.map(\.itemId))
        #expect(model.selectedCategory == .media)
        #expect(model.anchor(for: .media) == .init(
            itemId: "cached-50",
            scrollOffset: 144,
            focusedItemId: "cached-50"
        ))
        #expect(store.earlierState == .ready)

        store.loadEarlier()
        await harness.waitForProviderCallCount(2)
        #expect(harness.provider.lastRefresh?.requestedCursor?.sourceMessageId == "persisted-message")
        #expect(harness.provider.lastRefresh?.requestedCursor?.itemId == "persisted-item")
    }

    @Test func lowDataModeSuppressesOnlyLookaheadAndBatchesAtMostFifty() async {
        let harness = StoreHarness()
        let store = harness.store()
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        let visible = (0..<51).map { "visible-\($0)" }
        let plan = store.visibility(
            visibleItemIds: visible,
            lookaheadItemIds: ["lookahead-1"],
            selectedItemIds: ["selected-1"],
            policy: .init(usable: true, constrained: true, expensive: false)
        )

        #expect(plan.lookaheadAllowed == false)
        #expect(plan.batches.map(\.intent) == [.visibleThumbnail, .visibleThumbnail, .selectedFullContent])
        #expect(plan.batches.allSatisfy { $0.ids.count <= 50 })
        #expect(!plan.batches.contains { $0.intent == .lookaheadThumbnail })
        for _ in plan.batches { await Task.yield() }
        #expect(harness.deliveryRecorder.batches == plan.batches)
    }

    @Test func closeAndRebindCancelAndAwaitOwnedDeliveryTasks() async {
        let harness = StoreHarness()
        let recorder = DeliveryTaskLifecycleRecorder()
        let store = SharedContentStore(
            provider: harness.provider,
            submitDeliveryBatch: { _ in
                Task {
                    await recorder.runUntilCancelled()
                }
            }
        )
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        _ = store.visibility(visibleItemIds: ["item-a"], lookaheadItemIds: [])
        await recorder.waitUntilStarted(count: 1)
        let closedTasks = store.close()
        for task in closedTasks { await task.value }
        #expect(await recorder.cancelledCount == 1)

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        _ = store.visibility(visibleItemIds: ["item-b"], lookaheadItemIds: [])
        await recorder.waitUntilStarted(count: 2)
        await store.bind(ownerIdentityId: "owner-b", conversationId: "conversation-b")
        #expect(await recorder.cancelledCount == 2)
    }

    @Test func confirmDisplayedIsTheOnlyThumbnailPersistencePromotion() async {
        let harness = StoreHarness()
        let store = harness.store()
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        let key = SharedContentThumbnailKey(
            "owner-a",
            "conversation-a",
            "item-a",
            "v1",
            identityGeneration: 1
        )
        #expect(await harness.thumbnailStore.stageLookahead(key, bytes: Data([1, 2, 3])))
        #expect(await harness.thumbnailStore.persistedFileCount(ownerIdentityId: "owner-a") == 0)
        #expect(await store.confirmDisplayed(key))
        #expect(await harness.thumbnailStore.persistedFileCount(ownerIdentityId: "owner-a") == 1)
    }

    @Test func presentationContainsOnlyClosedProviderNeutralKeys() async {
        let harness = StoreHarness(snapshot: StoreHarness.snapshot(items: ["opaque-item"], complete: true))
        let store = harness.store()
        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")

        let encoded = try? JSONEncoder().encode(store.presentation)
        let json = encoded.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        #expect(Set(json.map { Array($0.keys) } ?? []) == ["source", "stale", "retainedHistoryComplete", "notice", "boundary", "unavailableReason", "manualRetry"])
        #expect(store.presentation.source == "verified-device-cache")
    }

    @Test func acceptedSafeItemsAndGlobalEarlierPagingPreserveVisibleContent() async {
        let snapshot = StoreHarness.snapshot(items: ["cached-item"], complete: false)
        let earlierItem = StoreHarness.dataItem(
            "earlier-file",
            category: "files",
            kind: "document"
        )
        let harness = StoreHarness(
            snapshot: snapshot,
            refreshResults: [
                .success(.init(
                    items: [earlierItem],
                    hasMore: true,
                    nextCursor: earlierItem.cursor
                )),
            ],
            holdRefresh: true
        )
        let store = harness.store()

        await store.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        #expect(store.acceptedItems.map(\.itemId) == ["cached-item"])
        #expect(store.earlierState == .ready)

        store.loadEarlier()
        store.loadEarlier()
        await harness.waitForProviderCallCount(1)
        #expect(store.earlierState == .loading)
        #expect(harness.provider.refreshCount == 1)

        harness.provider.releaseRefresh()
        await harness.waitForAcceptedItemCount(2, store: store)
        #expect(store.acceptedItems.map(\.itemId) == ["cached-item", "earlier-file"])
        #expect(store.earlierState == .ready)

        let encoded = try? JSONEncoder().encode(store.acceptedItems)
        let json = encoded.map { String(decoding: $0, as: UTF8.self) } ?? ""
        #expect(!json.contains("https://"))
        #expect(!json.contains("displayPath"))
        #expect(!json.contains("thumbnailPath"))
        #expect(!json.contains("senderId"))
    }

    @Test func earlierFailureAndStaleCompletionRetainOrClearAtTheRightBoundary() async {
        let snapshot = StoreHarness.snapshot(items: ["cached-item"], complete: false)
        let failedHarness = StoreHarness(
            snapshot: snapshot,
            refreshResults: [.failure(.network)]
        )
        let failedStore = failedHarness.store()
        await failedStore.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        failedStore.loadEarlier()
        await failedHarness.waitForProviderCallCount(1)
        #expect(failedStore.acceptedItems.map(\.itemId) == ["cached-item"])
        #expect(failedStore.earlierState == .failed)

        let staleItem = StoreHarness.dataItem("stale-item", category: "links", kind: "link")
        let staleHarness = StoreHarness(
            snapshot: snapshot,
            refreshResults: [
                .success(.init(
                    items: [staleItem],
                    hasMore: false,
                    nextCursor: staleItem.cursor
                )),
            ],
            holdRefresh: true
        )
        let staleStore = staleHarness.store()
        await staleStore.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        staleStore.loadEarlier()
        await staleHarness.waitForProviderCallCount(1)
        #expect(staleStore.revokeIdentityGeneration(staleStore.identityGeneration + 1))
        staleHarness.provider.releaseRefresh()
        await Task.yield()
        #expect(staleStore.acceptedItems.isEmpty)
        #expect(staleStore.earlierState == .hidden)
    }
}

private actor DeliveryTaskLifecycleRecorder {
    private(set) var startedCount = 0
    private(set) var cancelledCount = 0

    func runUntilCancelled() async {
        startedCount += 1
        do {
            try await Task.sleep(for: .seconds(60))
        } catch {
            cancelledCount += 1
        }
    }

    func waitUntilStarted(count: Int) async {
        while startedCount < count {
            await Task.yield()
        }
    }
}

@MainActor
private final class StoreHarness {
    let clock = TestClock()
    let sleeper = TestSleeper()
    let provider: FakeSharedContentProvider
    let thumbnailStore: SharedContentThumbnailStore
    let deliveryRecorder = DeliveryBatchRecorder()

    init(
        snapshot: StoredSharedContentSnapshot? = nil,
        refreshResults: [SharedContentRepositoryResult<SharedContentDataPage>] = [],
        holdRefresh: Bool = false
    ) {
        provider = FakeSharedContentProvider(
            snapshot: snapshot,
            results: refreshResults,
            holdRefresh: holdRefresh
        )
        thumbnailStore = try! SharedContentThumbnailStore(
            root: FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        )
    }

    func store() -> SharedContentStore {
        SharedContentStore(
            provider: provider,
            clock: clock,
            jitter: FixedJitter(milliseconds: 123),
            sleeper: sleeper.sleep,
            thumbnailStore: thumbnailStore,
            submitDeliveryBatch: { [deliveryRecorder] batch in
                Task { @MainActor in
                    deliveryRecorder.batches.append(batch)
                }
            }
        )
    }

    func releaseNextSleep() async {
        for _ in 0..<100 where sleeper.pendingCount == 0 {
            await Task.yield()
        }
        sleeper.releaseNext()
    }

    func waitForProviderCallCount(_ count: Int) async {
        for _ in 0..<100 where provider.refreshCount < count {
            await Task.yield()
        }
        for _ in 0..<10 { await Task.yield() }
    }

    func waitForPendingSleep() async {
        for _ in 0..<100 where sleeper.pendingCount == 0 {
            await Task.yield()
        }
    }

    func waitForAcceptedItemCount(_ count: Int, store: SharedContentStore) async {
        for _ in 0..<100 where store.acceptedItems.count < count {
            await Task.yield()
        }
    }

    static func snapshot(items: [String], complete: Bool) -> StoredSharedContentSnapshot {
        StoredSharedContentSnapshot(
            schemaVersion: 1,
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: items.enumerated().map { index, itemId in
                StoredSharedContentItem(
                    itemId: itemId,
                    conversationId: "conversation-a",
                    sourceMessageId: "message-\(index)",
                    senderId: "sender-a",
                    sourceCreatedAt: "2026-07-23T00:00:00.000Z",
                    sourceRank: index,
                    category: "media",
                    kind: "photo"
                )
            },
            source: .verifiedDeviceCache,
            stale: false,
            retainedHistoryComplete: complete,
            authoritativeEmptyConfirmed: false,
            retainedOldestCursor: complete ? nil : encodedCursor(
                SharedContentDataCursor(
                    sourceCreatedAt: "2026-07-22T00:00:00.000Z",
                    sourceMessageId: "persisted-message",
                    sourceRank: 9,
                    itemId: "persisted-item"
                )
            ),
            newestWindowProtected: true
        )
    }

    private static func encodedCursor(_ cursor: SharedContentDataCursor) -> String {
        String(decoding: try! JSONEncoder().encode(cursor), as: UTF8.self)
    }

    static func dataItem(
        _ itemId: String,
        category: String,
        kind: String
    ) -> SharedContentDataItem {
        SharedContentDataItem(
            itemId: itemId,
            conversationId: "conversation-a",
            sourceMessageId: "message-\(itemId)",
            senderId: "sender-a",
            sourceCreatedAt: "2026-07-23T00:00:00.000Z",
            sourceRank: 0,
            category: category,
            kind: kind,
            attachmentId: kind == "document" ? "attachment-a" : nil,
            attachmentOriginalName: kind == "document" ? "guide.pdf" : nil,
            attachmentMimeType: kind == "document" ? "application/pdf" : nil,
            attachmentByteSize: kind == "document" ? 1_024 : nil,
            linkUrl: kind == "link" ? "https://example.test/private" : nil,
            linkHostname: kind == "link" ? "example.test" : nil,
            linkTitle: kind == "link" ? "Safe title" : nil,
            canDelete: false,
            canExport: false
        )
    }
}

@MainActor
private final class DeliveryBatchRecorder {
    var batches: [SharedContentDeliveryBatch] = []
}

@MainActor
private final class TestClock: SharedContentClock {
    private(set) var date = Date(timeIntervalSince1970: 1_000)

    func now() -> Date { date }
    func advance(by duration: Duration) {
        date.addTimeInterval(duration.timeInterval)
    }
}

private struct FixedJitter: SharedContentJitter {
    let milliseconds: Int64

    func retryJitterMilliseconds(for cycle: Int) -> Int64 {
        _ = cycle
        return milliseconds
    }
}

@MainActor
private final class TestSleeper {
    private var continuations: [CheckedContinuation<Void, Never>] = []
    private(set) var lastDuration: Duration?

    var pendingCount: Int { continuations.count }

    func sleep(for duration: Duration) async throws {
        lastDuration = duration
        await withCheckedContinuation { continuation in
            continuations.append(continuation)
        }
    }

    func releaseNext() {
        guard !continuations.isEmpty else { return }
        continuations.removeFirst().resume()
    }
}

private final class FakeSharedContentProvider: SharedContentProviding, @unchecked Sendable {
    private let lock = NSLock()
    let snapshot: StoredSharedContentSnapshot?
    private var results: [SharedContentRepositoryResult<SharedContentDataPage>]
    private var refreshes: [SharedContentRequestToken] = []
    private var holdRefresh: Bool
    private var refreshContinuation: CheckedContinuation<Void, Never>?

    var refreshCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return refreshes.count
    }

    var lastRefresh: SharedContentRequestToken? {
        lock.withLock { refreshes.last }
    }

    init(
        snapshot: StoredSharedContentSnapshot? = nil,
        results: [SharedContentRepositoryResult<SharedContentDataPage>] = [],
        holdRefresh: Bool = false
    ) {
        self.snapshot = snapshot
        self.results = results
        self.holdRefresh = holdRefresh
    }

    func setResults(_ results: [SharedContentRepositoryResult<SharedContentDataPage>]) {
        lock.lock()
        self.results = results
        lock.unlock()
    }

    func observeSharedContentSnapshot(conversationId: String) -> AsyncStream<StoredSharedContentSnapshot?> {
        AsyncStream { continuation in
            continuation.yield(snapshot?.conversationId == conversationId ? snapshot : nil)
            continuation.finish()
        }
    }

    func refreshSharedContent(token: SharedContentRequestToken, category: String?) async -> SharedContentRepositoryResult<SharedContentDataPage> {
        _ = category
        let result = nextResult(for: token)
        let shouldHold = lock.withLock { holdRefresh }
        if shouldHold {
            await withCheckedContinuation { continuation in
                lock.withLock {
                    refreshContinuation = continuation
                }
            }
        }
        return result
    }

    func releaseRefresh() {
        let continuation = lock.withLock { () -> CheckedContinuation<Void, Never>? in
            holdRefresh = false
            defer { refreshContinuation = nil }
            return refreshContinuation
        }
        continuation?.resume()
    }

    private func nextResult(for token: SharedContentRequestToken) -> SharedContentRepositoryResult<SharedContentDataPage> {
        lock.lock()
        defer { lock.unlock() }
        refreshes.append(token)
        if results.isEmpty { return .success(.init(items: [], hasMore: false, nextCursor: nil)) }
        return results.removeFirst()
    }

    func refreshSharedContentCategories(token: SharedContentRequestToken) async -> SharedContentRepositoryResult<[String]> {
        _ = token
        return .success([])
    }
}

private extension Duration {
    var timeInterval: TimeInterval {
        let components = self.components
        return TimeInterval(components.seconds) + TimeInterval(components.attoseconds) / 1_000_000_000_000_000_000
    }
}

private extension SharedContentDataItem {
    var cursor: SharedContentDataCursor {
        SharedContentDataCursor(
            sourceCreatedAt: sourceCreatedAt,
            sourceMessageId: sourceMessageId,
            sourceRank: sourceRank,
            itemId: itemId
        )
    }
}
