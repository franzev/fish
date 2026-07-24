import ChatCore
import ChatData
import Foundation
import Observation

@MainActor
public protocol SharedContentClock {
    func now() -> Date
}

public struct SystemSharedContentClock: SharedContentClock {
    public init() {}

    public func now() -> Date { Date() }
}

public protocol SharedContentJitter {
    func retryJitterMilliseconds(for cycle: Int) -> Int64
}

public struct ZeroSharedContentJitter: SharedContentJitter {
    public init() {}

    public func retryJitterMilliseconds(for cycle: Int) -> Int64 {
        _ = cycle
        return 0
    }
}

public enum SharedContentRecoveryTrigger: String, Sendable, Equatable {
    case galleryOpen = "gallery-open"
    case meaningfulForeground = "meaningful-foreground"
    case reconnect
    case realtime
    case manualRetry = "manual-retry"
}

/// Closed global paging truth. Shared content never issues category-specific
/// history requests.
public enum SharedContentEarlierState: String, Sendable, Equatable {
    case hidden
    case ready
    case loading
    case failed
    case offline
}

/// Display-safe metadata accepted at the PersonalChat boundary.
///
/// Provider locators, delivery leases, cache entities, raw URLs, sender/date
/// preview context, and Phase 14 action authority are intentionally absent.
public struct SharedContentAcceptedItem: Codable, Identifiable, Sendable, Equatable {
    public let itemId: String
    public let conversationId: String
    public let category: String
    public let kind: String
    public let originalName: String?
    public let mimeType: String?
    public let byteSize: Int64?
    public let width: Int?
    public let height: Int?
    public let durationMs: Int64?
    public let mediaTitle: String?
    public let mediaDescription: String?
    public let linkTitle: String?
    public let linkHostname: String?
    let sourceMessageId: String?
    let attachmentId: String?
    let stickerId: String?
    let contentVersion: String

    public var id: String { itemId }

    init(
        itemId: String,
        conversationId: String,
        category: String,
        kind: String,
        originalName: String?,
        mimeType: String?,
        byteSize: Int64?,
        width: Int?,
        height: Int?,
        durationMs: Int64?,
        mediaTitle: String?,
        mediaDescription: String?,
        linkTitle: String?,
        linkHostname: String?,
        sourceMessageId: String?,
        attachmentId: String?,
        stickerId: String?,
        contentVersion: String
    ) {
        self.itemId = itemId
        self.conversationId = conversationId
        self.category = category
        self.kind = kind
        self.originalName = originalName
        self.mimeType = mimeType
        self.byteSize = byteSize
        self.width = width
        self.height = height
        self.durationMs = durationMs
        self.mediaTitle = mediaTitle
        self.mediaDescription = mediaDescription
        self.linkTitle = linkTitle
        self.linkHostname = linkHostname
        self.sourceMessageId = sourceMessageId
        self.attachmentId = attachmentId
        self.stickerId = stickerId
        self.contentVersion = contentVersion
    }

    private enum CodingKeys: String, CodingKey {
        case itemId, conversationId, category, kind, originalName, mimeType
        case byteSize, width, height, durationMs, mediaTitle, mediaDescription
        case linkTitle, linkHostname
    }

    public init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        itemId = try values.decode(String.self, forKey: .itemId)
        conversationId = try values.decode(String.self, forKey: .conversationId)
        category = try values.decode(String.self, forKey: .category)
        kind = try values.decode(String.self, forKey: .kind)
        originalName = try values.decodeIfPresent(String.self, forKey: .originalName)
        mimeType = try values.decodeIfPresent(String.self, forKey: .mimeType)
        byteSize = try values.decodeIfPresent(Int64.self, forKey: .byteSize)
        width = try values.decodeIfPresent(Int.self, forKey: .width)
        height = try values.decodeIfPresent(Int.self, forKey: .height)
        durationMs = try values.decodeIfPresent(Int64.self, forKey: .durationMs)
        mediaTitle = try values.decodeIfPresent(String.self, forKey: .mediaTitle)
        mediaDescription = try values.decodeIfPresent(String.self, forKey: .mediaDescription)
        linkTitle = try values.decodeIfPresent(String.self, forKey: .linkTitle)
        linkHostname = try values.decodeIfPresent(String.self, forKey: .linkHostname)
        sourceMessageId = nil
        attachmentId = nil
        stickerId = nil
        contentVersion = itemId
    }

    public func encode(to encoder: any Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(itemId, forKey: .itemId)
        try values.encode(conversationId, forKey: .conversationId)
        try values.encode(category, forKey: .category)
        try values.encode(kind, forKey: .kind)
        try values.encodeIfPresent(originalName, forKey: .originalName)
        try values.encodeIfPresent(mimeType, forKey: .mimeType)
        try values.encodeIfPresent(byteSize, forKey: .byteSize)
        try values.encodeIfPresent(width, forKey: .width)
        try values.encodeIfPresent(height, forKey: .height)
        try values.encodeIfPresent(durationMs, forKey: .durationMs)
        try values.encodeIfPresent(mediaTitle, forKey: .mediaTitle)
        try values.encodeIfPresent(mediaDescription, forKey: .mediaDescription)
        try values.encodeIfPresent(linkTitle, forKey: .linkTitle)
        try values.encodeIfPresent(linkHostname, forKey: .linkHostname)
    }
}

