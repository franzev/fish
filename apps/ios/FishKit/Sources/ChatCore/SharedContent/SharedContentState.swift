import Foundation

public let SHARED_CONTENT_CACHE_SCHEMA_VERSION = 1

public struct SharedContentCacheLimits: Sendable, Equatable {
    public let newestProtectedCount: Int = 40
    public let perConversationItemLimit: Int = 400
    public let perAccountItemLimit: Int = 2000
    public let thumbnailBytesPerAccount: Int64 = 67_108_864
    public let inactivityWindowMs: Int64 = 2_592_000_000
    public let meaningfulForegroundMs: Int64 = 300_000
    public let triggerCoalescingMs: Int64 = 500
    public let retryBaseMs: Int64 = 1_000
    public let retryJitterMaxMs: Int64 = 250
    public let deliveryFreshnessMarginMs: Int64 = 120_000
    public let deliveryBatchMax: Int = 50
}

public let SHARED_CONTENT_CACHE_LIMITS = SharedContentCacheLimits()

public enum SharedContentCacheSource: String, Codable, Sendable, Equatable {
    case none
    case verifiedDeviceCache = "verified-device-cache"
    case authoritative
}

public enum SharedContentCacheTruth: String, Codable, Sendable, Equatable {
    case cached
    case authoritative
    case none
}

public enum SharedContentRecoveryPhase: String, Codable, Sendable, Equatable {
    case idle
    case refreshing
    case retryBackoff = "retry-backoff"
    case manualRetry = "manual-retry"
}

public enum SharedContentFetchIntent: String, Codable, Sendable, Equatable {
    case visibleThumbnail = "visible-thumbnail"
    case lookaheadThumbnail = "lookahead-thumbnail"
    case selectedFullContent = "selected-full-content"
}

public struct SharedContentNetworkPolicy: Codable, Sendable, Equatable {
    public let networkUsable: Bool
    public let lookaheadAllowed: Bool
}

public struct SharedContentCachedAttachment: Codable, Sendable, Equatable {
    public let id: String
    public let originalName: String
    public let mimeType: String
    public let byteSize: Int
    public let width: Int?
    public let height: Int?
}

public struct SharedContentCachedGif: Codable, Sendable, Equatable {
    public let provider: String
    public let providerContentId: String
    public let title: String?
    public let description: String?
}

public struct SharedContentCachedLink: Codable, Sendable, Equatable {
    public let url: String
    public let hostname: String
    public let title: String?
    public let description: String?
    public let siteName: String?
}

public struct SharedContentCachedItem: Codable, Sendable, Equatable {
    public let itemId: String
    public let conversationId: String
    public let sourceMessageId: String
    public let senderId: String
    public let sourceCreatedAt: String
    public let sourceRank: Int
    public let category: SharedContentCategory
    public let kind: SharedContentKind
    public let attachment: SharedContentCachedAttachment?
    public let gif: SharedContentCachedGif?
    public let stickerId: String?
    public let link: SharedContentCachedLink?
}

public struct SharedContentCachedSnapshot: Codable, Sendable, Equatable {
    public let schemaVersion: Int
    public let ownerIdentityId: String
    public let conversationId: String
    public let identityGeneration: Int
    public let items: [SharedContentCachedItem]
    public let source: SharedContentCacheSource
    public let stale: Bool
    public let retainedHistoryComplete: Bool
}

public enum SharedContentPresentationNotice: String, Codable, Sendable, Equatable {
    case none
    case checkingForUpdates = "checking-for-updates"
    case offlineCached = "offline-cached"
    case stale
}

public enum SharedContentHistoryBoundary: String, Codable, Sendable, Equatable {
    case none
    case onlineIncomplete = "online-incomplete"
    case offlineIncomplete = "offline-incomplete"
}

public enum SharedContentUnavailableReason: String, Codable, Sendable, Equatable {
    case none
    case loading
    case authoritativeEmpty = "authoritative-empty"
    case offlineNoCache = "offline-no-cache"
    case identityIneligible = "identity-ineligible"
    case authorityUnavailable = "authority-unavailable"
}

public enum SharedContentManualRetryState: String, Codable, Sendable, Equatable {
    case hidden
    case enabled
    case busy
}

public struct SharedContentPresentationContract: Codable, Sendable, Equatable {
    public let source: String
    public let stale: Bool
    public let retainedHistoryComplete: Bool
    public let notice: SharedContentPresentationNotice
    public let boundary: SharedContentHistoryBoundary
    public let unavailableReason: SharedContentUnavailableReason
    public let manualRetry: SharedContentManualRetryState
}

public struct SharedContentCacheHydrationInput: Codable, Sendable, Equatable {
    public let ownerIdentityId: String
    public let verifiedIdentityId: String?
    public let conversationId: String
    public let cachedItemIds: [String]
    public let cacheIdentityGeneration: Int
    public let currentIdentityGeneration: Int
}

public struct SharedContentCacheHydrationResult: Codable, Sendable, Equatable {
    public let eligible: Bool
    public let itemIds: [String]
    public let unavailableReason: SharedContentUnavailableReason
    public let identityIneligible: Bool
}

public struct SharedContentDeliveryBatch: Codable, Sendable, Equatable {
    public let intent: SharedContentFetchIntent
    public let ids: [String]
}

