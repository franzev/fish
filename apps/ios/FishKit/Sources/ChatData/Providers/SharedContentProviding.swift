import Foundation

/// The four-field cursor owned by the authorized shared-content RPC.
public struct SharedContentDataCursor: Codable, Sendable, Equatable {
    public let sourceCreatedAt: String
    public let sourceMessageId: String
    public let sourceRank: Int
    public let itemId: String

    public init(
        sourceCreatedAt: String,
        sourceMessageId: String,
        sourceRank: Int,
        itemId: String
    ) {
        self.sourceCreatedAt = sourceCreatedAt
        self.sourceMessageId = sourceMessageId
        self.sourceRank = sourceRank
        self.itemId = itemId
    }
}

/// Safe shared-content metadata returned by ChatData. Delivery leases and
/// runtime request state do not cross this boundary.
public struct SharedContentDataItem: Codable, Sendable, Equatable {
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
    public let attachmentDisplayPath: String?
    public let attachmentThumbnailPath: String?
    public let durationMs: Int64?
    public let gifProvider: String?
    public let gifProviderContentId: String?
    public let gifTitle: String?
    public let gifDescription: String?
    public let stickerId: String?
    public let linkUrl: String?
    public let linkHostname: String?
    public let linkTitle: String?
    public let linkDescription: String?
    public let linkSiteName: String?
    public let canDelete: Bool
    public let canExport: Bool

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
        attachmentDisplayPath: String? = nil,
        attachmentThumbnailPath: String? = nil,
        durationMs: Int64? = nil,
        gifProvider: String? = nil,
        gifProviderContentId: String? = nil,
        gifTitle: String? = nil,
        gifDescription: String? = nil,
        stickerId: String? = nil,
        linkUrl: String? = nil,
        linkHostname: String? = nil,
        linkTitle: String? = nil,
        linkDescription: String? = nil,
        linkSiteName: String? = nil,
        canDelete: Bool,
        canExport: Bool
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
        self.attachmentDisplayPath = attachmentDisplayPath
        self.attachmentThumbnailPath = attachmentThumbnailPath
        self.durationMs = durationMs
        self.gifProvider = gifProvider
        self.gifProviderContentId = gifProviderContentId
        self.gifTitle = gifTitle
        self.gifDescription = gifDescription
        self.stickerId = stickerId
        self.linkUrl = linkUrl
        self.linkHostname = linkHostname
        self.linkTitle = linkTitle
        self.linkDescription = linkDescription
        self.linkSiteName = linkSiteName
        self.canDelete = canDelete
        self.canExport = canExport
    }
}

public struct SharedContentDataPage: Codable, Sendable, Equatable {
    public let items: [SharedContentDataItem]
    public let hasMore: Bool
    public let nextCursor: SharedContentDataCursor?

    public init(
        items: [SharedContentDataItem],
        hasMore: Bool,
        nextCursor: SharedContentDataCursor?
    ) {
        self.items = items
        self.hasMore = hasMore
        self.nextCursor = nextCursor
    }
}

/// Identity and request sequencing carried across the asynchronous boundary.
public struct SharedContentRequestToken: Codable, Sendable, Equatable {
    public let ownerIdentityId: String
    public let conversationId: String
    public let identityGeneration: Int
    public let cycleId: String
    public let requestId: String
    public let requestedCursor: SharedContentDataCursor?
    public let replace: Bool

    public init(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        cycleId: String,
        requestId: String,
        requestedCursor: SharedContentDataCursor? = nil,
        replace: Bool
    ) {
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
        self.identityGeneration = identityGeneration
        self.cycleId = cycleId
        self.requestId = requestId
        self.requestedCursor = requestedCursor
        self.replace = replace
    }
}

public enum SharedContentRepositoryFailure: Error, Codable, Sendable, Equatable, CustomStringConvertible {
    case authentication
    case authorization
    case identityIneligible
    case network
    case invalidResponse
    case cache
    case requestSuperseded
    case invalidInput

    public var description: String {
        switch self {
        case .authentication: "authentication"
        case .authorization: "authorization"
        case .identityIneligible: "identity-ineligible"
        case .network: "network"
        case .invalidResponse: "invalid-response"
        case .cache: "cache"
        case .requestSuperseded: "request-superseded"
        case .invalidInput: "invalid-input"
        }
    }
}

public enum SharedContentRepositoryResult<Value: Sendable>: Sendable {
    case success(Value)
    case failure(SharedContentRepositoryFailure)
}

extension SharedContentRepositoryResult: Equatable where Value: Equatable {}

/// Provider-neutral shared-content repository boundary consumed by PersonalChat.
public protocol SharedContentRepository: Sendable {
    func observeSharedContentSnapshot(
        conversationId: String
    ) -> AsyncStream<StoredSharedContentSnapshot?>

    func refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?
    ) async -> SharedContentRepositoryResult<SharedContentDataPage>

    func refreshSharedContentCategories(
        token: SharedContentRequestToken
    ) async -> SharedContentRepositoryResult<[String]>
}

/// The public provider seam is intentionally identical to the repository port;
/// concrete Supabase/Core Data details stay inside ChatData.
public protocol SharedContentProviding: SharedContentRepository {}

/// Revokes every request older than the supplied application identity
/// generation before purge begins.
public protocol SharedContentGenerationRevoking: Sendable {
    func revokeIdentityGeneration(_ generation: Int) async
}

public extension SharedContentRepository {
    func refreshSharedContent(
        token: SharedContentRequestToken
    ) async -> SharedContentRepositoryResult<SharedContentDataPage> {
        await refreshSharedContent(token: token, category: nil)
    }
}