public typealias SharedContentTaskFactory = (@escaping @MainActor () async -> Void) -> Task<Void, Never>

@MainActor @Observable
public final class SharedContentStore {
    public static let meaningfulForeground: TimeInterval = 5 * 60
    public static let triggerCoalescing: Duration = .milliseconds(500)

    public private(set) var presentation: SharedContentPresentationContract
    public private(set) var cachedItemKeys: [String] = []
    public private(set) var acceptedItems: [SharedContentAcceptedItem] = []
    public private(set) var earlierState: SharedContentEarlierState = .hidden
    public private(set) var recoveryCycleCount = 0
    public private(set) var identityGeneration = 0
    var ownerIdentityIdForMedia: String { ownerIdentityId ?? "" }

    private let provider: any SharedContentProviding
    private let clock: any SharedContentClock
    private let jitter: any SharedContentJitter
    private let sleeper: (Duration) async throws -> Void
    private let taskFactory: SharedContentTaskFactory
    private let thumbnailStore: SharedContentThumbnailStore?
    private let submitDeliveryBatch: @MainActor (SharedContentDeliveryBatch) -> Task<Void, Never>

    private var state = createSharedContentState(identityGeneration: 0)
    private var ownerIdentityId: String?
    private var conversationId: String?
    private var networkPolicy = ChatData.SharedContentNetworkPolicy(
        usable: true,
        constrained: false,
        expensive: false
    )
    private var cacheSource: ChatData.SharedContentCacheSource = .none
    private var cacheStale = false
    private var retainedHistoryComplete = true
    private var authoritativeEmptyConfirmed = false
    private var recoveryPhase = SharedContentRecoveryPhase.idle
    private var manualRetryState = SharedContentManualRetryState.hidden
    private var cycleId: String?
    private var cycleSequence = 0
    private var coalescingTask: Task<Void, Never>?
    private var recoveryTask: Task<Void, Never>?
    private var earlierTask: Task<Void, Never>?
    private var deliveryTasks: [Task<Void, Never>] = []
    private var retainedCursor: SharedContentDataCursor?
    private var pendingEarlierToken: SharedContentRequestToken?
    private var earlierSequence = 0
    private var earlierFailure = false
    private var lastBackgroundAt: Date?
    private var bound = false

    public init(
        provider: any SharedContentProviding,
        clock: any SharedContentClock = SystemSharedContentClock(),
        jitter: any SharedContentJitter = ZeroSharedContentJitter(),
        sleeper: @escaping (Duration) async throws -> Void = { duration in
            try await Task.sleep(for: duration)
        },
        taskFactory: @escaping SharedContentTaskFactory = { operation in
            Task { @MainActor in await operation() }
        },
        thumbnailStore: SharedContentThumbnailStore? = nil,
        submitDeliveryBatch: @escaping @MainActor (SharedContentDeliveryBatch) -> Task<Void, Never> = { _ in
            Task {}
        }
    ) {
        self.provider = provider
        self.clock = clock
        self.jitter = jitter
        self.sleeper = sleeper
        self.taskFactory = taskFactory
        self.thumbnailStore = thumbnailStore
        self.submitDeliveryBatch = submitDeliveryBatch
        self.presentation = Self.makePresentation(
            source: .none,
            hasCache: false,
            stale: false,
            retainedHistoryComplete: true,
            networkUsable: true,
            authoritativeEmptyConfirmed: false,
            recoveryPhase: .idle,
            manualRetry: .hidden
        )
    }

    public func bind(ownerIdentityId: String, conversationId: String) async {
        guard !ownerIdentityId.isEmpty, !conversationId.isEmpty else {
            close()
            return
        }

        if bound, self.ownerIdentityId == ownerIdentityId, self.conversationId == conversationId {
            return
        }

        await awaitCancelledTasks(cancelTasks())
        identityGeneration = max(identityGeneration + 1, 1)
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
        bound = true
        cacheSource = .none
        cacheStale = false
        retainedHistoryComplete = true
        authoritativeEmptyConfirmed = false
        recoveryPhase = .idle
        manualRetryState = .hidden
        acceptedItems = []
        retainedCursor = nil
        pendingEarlierToken = nil
        earlierFailure = false
        state = createSharedContentState(
            identityId: ownerIdentityId,
            conversationId: conversationId,
            identityGeneration: identityGeneration
        )
        publishPresentation()

        for await snapshot in provider.observeSharedContentSnapshot(conversationId: conversationId) {
            guard bound,
                  self.ownerIdentityId == ownerIdentityId,
                  self.conversationId == conversationId
            else { return }
            accept(snapshot)
        }
    }