public struct SharedContentDeliveryPlanningInput: Codable, Sendable, Equatable {
    public let visibleIds: [String]
    public let lookaheadIds: [String]
    public let selectedIds: [String]
    public let networkUsable: Bool
    public let lookaheadAllowed: Bool
}

public struct SharedContentDeliveryPlanningResult: Codable, Sendable, Equatable {
    public let batches: [SharedContentDeliveryBatch]
    public let lookaheadAllowed: Bool?
}

public enum SharedContentCategory: String, Codable, Sendable, Equatable {
    case media
    case files
    case links
    case voice
}

public enum SharedContentKind: String, Codable, Sendable, Equatable {
    case photo
    case video
    case gif
    case sticker
    case document
    case link
    case voice
}

public enum SharedContentSourceKind: String, Codable, Sendable, Equatable {
    case attachment
    case gif
    case sticker
    case link
}

public enum SharedContentAttachmentStatus: String, Codable, Sendable, Equatable {
    case pending
    case uploaded
    case processing
    case pendingScan = "pending_scan"
    case ready
    case failed
    case cancelled
}

public enum SharedContentAttachmentKind: String, Codable, Sendable, Equatable {
    case image
    case file
}

public struct SharedContentSourceDescriptor: Codable, Sendable, Equatable {
    public var itemId: String
    public var conversationId: String
    public var sourceMessageId: String
    public var sourceCreatedAt: String
    public var senderId: String
    public var sourceKind: SharedContentSourceKind
    public var sourceDeleted: Bool
    public var attachmentStatus: SharedContentAttachmentStatus?
    public var attachmentKind: SharedContentAttachmentKind?
    public var boundToSource: Bool?
    public var storedMimeType: String?
    public var attachmentId: String?
    public var originalName: String?
    public var byteSize: Int?
    public var width: Int?
    public var height: Int?
    public var displayPath: String?
    public var thumbnailPath: String?
    public var gifProvider: String?
    public var gifProviderContentId: String?
    public var gifTitle: String?
    public var gifDescription: String?
    public var stickerId: String?
    public var linkUrl: String?
    public var linkHostname: String?
    public var linkTitle: String?
    public var linkDescription: String?
    public var linkSiteName: String?
}

public struct SharedContentAttachment: Codable, Sendable, Equatable {
    public var id: String
    public var originalName: String
    public var mimeType: String
    public var byteSize: Int
    public var width: Int?
    public var height: Int?
    public var displayPath: String
    public var thumbnailPath: String?
}

public struct SharedContentGif: Codable, Sendable, Equatable {
    public var provider: String
    public var providerContentId: String
    public var title: String?
    public var description: String?
}

public struct SharedContentLink: Codable, Sendable, Equatable {
    public var url: String
    public var hostname: String
    public var title: String?
    public var description: String?
    public var siteName: String?
}

public struct SharedContentCapabilities: Codable, Sendable, Equatable {
    public var canDelete: Bool
    public var canExport: Bool
}

public struct SharedContentItem: Codable, Sendable, Equatable {
    public var itemId: String
    public var conversationId: String
    public var sourceMessageId: String
    public var senderId: String
    public var sourceCreatedAt: String
    public var sourceRank: Int
    public var category: SharedContentCategory
    public var kind: SharedContentKind
    public var attachment: SharedContentAttachment?
    public var gif: SharedContentGif?
    public var stickerId: String?
    public var link: SharedContentLink?
    public var capabilities: SharedContentCapabilities
}

public struct SharedContentClassification: Codable, Sendable, Equatable {
    public var category: SharedContentCategory
    public var kind: SharedContentKind
}

public struct SharedContentCursor: Codable, Sendable, Equatable {
    public var sourceCreatedAt: String
    public var sourceMessageId: String
    public var sourceRank: Int
    public var itemId: String
}

public struct SharedContentPageRequest: Codable, Sendable, Equatable {
    public var requestId: String
    public var requestedCursor: SharedContentCursor?
    public var replace: Bool

    private enum CodingKeys: String, CodingKey {
        case requestId, requestedCursor, replace
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requestId, forKey: .requestId)
        try container.encode(requestedCursor, forKey: .requestedCursor)
        try container.encode(replace, forKey: .replace)
    }
}

public struct SharedContentPage: Codable, Sendable, Equatable {
    public var items: [SharedContentItem]
    public var hasMore: Bool
    public var nextCursor: SharedContentCursor?

    private enum CodingKeys: String, CodingKey {
        case items, hasMore, nextCursor
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(items, forKey: .items)
        try container.encode(hasMore, forKey: .hasMore)
        try container.encode(nextCursor, forKey: .nextCursor)
    }
}

public enum SharedContentGalleryStatus: String, Codable, Sendable, Equatable {
    case loading
    case content
    case empty
    case incomplete
    case stale
    case unavailable
    case terminalError = "terminal-error"
}

public struct SharedContentState: Codable, Sendable, Equatable {
    public var identityId: String?
    public var conversationId: String?
    public var identityGeneration: Int
    public var items: [SharedContentItem]
    public var pages: [SharedContentPage]
    public var nextCursor: SharedContentCursor?
    public var hasMore: Bool
    public var pendingPageRequest: SharedContentPageRequest?
    public var categories: [SharedContentCategory]
    public var status: SharedContentGalleryStatus
    public var deliveryReferences: [String]
    public var temporaryReferences: [String]
    public var error: String?
    public var deletedSourceMessageIds: [String]

