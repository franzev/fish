import Foundation

public enum SharedContentCacheSource: String, Codable, Equatable, Sendable {
    case none
    case verifiedDeviceCache = "verified-device-cache"
    case authoritative
}

public enum SharedContentCacheFailure: Error, Equatable, Sendable {
    case invalidInput
    case staleGeneration
    case storeUnavailable
    case protectionUnavailable
    case transactionFailed
}

public struct SharedContentCacheConfiguration: Sendable {
    public let storeURL: URL?
    public let now: @Sendable () -> Date
    public let inMemory: Bool
    public let simulateSaveFailure: Bool

    public let newestProtectedCount: Int
    public let perConversationItemLimit: Int
    public let perAccountItemLimit: Int
    public let inactivityWindow: TimeInterval

    public init(
        storeURL: URL? = nil,
        now: @escaping @Sendable () -> Date = { Date() },
        inMemory: Bool = false,
        simulateSaveFailure: Bool = false,
        newestProtectedCount: Int = 40,
        perConversationItemLimit: Int = 400,
        perAccountItemLimit: Int = 2_000,
        inactivityWindow: TimeInterval = 30 * 24 * 60 * 60
    ) {
        self.storeURL = storeURL
        self.now = now
        self.inMemory = inMemory
        self.simulateSaveFailure = simulateSaveFailure
        self.newestProtectedCount = newestProtectedCount
        self.perConversationItemLimit = perConversationItemLimit
        self.perAccountItemLimit = perAccountItemLimit
        self.inactivityWindow = inactivityWindow
    }

    public static func inMemory(
        now: Date = Date(),
        simulateSaveFailure: Bool = false
    ) -> Self {
        Self(
            now: { now },
            inMemory: true,
            simulateSaveFailure: simulateSaveFailure
        )
    }
}

public struct StoredSharedContentItem: Codable, Equatable, Sendable {
    public let itemId: String
    public let conversationId: String
    public let sourceMessageId: String
    public let senderId: String
    public let sourceCreatedAt: String
    public let sourceRank: Int
    public let category: String
    public let kind: String
    public let attachmentId: String?
    public let attachmentOriginalName: String?
    public let attachmentMimeType: String?
    public let attachmentByteSize: Int64?
    public let attachmentWidth: Int?
    public let attachmentHeight: Int?
    public let durationMs: Int64?
    public let gifProvider: String?
    public let gifProviderContentId: String?
    public let gifTitle: String?
    public let gifDescription: String?
    public let stickerId: String?
    /// Canonical link metadata only; delivery leases and provider references are excluded.
    public let linkMetadataJson: String?

    public init(
        itemId: String,
        conversationId: String,
        sourceMessageId: String,
        senderId: String,
        sourceCreatedAt: String,
        sourceRank: Int,
        category: String,
        kind: String,
        attachmentId: String? = nil,
        attachmentOriginalName: String? = nil,
        attachmentMimeType: String? = nil,
        attachmentByteSize: Int64? = nil,
        attachmentWidth: Int? = nil,
        attachmentHeight: Int? = nil,
        durationMs: Int64? = nil,
        gifProvider: String? = nil,
        gifProviderContentId: String? = nil,
        gifTitle: String? = nil,
        gifDescription: String? = nil,
        stickerId: String? = nil,
        linkMetadataJson: String? = nil
    ) {
        self.itemId = itemId
        self.conversationId = conversationId
        self.sourceMessageId = sourceMessageId
        self.senderId = senderId
        self.sourceCreatedAt = sourceCreatedAt
        self.sourceRank = sourceRank
        self.category = category
        self.kind = kind
        self.attachmentId = attachmentId
        self.attachmentOriginalName = attachmentOriginalName
        self.attachmentMimeType = attachmentMimeType
        self.attachmentByteSize = attachmentByteSize
        self.attachmentWidth = attachmentWidth
        self.attachmentHeight = attachmentHeight
        self.durationMs = durationMs
        self.gifProvider = gifProvider
        self.gifProviderContentId = gifProviderContentId
        self.gifTitle = gifTitle
        self.gifDescription = gifDescription
        self.stickerId = stickerId
        self.linkMetadataJson = linkMetadataJson
    }
}

public struct StoredSharedContentSnapshot: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let ownerIdentityId: String
    public let conversationId: String
    public let items: [StoredSharedContentItem]
    public let source: SharedContentCacheSource
    public let stale: Bool
    public let retainedHistoryComplete: Bool
    public let authoritativeEmptyConfirmed: Bool
    public let retainedOldestCursor: String?
    public let newestWindowProtected: Bool

    public init(
        schemaVersion: Int,
        ownerIdentityId: String,
        conversationId: String,
        items: [StoredSharedContentItem],
        source: SharedContentCacheSource,
        stale: Bool,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool,
        retainedOldestCursor: String?,
        newestWindowProtected: Bool
    ) {
        self.schemaVersion = schemaVersion
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
        self.items = items
        self.source = source
        self.stale = stale
        self.retainedHistoryComplete = retainedHistoryComplete
        self.authoritativeEmptyConfirmed = authoritativeEmptyConfirmed
        self.retainedOldestCursor = retainedOldestCursor
        self.newestWindowProtected = newestWindowProtected
    }
}

public protocol SharedContentCaching: Sendable {
    func revokeIdentityGeneration(through generation: Int) async

    func hydrateVerifiedOwner(
        verifiedOwnerId: String?,
        conversationId: String
    ) async throws -> StoredSharedContentSnapshot?

    func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String?,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool
    ) async throws

    func appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws

    func appendBrowsedPageAllocatingOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        pageId: String,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws -> Int

    func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String?,
        retainedHistoryComplete: Bool,
        authoritativeEmptyConfirmed: Bool
    ) async throws

    func appendBrowsedPage(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        pageOrdinal: Int,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws

    func appendBrowsedPageAllocatingOrdinal(
        ownerIdentityId: String,
        conversationId: String,
        pageId: String,
        retainedCursor: String?,
        items: [StoredSharedContentItem],
        retainedHistoryComplete: Bool
    ) async throws -> Int

    func applyAcceptedTombstones(
        ownerIdentityId: String,
        conversationId: String,
        sourceMessageIds: Set<String>
    ) async throws

    func purgeConversation(ownerIdentityId: String, conversationId: String) async throws
    func purgeOwner(ownerIdentityId: String) async throws

    func verifyOwnerPurged(
        ownerIdentityId: String,
        conversationId: String?
    ) async throws -> Bool

    func sweepNonCurrentOwners(currentOwnerIdentityId: String) async throws
}

public extension SharedContentCaching {
    func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String? = nil,
        retainedHistoryComplete: Bool = true,
        authoritativeEmptyConfirmed: Bool? = nil
    ) async throws {
        try await replaceNewestWindow(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            identityGeneration: identityGeneration,
            items: items,
            retainedOldestCursor: retainedOldestCursor,
            retainedHistoryComplete: retainedHistoryComplete,
            authoritativeEmptyConfirmed: authoritativeEmptyConfirmed ?? items.isEmpty
        )
    }

    func replaceNewestWindow(
        ownerIdentityId: String,
        conversationId: String,
        items: [StoredSharedContentItem],
        retainedOldestCursor: String? = nil,
        retainedHistoryComplete: Bool = true,
        authoritativeEmptyConfirmed: Bool? = nil
    ) async throws {
        try await replaceNewestWindow(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            items: items,
            retainedOldestCursor: retainedOldestCursor,
            retainedHistoryComplete: retainedHistoryComplete,
            authoritativeEmptyConfirmed: authoritativeEmptyConfirmed ?? items.isEmpty
        )
    }
}