    /// Revokes all gallery state before an application identity transition.
    /// The generation is supplied by the app-level coordinator so every
    /// store callback shares one monotonic boundary.
    @discardableResult
    public func revokeIdentityGeneration(_ generation: Int) -> Bool {
        guard generation >= identityGeneration else { return false }
        cancelTasks()
        bound = false
        ownerIdentityId = nil
        conversationId = nil
        identityGeneration = generation
        cacheSource = .none
        cacheStale = false
        retainedHistoryComplete = true
        authoritativeEmptyConfirmed = false
        recoveryPhase = .idle
        manualRetryState = .hidden
        cachedItemKeys = []
        acceptedItems = []
        retainedCursor = nil
        pendingEarlierToken = nil
        earlierFailure = false
        state = createSharedContentState(identityGeneration: generation)
        publishPresentation()
        return true
    }

    public func open() {
        requestRecovery(.galleryOpen)
    }

    public func didEnterBackground() {
        lastBackgroundAt = clock.now()
    }

    public func foreground() {
        guard let lastBackgroundAt,
              clock.now().timeIntervalSince(lastBackgroundAt) >= Self.meaningfulForeground
        else { return }
        requestRecovery(.meaningfulForeground)
    }

    public func reconnect() {
        requestRecovery(.reconnect)
    }

    public func realtime() {
        requestRecovery(.realtime)
    }

    public func connectivityChanged(_ policy: ChatData.SharedContentNetworkPolicy) {
        let wasUsable = networkPolicy.usable
        networkPolicy = policy
        guard policy.usable else {
            cancelTasks()
            recoveryPhase = .idle
            manualRetryState = .hidden
            publishPresentation()
            return
        }
        if !wasUsable { requestRecovery(.reconnect) }
    }

    @discardableResult
    public func retry() -> Bool {
        guard manualRetryState == .enabled, networkPolicy.usable, bound else { return false }
        manualRetryState = .busy
        startRecoveryCycle(trigger: .manualRetry)
        return true
    }

    /// Loads one global retained-history page. Duplicate calls are ignored
    /// while the exact cursor-bearing append request is in flight.
    public func loadEarlier() {
        guard bound,
              networkPolicy.usable,
              !retainedHistoryComplete,
              let ownerIdentityId,
              let conversationId,
              let retainedCursor,
              pendingEarlierToken == nil
        else { return }

        earlierSequence += 1
        let token = SharedContentRequestToken(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            identityGeneration: identityGeneration,
            cycleId: "earlier-\(identityGeneration)-\(earlierSequence)",
            requestId: "earlier-request-\(earlierSequence)",
            requestedCursor: retainedCursor,
            replace: false
        )
        pendingEarlierToken = token
        earlierFailure = false
        publishEarlierState()

        earlierTask = taskFactory { @MainActor [weak self] in
            guard let self else { return }
            let result = await self.provider.refreshSharedContent(token: token, category: nil)
            guard self.isCurrentEarlier(token) else { return }
            self.pendingEarlierToken = nil
            self.earlierTask = nil

            switch result {
            case .success(let page):
                guard let incoming = page.acceptedItems(for: conversationId),
                      page.nextCursor == page.items.last.map(\.dataCursor)
                else {
                    self.earlierFailure = true
                    self.publishPresentation()
                    return
                }
                var seen = Set(self.acceptedItems.map(\.itemId))
                self.acceptedItems += incoming.filter { seen.insert($0.itemId).inserted }
                self.cachedItemKeys = self.acceptedItems.map(\.itemId)
                self.retainedHistoryComplete = !page.hasMore
                self.retainedCursor = page.hasMore ? page.nextCursor : nil
                self.authoritativeEmptyConfirmed = false
                self.earlierFailure = false
                self.publishPresentation()
            case .failure:
                self.earlierFailure = true
                self.publishPresentation()
            }
        }
    }