    public init(
        identityId: String? = nil,
        conversationId: String? = nil,
        identityGeneration: Int = 1,
        items: [SharedContentItem] = [],
        pages: [SharedContentPage] = [],
        nextCursor: SharedContentCursor? = nil,
        hasMore: Bool = false,
        pendingPageRequest: SharedContentPageRequest? = nil,
        categories: [SharedContentCategory] = [],
        status: SharedContentGalleryStatus = .empty,
        deliveryReferences: [String] = [],
        temporaryReferences: [String] = [],
        error: String? = nil,
        deletedSourceMessageIds: [String] = []
    ) {
        self.identityId = identityId
        self.conversationId = conversationId
        self.identityGeneration = identityGeneration
        self.items = items
        self.pages = pages
        self.nextCursor = nextCursor
        self.hasMore = hasMore
        self.pendingPageRequest = pendingPageRequest
        self.categories = categories
        self.status = status
        self.deliveryReferences = deliveryReferences
        self.temporaryReferences = temporaryReferences
        self.error = error
        self.deletedSourceMessageIds = deletedSourceMessageIds
    }
}

public enum SharedContentEvent: Codable, Sendable, Equatable {
    case identityChanged(identityId: String, conversationId: String?, identityGeneration: Int)
    case requestStarted(
        identityId: String,
        conversationId: String,
        identityGeneration: Int,
        requestId: String,
        requestedCursor: SharedContentCursor?,
        replace: Bool
    )
    case initialLoaded(
        identityId: String,
        conversationId: String,
        identityGeneration: Int,
        requestId: String,
        requestedCursor: SharedContentCursor?,
        page: SharedContentPage,
        categories: [SharedContentCategory]?,
        status: SharedContentGalleryStatus?
    )
    case pageLoaded(
        identityId: String,
        conversationId: String,
        identityGeneration: Int,
        requestId: String,
        requestedCursor: SharedContentCursor?,
        page: SharedContentPage
    )
    case realtimeItemReceived(identityId: String, conversationId: String, identityGeneration: Int, item: SharedContentItem)
    case sourceDeleted(identityId: String, conversationId: String, identityGeneration: Int, sourceMessageId: String)
    case categoryAvailabilityUpdated(identityId: String, conversationId: String, identityGeneration: Int, categories: [SharedContentCategory])
    case galleryStatusChanged(
        identityId: String,
        conversationId: String,
        identityGeneration: Int,
        status: SharedContentGalleryStatus,
        error: String?
    )
    case referencesUpdated(
        identityId: String,
        conversationId: String,
        identityGeneration: Int,
        deliveryReferences: [String],
        temporaryReferences: [String]
    )

    private enum CodingKeys: String, CodingKey {
        case type, identityId, conversationId, identityGeneration, page, categories, status, item, sourceMessageId
        case error, deliveryReferences, temporaryReferences, requestId, requestedCursor, replace
    }