    public func visibility(
        visibleItemIds: [String],
        lookaheadItemIds: [String],
        selectedItemIds: [String] = [],
        policy: ChatData.SharedContentNetworkPolicy? = nil
    ) -> SharedContentDeliveryPlanningResult {
        let currentPolicy = policy ?? networkPolicy
        let planning = decodeCore(
            SharedContentDeliveryPlanningInput.self,
            object: [
                "visibleIds": currentPolicy.usable ? visibleItemIds : [],
                "lookaheadIds": lookaheadItemIds,
                "selectedIds": selectedItemIds,
                "networkUsable": currentPolicy.usable,
                "lookaheadAllowed": currentPolicy.lookaheadAllowed
            ]
        )
        let result = planSharedContentDeliveryBatches(planning)
        deliveryTasks.append(contentsOf: result.batches.map(submitDeliveryBatch))
        return result
    }

    @discardableResult
    public func confirmDisplayed(_ key: SharedContentThumbnailKey) async -> Bool {
        guard let thumbnailStore,
              bound,
              key.ownerIdentityId == ownerIdentityId,
              key.conversationId == conversationId,
              key.identityGeneration == identityGeneration
        else { return false }
        return await thumbnailStore.confirmDisplayed(key)
    }

    @discardableResult
    public func confirmDisplayed(itemId: String, contentVersion: String) async -> Bool {
        guard let ownerIdentityId,
              let conversationId,
              !contentVersion.isEmpty,
              acceptedItems.contains(where: { $0.itemId == itemId })
        else { return false }
        return await confirmDisplayed(
            SharedContentThumbnailKey(
                ownerIdentityId,
                conversationId,
                itemId,
                contentVersion,
                identityGeneration: identityGeneration
            )
        )
    }

    @discardableResult
    public func close() -> [Task<Void, Never>] {
        let cancelledDeliveryTasks = cancelTasks()
        bound = false
        ownerIdentityId = nil
        conversationId = nil
        identityGeneration += 1
        cacheSource = .none
        cacheStale = false
        retainedHistoryComplete = true
        authoritativeEmptyConfirmed = false
        recoveryPhase = .idle
        manualRetryState = .hidden
        cachedItemKeys = []
        acceptedItems = []
        retainedCursor = nil
        pendingEarlierToken = nil
        earlierFailure = false
        state = createSharedContentState(identityGeneration: identityGeneration)
        publishPresentation()
        return cancelledDeliveryTasks
    }

    private func requestRecovery(_ trigger: SharedContentRecoveryTrigger) {
        guard bound, networkPolicy.usable else { return }
        guard recoveryTask == nil else { return }
        guard coalescingTask == nil else { return }

        coalescingTask = taskFactory { @MainActor [weak self] in
            guard let self else { return }
            do {
                try await self.sleeper(Self.triggerCoalescing)
            } catch {
                return
            }
            guard self.bound, self.networkPolicy.usable else { return }
            self.coalescingTask = nil
            self.startRecoveryCycle(trigger: trigger)
        }
    }

    private func startRecoveryCycle(trigger: SharedContentRecoveryTrigger) {
        guard bound, networkPolicy.usable else { return }
        coalescingTask?.cancel()
        coalescingTask = nil
        recoveryTask?.cancel()
        cycleSequence += 1
        let cycle = "cycle-\(cycleSequence)"
        cycleId = cycle
        recoveryCycleCount += 1
        recoveryPhase = .refreshing
        manualRetryState = trigger == .manualRetry ? .busy : .hidden
        publishPresentation()

        recoveryTask = taskFactory { @MainActor [weak self] in
            guard let self else { return }
            await self.runRecoveryCycle(cycleId: cycle)
        }
    }

    private func runRecoveryCycle(cycleId cycle: String) async {
        guard let ownerIdentityId, let conversationId else { return }
        for attempt in 0...1 {
            guard isCurrent(cycle), networkPolicy.usable else {
                finishCancelledCycle()
                return
            }

            if attempt == 1 {
                recoveryPhase = .retryBackoff
                publishPresentation()
                let jitterMs = jitter.retryJitterMilliseconds(for: recoveryCycleCount)
                do {
                    try await sleeper(.milliseconds(sharedContentRecoveryDelayMilliseconds(jitterMs)))
                } catch {
                    finishCancelledCycle()
                    return
                }
                guard isCurrent(cycle), networkPolicy.usable else {
                    finishCancelledCycle()
                    return
                }
                recoveryPhase = .refreshing
                publishPresentation()
            }

            let token = SharedContentRequestToken(
                ownerIdentityId: ownerIdentityId,
                conversationId: conversationId,
                identityGeneration: identityGeneration,
                cycleId: cycle,
                requestId: "\(cycle)-attempt-\(attempt)",
                replace: true
            )
            let result = await provider.refreshSharedContent(token: token, category: nil)
            guard isCurrent(cycle) else { return }

            switch result {
            case .success(let page):
                guard let accepted = page.acceptedItems(for: conversationId),
                      page.nextCursor == page.items.last.map(\.dataCursor)
                else {
                    if attempt == 0 {
                        recoveryPhase = .retryBackoff
                        publishPresentation()
                        continue
                    }
                    cacheStale = !acceptedItems.isEmpty
                    recoveryPhase = .manualRetry
                    manualRetryState = .enabled
                    publishPresentation()
                    recoveryTask = nil
                    return
                }
                let previousItems = acceptedItems
                let previousRetainedCursor = retainedCursor
                let previousHistoryComplete = retainedHistoryComplete
                apply(.requestStarted(
                    identityId: ownerIdentityId,
                    conversationId: conversationId,
                    identityGeneration: identityGeneration,
                    requestId: token.requestId,
                    requestedCursor: nil,
                    replace: true
                ))
                apply(.initialLoaded(
                    identityId: ownerIdentityId,
                    conversationId: conversationId,
                    identityGeneration: identityGeneration,
                    requestId: token.requestId,
                    requestedCursor: nil,
                    page: page.corePage,
                    categories: nil,
                    status: nil
                ))
                let reconciled = Self.reconcileNewestWindow(
                    accepted,
                    page: page,
                    previousItems: previousItems
                )
                acceptedItems = reconciled.items
                cachedItemKeys = reconciled.items.map(\.itemId)
                cacheSource = .authoritative
                cacheStale = false
                retainedHistoryComplete = reconciled.preservedOlderHistory
                    ? previousHistoryComplete
                    : !page.hasMore
                retainedCursor = reconciled.preservedOlderHistory
                    ? previousRetainedCursor
                    : (page.hasMore ? page.nextCursor : nil)
                earlierFailure = false
                authoritativeEmptyConfirmed = page.items.isEmpty
                recoveryPhase = .idle
                manualRetryState = .hidden
                publishPresentation()
                recoveryTask = nil
                return
            case .failure(let failure):
                if failure == .requestSuperseded || !networkPolicy.usable {
                    finishCancelledCycle()
                    return
                }
                if attempt == 0 {
                    recoveryPhase = .retryBackoff
                    publishPresentation()
                    continue
                }
                cacheStale = !cachedItemKeys.isEmpty
                recoveryPhase = .manualRetry
                manualRetryState = .enabled
                publishPresentation()
                recoveryTask = nil
                return
            }
        }
    }

    private static func reconcileNewestWindow(
        _ newestItems: [SharedContentAcceptedItem],
        page: SharedContentDataPage,
        previousItems: [SharedContentAcceptedItem]
    ) -> (items: [SharedContentAcceptedItem], preservedOlderHistory: Bool) {
        guard page.hasMore,
              let boundaryId = page.nextCursor?.itemId,
              let previousBoundaryIndex = previousItems.firstIndex(where: {
                  $0.itemId == boundaryId
              })
        else { return (newestItems, false) }

        var seen = Set(newestItems.map(\.itemId))
        let contiguousOlderItems = previousItems
            .dropFirst(previousBoundaryIndex + 1)
            .filter { seen.insert($0.itemId).inserted }
        return (newestItems + contiguousOlderItems, true)
    }

    private func accept(_ snapshot: StoredSharedContentSnapshot?) {
        guard let snapshot,
              snapshot.ownerIdentityId == ownerIdentityId,
              snapshot.conversationId == conversationId
        else { return }

        let incoming = snapshot.items.compactMap(\.acceptedItem)
        guard incoming.count == snapshot.items.count,
              Set(incoming.map(\.itemId)).count == incoming.count
        else { return }
        let persistedCursor = snapshot.retainedOldestCursor.flatMap {
            try? JSONDecoder().decode(SharedContentDataCursor.self, from: Data($0.utf8))
        }
        guard snapshot.retainedHistoryComplete || persistedCursor != nil else { return }

        let requestId = "cache-hydration-\(identityGeneration)"
        let items = snapshot.items.map(\.coreItem)
        apply(.requestStarted(
            identityId: snapshot.ownerIdentityId,
            conversationId: snapshot.conversationId,
            identityGeneration: identityGeneration,
            requestId: requestId,
            requestedCursor: nil,
            replace: true
        ))
        apply(.initialLoaded(
            identityId: snapshot.ownerIdentityId,
            conversationId: snapshot.conversationId,
            identityGeneration: identityGeneration,
            requestId: requestId,
            requestedCursor: nil,
            page: decodeCore(
                SharedContentPage.self,
                object: [
                    "items": items.map(encodeCoreObject),
                    "hasMore": !snapshot.retainedHistoryComplete,
                    "nextCursor": persistedCursor.map(\.coreCursor).map(encodeCoreObject) ?? NSNull()
                ]
            ),
            categories: nil,
            status: items.isEmpty ? .empty : .content
        ))
        cacheSource = snapshot.source
        cacheStale = snapshot.stale
        retainedHistoryComplete = snapshot.retainedHistoryComplete
        acceptedItems = incoming
        cachedItemKeys = incoming.map(\.itemId)
        retainedCursor = snapshot.retainedHistoryComplete ? nil : persistedCursor
        earlierFailure = false
        authoritativeEmptyConfirmed = snapshot.authoritativeEmptyConfirmed
        publishPresentation()
    }