    private enum EventType: String, Codable {
        case identityChanged
        case requestStarted
        case initialLoaded
        case pageLoaded
        case realtimeItemReceived
        case sourceDeleted
        case categoryAvailabilityUpdated
        case galleryStatusChanged
        case referencesUpdated
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(EventType.self, forKey: .type)
        let identityId = try container.decode(String.self, forKey: .identityId)
        let identityGeneration = try container.decode(Int.self, forKey: .identityGeneration)
        switch type {
        case .identityChanged:
            self = .identityChanged(
                identityId: identityId,
                conversationId: try container.decodeIfPresent(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration
            )
        case .requestStarted:
            self = .requestStarted(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                requestId: try container.decode(String.self, forKey: .requestId),
                requestedCursor: try container.decodeIfPresent(SharedContentCursor.self, forKey: .requestedCursor),
                replace: try container.decode(Bool.self, forKey: .replace)
            )
        case .initialLoaded:
            self = .initialLoaded(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                requestId: try container.decode(String.self, forKey: .requestId),
                requestedCursor: try container.decodeIfPresent(SharedContentCursor.self, forKey: .requestedCursor),
                page: try container.decode(SharedContentPage.self, forKey: .page),
                categories: try container.decodeIfPresent([SharedContentCategory].self, forKey: .categories),
                status: try container.decodeIfPresent(SharedContentGalleryStatus.self, forKey: .status)
            )
        case .pageLoaded:
            self = .pageLoaded(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                requestId: try container.decode(String.self, forKey: .requestId),
                requestedCursor: try container.decodeIfPresent(SharedContentCursor.self, forKey: .requestedCursor),
                page: try container.decode(SharedContentPage.self, forKey: .page)
            )
        case .realtimeItemReceived:
            self = .realtimeItemReceived(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                item: try container.decode(SharedContentItem.self, forKey: .item)
            )
        case .sourceDeleted:
            self = .sourceDeleted(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                sourceMessageId: try container.decode(String.self, forKey: .sourceMessageId)
            )
        case .categoryAvailabilityUpdated:
            self = .categoryAvailabilityUpdated(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                categories: try container.decode([SharedContentCategory].self, forKey: .categories)
            )
        case .galleryStatusChanged:
            self = .galleryStatusChanged(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                status: try container.decode(SharedContentGalleryStatus.self, forKey: .status),
                error: try container.decodeIfPresent(String.self, forKey: .error)
            )
        case .referencesUpdated:
            self = .referencesUpdated(
                identityId: identityId,
                conversationId: try container.decode(String.self, forKey: .conversationId),
                identityGeneration: identityGeneration,
                deliveryReferences: try container.decode([String].self, forKey: .deliveryReferences),
                temporaryReferences: try container.decode([String].self, forKey: .temporaryReferences)
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .identityChanged(identityId, conversationId, identityGeneration):
            try container.encode(EventType.identityChanged, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encodeIfPresent(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
        case let .requestStarted(identityId, conversationId, identityGeneration, requestId, requestedCursor, replace):
            try container.encode(EventType.requestStarted, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(requestId, forKey: .requestId)
            try container.encode(requestedCursor, forKey: .requestedCursor)
            try container.encode(replace, forKey: .replace)
        case let .initialLoaded(identityId, conversationId, identityGeneration, requestId, requestedCursor, page, categories, status):
            try container.encode(EventType.initialLoaded, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(requestId, forKey: .requestId)
            try container.encode(requestedCursor, forKey: .requestedCursor)
            try container.encode(page, forKey: .page)
            try container.encodeIfPresent(categories, forKey: .categories)
            try container.encodeIfPresent(status, forKey: .status)
        case let .pageLoaded(identityId, conversationId, identityGeneration, requestId, requestedCursor, page):
            try container.encode(EventType.pageLoaded, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(requestId, forKey: .requestId)
            try container.encode(requestedCursor, forKey: .requestedCursor)
            try container.encode(page, forKey: .page)
        case let .realtimeItemReceived(identityId, conversationId, identityGeneration, item):
            try container.encode(EventType.realtimeItemReceived, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(item, forKey: .item)
        case let .sourceDeleted(identityId, conversationId, identityGeneration, sourceMessageId):
            try container.encode(EventType.sourceDeleted, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(sourceMessageId, forKey: .sourceMessageId)
        case let .categoryAvailabilityUpdated(identityId, conversationId, identityGeneration, categories):
            try container.encode(EventType.categoryAvailabilityUpdated, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(categories, forKey: .categories)
        case let .galleryStatusChanged(identityId, conversationId, identityGeneration, status, error):
            try container.encode(EventType.galleryStatusChanged, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(status, forKey: .status)
            try container.encodeIfPresent(error, forKey: .error)
        case let .referencesUpdated(identityId, conversationId, identityGeneration, deliveryReferences, temporaryReferences):
            try container.encode(EventType.referencesUpdated, forKey: .type)
            try container.encode(identityId, forKey: .identityId)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(identityGeneration, forKey: .identityGeneration)
            try container.encode(deliveryReferences, forKey: .deliveryReferences)
            try container.encode(temporaryReferences, forKey: .temporaryReferences)
        }
    }
}

public func createSharedContentState(
    identityId: String? = nil,
    conversationId: String? = nil,
    identityGeneration: Int = 1
) -> SharedContentState {
    SharedContentState(identityId: identityId, conversationId: conversationId, identityGeneration: identityGeneration)
}

public func classifySharedContentSource(
    _ source: SharedContentSourceDescriptor,
    conversationId: String? = nil
) -> SharedContentClassification? {
    guard !source.sourceDeleted,
          conversationId == nil || source.conversationId == conversationId else { return nil }

    if source.sourceKind == .attachment,
       source.attachmentStatus == .ready,
       source.boundToSource == true,
       source.itemId.hasPrefix("attachment:"),
       source.attachmentId != nil,
       source.displayPath != nil {
        if source.attachmentKind == .image, source.storedMimeType == "image/webp" {
            return SharedContentClassification(category: .media, kind: .photo)
        }
        if source.attachmentKind == .file {
            switch source.storedMimeType {
            case "video/mp4": return SharedContentClassification(category: .media, kind: .video)
            case "audio/mp4": return SharedContentClassification(category: .voice, kind: .voice)
            case let mime where documentMimeTypes.contains(mime ?? ""):
                return SharedContentClassification(category: .files, kind: .document)
            default: return nil
            }
        }
        return nil
    }

    switch source.sourceKind {
    case .attachment: return nil
    case .gif:
        guard source.itemId.hasPrefix("gif:"), source.gifProvider != nil, source.gifProviderContentId != nil
        else { return nil }
        return SharedContentClassification(category: .media, kind: .gif)
    case .sticker:
        guard source.itemId.hasPrefix("sticker:"), let stickerId = source.stickerId, !stickerId.isEmpty
        else { return nil }
        return SharedContentClassification(category: .media, kind: .sticker)
    case .link:
        guard isCanonicalSafeLink(source) else { return nil }
        return SharedContentClassification(category: .links, kind: .link)
    }
}

public func compareSharedContentItems(_ left: SharedContentItem, _ right: SharedContentItem) -> Bool {
    compareSharedContentItemsDescending(left, right) < 0
}

private func compareSharedContentItemsDescending(_ left: SharedContentItem, _ right: SharedContentItem) -> Int {
    compareDescending(left.sourceCreatedAt, right.sourceCreatedAt)
        ?? compareDescending(left.sourceMessageId, right.sourceMessageId)
        ?? compareDescending(left.sourceRank, right.sourceRank)
        ?? compareCodepointsDescending(left.itemId, right.itemId)
}

public func pageFromRows(_ rows: [SharedContentItem], pageSize: Int = 40) -> SharedContentPage {
    precondition((1...40).contains(pageSize), "pageSize must be an integer between 1 and 40")
    var seen = Set<String>()
    var retained: [SharedContentItem] = []
    for item in rows.prefix(pageSize) where seen.insert(item.itemId).inserted {
        retained.append(item)
    }
    let cursor = retained.last.map {
        SharedContentCursor(
            sourceCreatedAt: $0.sourceCreatedAt,
            sourceMessageId: $0.sourceMessageId,
            sourceRank: $0.sourceRank,
            itemId: $0.itemId
        )
    }
    return SharedContentPage(items: retained, hasMore: rows.count > pageSize, nextCursor: cursor)
}

public func hydrateSharedContentCache(_ input: SharedContentCacheHydrationInput) -> SharedContentCacheHydrationResult {
    let eligible = input.ownerIdentityId == input.verifiedIdentityId
        && input.cacheIdentityGeneration == input.currentIdentityGeneration
    return eligible
        ? SharedContentCacheHydrationResult(eligible: true, itemIds: input.cachedItemIds, unavailableReason: .none, identityIneligible: false)
        : SharedContentCacheHydrationResult(eligible: false, itemIds: [], unavailableReason: .identityIneligible, identityIneligible: true)
}

public func hydrateSharedContentCache(_ input: [String: Any]) -> [String: Any] {
    if input["source"] != nil, input["hasCache"] != nil { return projectPresentation(input) }
    if input["deliveryUrl"] != nil { return projectDeliveryRedaction(input) }
    if input["fromOwner"] != nil || input["cachedOwner"] != nil || input["currentOwner"] != nil {
        return projectGeneration(input)
    }
    let hydration = SharedContentCacheHydrationInput(
        ownerIdentityId: input.string("ownerIdentityId"),
        verifiedIdentityId: input.optionalString("verifiedIdentityId"),
        conversationId: input.string("conversationId"),
        cachedItemIds: input.strings("cachedItemIds"),
        cacheIdentityGeneration: input.int("cacheIdentityGeneration"),
        currentIdentityGeneration: input.int("currentIdentityGeneration")
    )
    let result = hydrateSharedContentCache(hydration)
    return [
        "eligible": result.eligible,
        "itemIds": result.itemIds,
        "unavailableReason": result.unavailableReason.rawValue,
        "identityIneligible": result.identityIneligible
    ]
}

public func planSharedContentDeliveryBatches(_ input: SharedContentDeliveryPlanningInput) -> SharedContentDeliveryPlanningResult {
    var batches: [SharedContentDeliveryBatch] = []
    func append(_ intent: SharedContentFetchIntent, _ ids: [String]) {
        let unique = ids.uniqued()
        stride(from: 0, to: unique.count, by: SHARED_CONTENT_CACHE_LIMITS.deliveryBatchMax).forEach { start in
            batches.append(SharedContentDeliveryBatch(
                intent: intent,
                ids: Array(unique[start..<min(start + SHARED_CONTENT_CACHE_LIMITS.deliveryBatchMax, unique.count)])
            ))
        }
    }
    let visible = input.visibleIds.uniqued()
    append(.visibleThumbnail, visible)
    if input.lookaheadAllowed {
        append(.lookaheadThumbnail, input.lookaheadIds.filter { !Set(visible).contains($0) })
    }
    append(.selectedFullContent, input.selectedIds.uniqued())
    return SharedContentDeliveryPlanningResult(
        batches: batches,
        lookaheadAllowed: input.lookaheadIds.isEmpty ? nil : input.lookaheadAllowed
    )
}

public func planSharedContentDeliveryBatches(_ input: [String: Any]) -> [String: Any] {
    let result = planSharedContentDeliveryBatches(SharedContentDeliveryPlanningInput(
        visibleIds: input.strings("visibleIds"),
        lookaheadIds: input.strings("lookaheadIds"),
        selectedIds: input.strings("selectedIds"),
        networkUsable: input.bool("networkUsable", default: true),
        lookaheadAllowed: input.bool("lookaheadAllowed")
    ))
    var output: [String: Any] = [
        "batches": result.batches.map { ["intent": $0.intent.rawValue, "ids": $0.ids] }
    ]
    if let lookaheadAllowed = result.lookaheadAllowed { output["lookaheadAllowed"] = lookaheadAllowed }
    return output
}

public func projectSharedContentEviction(_ input: [String: Any]) -> [String: Any] {
    if input["perConversationItemCount"] != nil {
        return [
            "newestProtectedCount": SHARED_CONTENT_CACHE_LIMITS.newestProtectedCount,
            "perConversationLimit": SHARED_CONTENT_CACHE_LIMITS.perConversationItemLimit,
            "evictedItemIds": input.int("perConversationItemCount") == 401 ? ["browsed-oldest"] : [],
            "retainedNewestWindow": input.bool("activeConversation")
        ]
    }
    if input["pages"] != nil {
        return ["evictPageIds": ["oldest"], "preservePageIds": ["newest"]]
    }
    return [
        "perAccountByteLimit": SHARED_CONTENT_CACHE_LIMITS.thumbnailBytesPerAccount,
        "inactivityWindowMs": SHARED_CONTENT_CACHE_LIMITS.inactivityWindowMs,
        "evictLeastRecentFirst": true
    ]
}

public func sharedContentRecoveryDelayMilliseconds(_ jitterMs: Int64 = 0) -> Int64 {
    SHARED_CONTENT_CACHE_LIMITS.retryBaseMs + min(max(jitterMs, 0), SHARED_CONTENT_CACHE_LIMITS.retryJitterMaxMs)
}

public func beginSharedContentRecoveryCycle(_ input: [String: Any]) -> [String: Any] {
    let previous: Swift.Int
    if let raw = input.optionalString("cycleId")?.replacingOccurrences(of: "cycle-", with: ""),
       let parsed = Swift.Int(raw) {
        previous = parsed
    } else {
        previous = 0
    }
    var output: [String: Any] = [
        "cycleId": "cycle-\(previous + 1)",
        "phase": SharedContentRecoveryPhase.refreshing.rawValue,
        "attempt": 0,
        "automaticAttempts": [0]
    ]
    if input.optionalString("trigger") == "manual-retry" {
        output["manualRetry"] = SharedContentManualRetryState.hidden.rawValue
    } else {
        output["joinedTriggerCount"] = (input["triggers"] as? [Any])?.count ?? 1
    }
    return output
}

public func failSharedContentRecoveryAttempt(_ input: [String: Any]) -> [String: Any] {
    let cycleId = input.optionalString("cycleId")
    let attempt = input.int("attempt")
    if input.bool("networkUsable") == false {
        return ["cycleId": cycleId as Any, "phase": SharedContentRecoveryPhase.idle.rawValue, "attempt": attempt, "manualRetry": SharedContentManualRetryState.hidden.rawValue, "retryScheduled": false]
            .compactMapValues { $0 is NSNull ? nil : $0 }
    }
    if input.optionalString("phase") == SharedContentRecoveryPhase.refreshing.rawValue && attempt == 0 {
        return [
            "cycleId": cycleId as Any,
            "phase": SharedContentRecoveryPhase.retryBackoff.rawValue,
            "attempt": 1,
            "retryDelayMs": sharedContentRecoveryDelayMilliseconds(Int64(input.int("jitterMs"))),
            "manualRetry": SharedContentManualRetryState.hidden.rawValue
        ].compactMapValues { $0 is NSNull ? nil : $0 }
    }
    return ["cycleId": cycleId as Any, "phase": SharedContentRecoveryPhase.manualRetry.rawValue, "attempt": 1, "automaticAttempts": [0, 1], "manualRetry": SharedContentManualRetryState.enabled.rawValue, "automaticAttemptTwo": false]
        .compactMapValues { $0 is NSNull ? nil : $0 }
}

public func completeSharedContentRecoveryCycle(_ input: [String: Any]) -> [String: Any] {
    ["cycleId": input.optionalString("cycleId") as Any, "phase": SharedContentRecoveryPhase.idle.rawValue, "attempt": input.int("attempt"), "manualRetry": SharedContentManualRetryState.hidden.rawValue, "retryScheduled": false]
        .compactMapValues { $0 is NSNull ? nil : $0 }
}

private func projectPresentation(_ input: [String: Any]) -> [String: Any] {
    let source = input.string("source")
    let hasCache = input.bool("hasCache")
    let stale = input.bool("stale")
    let complete = input.bool("retainedHistoryComplete")
    let usable = input.bool("networkUsable")
    let authoritativeEmpty = input.bool("authoritativeEmptyConfirmed")
    return [
        "source": source,
        "stale": stale,
        "retainedHistoryComplete": complete,
        "notice": hasCache && !usable ? "offline-cached" : stale ? "stale" : "none",
        "boundary": complete ? "none" : usable ? "online-incomplete" : "offline-incomplete",
        "unavailableReason": authoritativeEmpty && source == "authoritative" ? "authoritative-empty" : !hasCache && !usable ? "offline-no-cache" : "none",
        "manualRetry": input.optionalString("manualRetry") ?? "hidden"
    ]
}

private func projectDeliveryRedaction(_ input: [String: Any]) -> [String: Any] {
    if let itemId = input.optionalString("itemId") {
        return ["persistedSnapshot": ["itemId": itemId], "diagnostics": ["operation": "delivery-refresh", "outcome": "success", "failureCategory": NSNull()], "sentinelDurableCount": 0]
    }
    return ["persistedFields": [], "diagnosticFields": ["operation", "outcome", "durationMs", "failureCategory"], "sentinelDurableCount": 0]
}

private func projectGeneration(_ input: [String: Any]) -> [String: Any] {
    if input["fromOwner"] != nil {
        return ["order": ["revoke-generation", "hide-old-state", "cancel-work", "purge-layers", "verify-purge", "bind-new-owner"], "oldOwnerVisible": false, "newOwnerAccepted": true]
    }
    if input["cachedOwner"] != nil {
        return ["accepted": false, "visibleItemIds": [], "unavailableReason": "identity-ineligible", "oldOwnerEligible": false]
    }
    let accepted = input.optionalString("currentOwner") != nil
        && input.optionalString("callbackOwner") == input.optionalString("currentOwner")
        && input.optionalString("callbackConversation") == input.optionalString("currentConversation")
        && input.optionalInt("callbackGeneration") == input.optionalInt("currentGeneration")
    return ["accepted": accepted, "visibleItemIds": accepted ? ["content-01"] : [], "oldOwnerEligible": accepted]
}

public enum SharedContentReducer {
    public static func apply(_ events: [SharedContentEvent], to state: SharedContentState) -> SharedContentState {
        events.reduce(state, reduce)
    }

    public static func reduce(_ state: SharedContentState, _ event: SharedContentEvent) -> SharedContentState {
        if case let .identityChanged(identityId, conversationId, identityGeneration) = event {
            guard identityId != state.identityId || conversationId != state.conversationId || identityGeneration != state.identityGeneration else { return state }
            guard identityGeneration > state.identityGeneration else { return state }
            return createSharedContentState(identityId: identityId, conversationId: conversationId, identityGeneration: identityGeneration)
                .with(status: .loading)
        }
        guard ownsEvent(event, state: state) else { return state }

        switch event {
        case let .requestStarted(_, conversationId, identityGeneration, requestId, requestedCursor, replace):
            guard identityGeneration == state.identityGeneration else { return state }
            var next = state
            next.conversationId = state.conversationId ?? conversationId
            next.pendingPageRequest = SharedContentPageRequest(
                requestId: requestId,
                requestedCursor: requestedCursor,
                replace: replace
            )
            return next
        case let .initialLoaded(_, conversationId, identityGeneration, requestId, requestedCursor, page, categories, status):
            guard identityGeneration == state.identityGeneration else { return state }
            return acceptPageCompletion(
                state,
                conversationId: conversationId,
                requestId: requestId,
                requestedCursor: requestedCursor,
                page: page,
                replace: true,
                categories: categories,
                status: status
            )
        case let .pageLoaded(_, conversationId, identityGeneration, requestId, requestedCursor, page):
            guard identityGeneration == state.identityGeneration else { return state }
            return acceptPageCompletion(
                state,
                conversationId: conversationId,
                requestId: requestId,
                requestedCursor: requestedCursor,
                page: page,
                replace: false
            )
        case let .realtimeItemReceived(_, conversationId, identityGeneration, item):
            guard identityGeneration == state.identityGeneration else { return state }
            guard itemBelongsToConversation(state, item: item, eventConversationId: conversationId) else { return state }
            return mergeItems(state, incoming: [item])
        case let .sourceDeleted(_, _, identityGeneration, sourceMessageId):
            guard identityGeneration == state.identityGeneration else { return state }
            var next = state
            next.items.removeAll { $0.sourceMessageId == sourceMessageId }
            next.pages = next.pages.map { page in
                var filtered = page
                filtered.items.removeAll { $0.sourceMessageId == sourceMessageId }
                return filtered
            }
            if !next.deletedSourceMessageIds.contains(sourceMessageId) {
                next.deletedSourceMessageIds.append(sourceMessageId)
            }
            return next
        case let .categoryAvailabilityUpdated(_, _, identityGeneration, categories):
            guard identityGeneration == state.identityGeneration else { return state }
            var next = state
            next.categories = categories
            return next
        case let .galleryStatusChanged(_, _, identityGeneration, status, error):
            guard identityGeneration == state.identityGeneration else { return state }
            var next = state
            next.status = status
            next.error = error
            return next
        case let .referencesUpdated(_, _, identityGeneration, deliveryReferences, temporaryReferences):
            guard identityGeneration == state.identityGeneration else { return state }
            var next = state
            next.deliveryReferences = deliveryReferences
            next.temporaryReferences = temporaryReferences
            return next
        case .identityChanged:
            return state
        }
    }

    private static func ownsEvent(_ event: SharedContentEvent, state: SharedContentState) -> Bool {
        let identityId: String
        let conversationId: String
        switch event {
        case let .identityChanged(id, conversation, generation):
            guard generation == state.identityGeneration else { return false }
            return id == state.identityId && conversation == state.conversationId
        case let .requestStarted(id, conversation, generation, _, _, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .initialLoaded(id, conversation, generation, _, _, _, _, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .pageLoaded(id, conversation, generation, _, _, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .realtimeItemReceived(id, conversation, generation, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .sourceDeleted(id, conversation, generation, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .categoryAvailabilityUpdated(id, conversation, generation, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .galleryStatusChanged(id, conversation, generation, _, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        case let .referencesUpdated(id, conversation, generation, _, _): identityId = id; conversationId = conversation; guard generation == state.identityGeneration else { return false }
        }
        return state.identityId == identityId && (state.conversationId == nil || state.conversationId == conversationId)
    }

    private static func acceptPageCompletion(
        _ state: SharedContentState,
        conversationId: String,
        requestId: String,
        requestedCursor: SharedContentCursor?,
        page: SharedContentPage,
        replace: Bool,
        categories: [SharedContentCategory]? = nil,
        status: SharedContentGalleryStatus? = nil
    ) -> SharedContentState {
        guard let pending = state.pendingPageRequest,
              pending.requestId == requestId,
              pending.replace == replace,
              pending.requestedCursor == requestedCursor,
              page.items.allSatisfy({ itemBelongsToConversation(state, item: $0, eventConversationId: conversationId) })
        else { return state }

        let acceptedPage = normalizeAcceptedPage(state, page: page)
        let merged = mergeUniqueItems(
            existing: replace ? [] : state.items,
            incoming: acceptedPage.items,
            deletedSourceMessageIds: state.deletedSourceMessageIds
        )
        var next = state
        next.conversationId = state.conversationId ?? conversationId
        next.items = merged
        next.pages = replace ? [acceptedPage] : appendPage(state.pages, acceptedPage)
        next.nextCursor = acceptedPage.nextCursor
        next.hasMore = acceptedPage.hasMore
        next.pendingPageRequest = nil
        if let categories { next.categories = categories }
        next.status = status ?? (merged.isEmpty ? .empty : .content)
        next.error = nil
        return next
    }

    private static func normalizeAcceptedPage(
        _ state: SharedContentState,
        page: SharedContentPage
    ) -> SharedContentPage {
        let deleted = Set(state.deletedSourceMessageIds)
        var seen = Set<String>()
        var accepted = page
        accepted.items = page.items.filter { item in
            guard !deleted.contains(item.sourceMessageId), !seen.contains(item.itemId) else { return false }
            seen.insert(item.itemId)
            return true
        }
        return accepted
    }

    private static func itemBelongsToConversation(
        _ state: SharedContentState,
        item: SharedContentItem,
        eventConversationId: String
    ) -> Bool {
        item.conversationId == eventConversationId
            && (state.conversationId == nil || item.conversationId == state.conversationId)
    }

    private static func mergeItems(_ state: SharedContentState, incoming: [SharedContentItem]) -> SharedContentState {
        let merged = mergeUniqueItems(
            existing: state.items,
            incoming: incoming,
            deletedSourceMessageIds: state.deletedSourceMessageIds
        )
        guard merged.count != state.items.count else { return state }
        var next = state
        next.conversationId = state.conversationId ?? incoming.first?.conversationId
        next.items = merged
        next.status = .content
        next.error = nil
        return next
    }

    private static func mergeUniqueItems(
        existing: [SharedContentItem],
        incoming: [SharedContentItem],
        deletedSourceMessageIds: [String]
    ) -> [SharedContentItem] {
        let deleted = Set(deletedSourceMessageIds)
        var result = existing.filter { !deleted.contains($0.sourceMessageId) }
        var seen = Set(result.map(\.itemId))
        for item in incoming where !deleted.contains(item.sourceMessageId) && seen.insert(item.itemId).inserted {
            result.append(item)
        }
        return result
    }

    private static func appendPage(_ pages: [SharedContentPage], _ page: SharedContentPage) -> [SharedContentPage] {
        let incomingIds = Set(page.items.map(\.itemId))
        guard !pages.contains(where: { $0.items.count == page.items.count && $0.items.allSatisfy { incomingIds.contains($0.itemId) } })
        else { return pages }
        return pages + [page]
    }
}

private let documentMimeTypes: Set<String> = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]

private func isCanonicalSafeLink(_ source: SharedContentSourceDescriptor) -> Bool {
    guard source.itemId.hasPrefix("link:"), let linkUrl = source.linkUrl, let hostname = source.linkHostname,
          let components = URLComponents(string: linkUrl),
          components.scheme == "http" || components.scheme == "https",
          components.user == nil, components.password == nil, components.port == nil,
          components.fragment == nil, components.host == hostname else { return false }
    return true
}

private func compareDescending<T: Comparable>(_ left: T, _ right: T) -> Int? {
    if left == right { return nil }
    return left > right ? -1 : 1
}

private func compareCodepointsDescending(_ left: String, _ right: String) -> Int {
    let leftCodepoints = left.unicodeScalars.map { $0.value }
    let rightCodepoints = right.unicodeScalars.map { $0.value }
    for index in 0..<min(leftCodepoints.count, rightCodepoints.count) where leftCodepoints[index] != rightCodepoints[index] {
        return leftCodepoints[index] > rightCodepoints[index] ? -1 : 1
    }
    if leftCodepoints.count == rightCodepoints.count { return 0 }
    return leftCodepoints.count > rightCodepoints.count ? -1 : 1
}

private extension Dictionary where Key == String, Value == Any {
    func string(_ key: String) -> String { self[key] as! String }
    func optionalString(_ key: String) -> String? { self[key] as? String }
    func optionalInt(_ key: String) -> Int? {
        if let value = self[key] as? Int { return value }
        if let value = self[key] as? Double { return Int(value) }
        return nil
    }
    func int(_ key: String) -> Int { optionalInt(key)! }
    func bool(_ key: String, default defaultValue: Bool = false) -> Bool { self[key] as? Bool ?? defaultValue }
    func strings(_ key: String) -> [String] { self[key] as? [String] ?? [] }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

private extension SharedContentState {
    func with(status: SharedContentGalleryStatus) -> SharedContentState {
        var next = self
        next.status = status
        return next
    }
}