    private func apply(_ event: SharedContentEvent) {
        state = SharedContentReducer.reduce(state, event)
        cachedItemKeys = state.items.map(\.itemId)
    }

    private func isCurrent(_ cycle: String) -> Bool {
        bound && self.cycleId == cycle
    }

    private func isCurrentEarlier(_ token: SharedContentRequestToken) -> Bool {
        bound &&
            pendingEarlierToken == token &&
            token.ownerIdentityId == ownerIdentityId &&
            token.conversationId == conversationId &&
            token.identityGeneration == identityGeneration &&
            token.requestedCursor == retainedCursor &&
            !token.replace
    }

    private func finishCancelledCycle() {
        recoveryPhase = .idle
        manualRetryState = .hidden
        recoveryTask = nil
        publishPresentation()
    }

    @discardableResult
    private func cancelTasks() -> [Task<Void, Never>] {
        coalescingTask?.cancel()
        recoveryTask?.cancel()
        earlierTask?.cancel()
        let cancelledDeliveryTasks = deliveryTasks
        cancelledDeliveryTasks.forEach { $0.cancel() }
        coalescingTask = nil
        recoveryTask = nil
        earlierTask = nil
        deliveryTasks.removeAll()
        pendingEarlierToken = nil
        cycleId = nil
        return cancelledDeliveryTasks
    }

    private func awaitCancelledTasks(_ tasks: [Task<Void, Never>]) async {
        for task in tasks {
            await task.value
        }
    }

    private func publishPresentation() {
        presentation = Self.makePresentation(
            source: cacheSource,
            hasCache: !cachedItemKeys.isEmpty,
            stale: cacheStale,
            retainedHistoryComplete: retainedHistoryComplete,
            networkUsable: networkPolicy.usable,
            authoritativeEmptyConfirmed: authoritativeEmptyConfirmed,
            recoveryPhase: recoveryPhase,
            manualRetry: manualRetryState
        )
        publishEarlierState()
    }

    private func publishEarlierState() {
        if !bound || retainedHistoryComplete || retainedCursor == nil {
            earlierState = .hidden
        } else if pendingEarlierToken != nil {
            earlierState = .loading
        } else if !networkPolicy.usable {
            earlierState = .offline
        } else if earlierFailure {
            earlierState = .failed
        } else {
            earlierState = .ready
        }
    }

    private static func makePresentation(
        source: ChatData.SharedContentCacheSource,
        hasCache: Bool,
        stale: Bool,
        retainedHistoryComplete: Bool,
        networkUsable: Bool,
        authoritativeEmptyConfirmed: Bool,
        recoveryPhase: SharedContentRecoveryPhase,
        manualRetry: SharedContentManualRetryState
    ) -> SharedContentPresentationContract {
        let unavailableReason: SharedContentUnavailableReason
        if authoritativeEmptyConfirmed && source == .authoritative {
            unavailableReason = .authoritativeEmpty
        } else if !hasCache && !networkUsable {
            unavailableReason = .offlineNoCache
        } else if !hasCache && recoveryPhase != .idle {
            unavailableReason = .loading
        } else if !hasCache && source == .none {
            unavailableReason = .authorityUnavailable
        } else {
            unavailableReason = .none
        }

        let notice: SharedContentPresentationNotice
        if hasCache && !networkUsable {
            notice = .offlineCached
        } else if recoveryPhase == .refreshing && hasCache && !stale {
            notice = .checkingForUpdates
        } else if stale {
            notice = .stale
        } else {
            notice = .none
        }

        let boundary: SharedContentHistoryBoundary = retainedHistoryComplete
            ? .none
            : networkUsable ? .onlineIncomplete : .offlineIncomplete

        return decodeCore(
            SharedContentPresentationContract.self,
            object: [
                "source": source.rawValue,
                "stale": stale,
                "retainedHistoryComplete": retainedHistoryComplete,
                "notice": notice.rawValue,
                "boundary": boundary.rawValue,
                "unavailableReason": unavailableReason.rawValue,
                "manualRetry": manualRetry.rawValue
            ]
        )
    }
}

private extension SharedContentDataPage {
    var corePage: SharedContentPage {
        decodeCore(
            SharedContentPage.self,
            object: [
                "items": items.map(\.coreItem).map(encodeCoreObject),
                "hasMore": hasMore,
                "nextCursor": nextCursor.map(\.coreCursor).map(encodeCoreObject) ?? NSNull()
            ]
        )
    }

    func acceptedItems(for conversationId: String) -> [SharedContentAcceptedItem]? {
        guard items.allSatisfy({ $0.conversationId == conversationId }),
              Set(items.map(\.itemId)).count == items.count,
              !hasMore || nextCursor != nil
        else { return nil }
        let accepted = items.compactMap(\.acceptedItem)
        return accepted.count == items.count ? accepted : nil
    }
}

private extension SharedContentDataCursor {
    var coreCursor: SharedContentCursor {
        decodeCore(
            SharedContentCursor.self,
            object: [
                "sourceCreatedAt": sourceCreatedAt,
                "sourceMessageId": sourceMessageId,
                "sourceRank": sourceRank,
                "itemId": itemId
            ]
        )
    }
}

private extension SharedContentDataItem {
    var dataCursor: SharedContentDataCursor {
        SharedContentDataCursor(
            sourceCreatedAt: sourceCreatedAt,
            sourceMessageId: sourceMessageId,
            sourceRank: sourceRank,
            itemId: itemId
        )
    }

    var acceptedItem: SharedContentAcceptedItem? {
        makeAcceptedItem(
            itemId: itemId,
            conversationId: conversationId,
            category: category,
            kind: kind,
            originalName: attachmentOriginalName,
            mimeType: attachmentMimeType,
            byteSize: attachmentByteSize,
            width: attachmentWidth,
            height: attachmentHeight,
            durationMs: durationMs,
            mediaTitle: gifTitle,
            mediaDescription: gifDescription,
            linkTitle: linkTitle,
            linkHostname: linkHostname,
            sourceMessageId: sourceMessageId,
            attachmentId: attachmentId,
            stickerId: stickerId,
            contentVersion: sourceCreatedAt
        )
    }

    var coreItem: SharedContentItem {
        decodeCore(SharedContentItem.self, object: coreItemObject)
    }

    private var coreItemObject: [String: Any] {
        [
            "itemId": itemId,
            "conversationId": conversationId,
            "sourceMessageId": sourceMessageId,
            "senderId": senderId,
            "sourceCreatedAt": sourceCreatedAt,
            "sourceRank": sourceRank,
            "category": SharedContentCategory(rawValue: category)?.rawValue ?? SharedContentCategory.media.rawValue,
            "kind": SharedContentKind(rawValue: kind)?.rawValue ?? SharedContentKind.photo.rawValue,
            "attachment": attachmentId.map { [
                "id": $0,
                "originalName": attachmentOriginalName ?? "",
                "mimeType": attachmentMimeType ?? "",
                "byteSize": attachmentByteSize ?? 0,
                "width": attachmentWidth.map { $0 as Any } ?? NSNull(),
                "height": attachmentHeight.map { $0 as Any } ?? NSNull(),
                "displayPath": attachmentDisplayPath ?? "",
                "thumbnailPath": attachmentThumbnailPath.map { $0 as Any } ?? NSNull()
            ] as [String: Any] } ?? NSNull(),
            "gif": gifProvider.map { [
                "provider": $0,
                "providerContentId": gifProviderContentId ?? "",
                "title": gifTitle.map { $0 as Any } ?? NSNull(),
                "description": gifDescription.map { $0 as Any } ?? NSNull()
            ] as [String: Any] } ?? NSNull(),
            "stickerId": stickerId.map { $0 as Any } ?? NSNull(),
            "link": linkUrl.map { [
                "url": $0,
                "hostname": linkHostname ?? "",
                "title": linkTitle.map { $0 as Any } ?? NSNull(),
                "description": linkDescription.map { $0 as Any } ?? NSNull(),
                "siteName": linkSiteName.map { $0 as Any } ?? NSNull()
            ] as [String: Any] } ?? NSNull(),
            "capabilities": ["canDelete": false, "canExport": false]
        ]
    }
}

private extension StoredSharedContentItem {
    var dataCursor: SharedContentDataCursor {
        SharedContentDataCursor(
            sourceCreatedAt: sourceCreatedAt,
            sourceMessageId: sourceMessageId,
            sourceRank: sourceRank,
            itemId: itemId
        )
    }

    var acceptedItem: SharedContentAcceptedItem? {
        var linkTitle: String?
        var linkHostname: String?
        if let linkMetadataJson {
            guard let data = linkMetadataJson.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return nil }
            linkTitle = normalizedSafeText(object["title"] as? String)
            linkHostname = normalizedSafeText(object["hostname"] as? String)
        }
        return makeAcceptedItem(
            itemId: itemId,
            conversationId: conversationId,
            category: category,
            kind: kind,
            originalName: attachmentOriginalName,
            mimeType: attachmentMimeType,
            byteSize: attachmentByteSize,
            width: attachmentWidth,
            height: attachmentHeight,
            durationMs: durationMs,
            mediaTitle: gifTitle,
            mediaDescription: gifDescription,
            linkTitle: linkTitle,
            linkHostname: linkHostname,
            sourceMessageId: sourceMessageId,
            attachmentId: attachmentId,
            stickerId: stickerId,
            contentVersion: sourceCreatedAt
        )
    }

    var coreItem: SharedContentItem {
        decodeCore(SharedContentItem.self, object: coreItemObject)
    }

    private var coreItemObject: [String: Any] {
        let attachment: Any = attachmentId.map { id in
            [
                "id": id,
                "originalName": attachmentOriginalName ?? "",
                "mimeType": attachmentMimeType ?? "",
                "byteSize": attachmentByteSize ?? 0,
                "width": attachmentWidth.map { $0 as Any } ?? NSNull(),
                "height": attachmentHeight.map { $0 as Any } ?? NSNull(),
                "displayPath": "",
                "thumbnailPath": NSNull()
            ] as [String: Any]
        } ?? NSNull()
        let gif: Any = gifProvider.map { provider in
            [
                "provider": provider,
                "providerContentId": gifProviderContentId ?? "",
                "title": gifTitle.map { $0 as Any } ?? NSNull(),
                "description": gifDescription.map { $0 as Any } ?? NSNull()
            ] as [String: Any]
        } ?? NSNull()
        return [
            "itemId": itemId,
            "conversationId": conversationId,
            "sourceMessageId": sourceMessageId,
            "senderId": senderId,
            "sourceCreatedAt": sourceCreatedAt,
            "sourceRank": sourceRank,
            "category": SharedContentCategory(rawValue: category)?.rawValue ?? SharedContentCategory.media.rawValue,
            "kind": SharedContentKind(rawValue: kind)?.rawValue ?? SharedContentKind.photo.rawValue,
            "attachment": attachment,
            "gif": gif,
            "stickerId": stickerId.map { $0 as Any } ?? NSNull(),
            "link": NSNull(),
            "capabilities": ["canDelete": false, "canExport": false]
        ]
    }
}

private let acceptedKindsByCategory: [String: Set<String>] = [
    "media": ["photo", "video", "gif", "sticker"],
    "files": ["document"],
    "links": ["link"],
    "voice": ["voice"],
]

private func makeAcceptedItem(
    itemId: String,
    conversationId: String,
    category: String,
    kind: String,
    originalName: String?,
    mimeType: String?,
    byteSize: Int64?,
    width: Int?,
    height: Int?,
    durationMs: Int64?,
    mediaTitle: String?,
    mediaDescription: String?,
    linkTitle: String?,
    linkHostname: String?,
    sourceMessageId: String?,
    attachmentId: String?,
    stickerId: String?,
    contentVersion: String
) -> SharedContentAcceptedItem? {
    guard !itemId.isEmpty,
          !conversationId.isEmpty,
          acceptedKindsByCategory[category]?.contains(kind) == true,
          byteSize.map({ $0 >= 0 }) ?? true,
          width.map({ $0 > 0 }) ?? true,
          height.map({ $0 > 0 }) ?? true,
          durationMs.map({ $0 >= 0 }) ?? true
    else { return nil }

    return SharedContentAcceptedItem(
        itemId: itemId,
        conversationId: conversationId,
        category: category,
        kind: kind,
        originalName: normalizedSafeText(originalName),
        mimeType: normalizedSafeText(mimeType),
        byteSize: byteSize,
        width: width,
        height: height,
        durationMs: durationMs,
        mediaTitle: normalizedSafeText(mediaTitle),
        mediaDescription: normalizedSafeText(mediaDescription),
        linkTitle: normalizedSafeText(linkTitle),
        linkHostname: normalizedSafeText(linkHostname),
        sourceMessageId: normalizedSafeText(sourceMessageId),
        attachmentId: normalizedSafeText(attachmentId),
        stickerId: normalizedSafeText(stickerId),
        contentVersion: contentVersion
    )
}

private func normalizedSafeText(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty
    else { return nil }
    return value
}

private func encodeCoreObject<T: Encodable>(_ value: T) -> Any {
    let data = try! JSONEncoder().encode(value)
    return try! JSONSerialization.jsonObject(with: data)
}

private func decodeCore<T: Decodable>(_ type: T.Type, object: Any) -> T {
    let data = try! JSONSerialization.data(withJSONObject: object)
    return try! JSONDecoder().decode(type, from: data)
}
