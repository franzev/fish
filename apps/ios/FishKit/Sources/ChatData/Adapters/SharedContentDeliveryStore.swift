import Foundation

/// The only URLSession configuration permitted for short-lived shared-content
/// delivery. It intentionally has no response cache, cookie jar, or credential
/// store because delivery URLs are authority-bearing runtime values.
public enum SharedContentEphemeralSession {
    public static func configuration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return configuration
    }

    public static func make() -> URLSession {
        URLSession(configuration: configuration())
    }
}

/// A live delivery lease. This value is deliberately not Codable and its
/// description omits every URL so it cannot become a persistence or logging
/// surface by accident.
public struct SharedContentDeliveryLease: Equatable, Sendable, CustomStringConvertible {
    public let attachmentId: String
    public let thumbnailUrl: URL?
    public let displayUrl: URL?
    public let expiresAt: Date
    public let opaqueKey: String

    public init(
        attachmentId: String,
        thumbnailUrl: URL?,
        displayUrl: URL?,
        expiresAt: Date,
        opaqueKey: String? = nil
    ) {
        self.attachmentId = attachmentId
        self.thumbnailUrl = thumbnailUrl
        self.displayUrl = displayUrl
        self.expiresAt = expiresAt
        self.opaqueKey = opaqueKey ?? attachmentId
    }

    public func isFresh(
        at now: Date,
        freshnessMargin: TimeInterval = SharedContentDeliveryStore.freshnessMargin
    ) -> Bool {
        expiresAt > now.addingTimeInterval(freshnessMargin)
    }

    public var description: String {
        "SharedContentDeliveryLease(attachmentId=\(attachmentId), expiresAt=\(expiresAt))"
    }
}

/// Generation-scoped in-memory delivery leases for one verified owner and
/// conversation. Refresh calls are serialized by the actor and are sent in
/// the existing Edge Function's maximum 50-ID batches.
public actor SharedContentDeliveryStore {
    public static let freshnessMargin: TimeInterval = 120
    public static let defaultLeaseLifetime: TimeInterval = 15 * 60
    public static let maximumRefreshBatch = 50
    public static let maximumLeaseCount = 400

    public nonisolated let ownerIdentityId: String
    public nonisolated let conversationId: String
    public nonisolated let identityGeneration: Int

    private let refreshAttachmentUrls: @Sendable ([String]) async throws -> [SignedAttachmentUrl]
    private let now: @Sendable () -> Date
    private let session: URLSession
    private var leases: [LeaseKey: SharedContentDeliveryLease] = [:]
    private var authorizationRefreshes: Set<LeaseKey> = []
    private var refreshEpoch = 0
    private var revoked = false

    public init(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        refreshAttachmentUrls: @escaping @Sendable ([String]) async throws -> [SignedAttachmentUrl],
        now: @escaping @Sendable () -> Date = Date.init,
        session: URLSession = SharedContentEphemeralSession.make()
    ) {
        precondition(!ownerIdentityId.isEmpty)
        precondition(!conversationId.isEmpty)
        precondition(identityGeneration > 0)
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
        self.identityGeneration = identityGeneration
        self.refreshAttachmentUrls = refreshAttachmentUrls
        self.now = now
        self.session = session
    }

    public init(
        ownerIdentityId: String,
        conversationId: String,
        identityGeneration: Int,
        commands: any AttachmentCommandProviding,
        now: @escaping @Sendable () -> Date = Date.init,
        session: URLSession = SharedContentEphemeralSession.make()
    ) {
        self.init(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            identityGeneration: identityGeneration,
            refreshAttachmentUrls: { ids in try await commands.refreshUrls(attachmentIds: ids) },
            now: now,
            session: session
        )
    }

    /// Resolves only absent or expiring leases. Empty and duplicate IDs do not
    /// reach the provider, and no lease URL leaves this actor's memory.
    public func resolve(
        attachmentIds: [String]
    ) async throws -> [String: SharedContentDeliveryLease] {
        guard !revoked else { throw CancellationError() }
        let uniqueIds = attachmentIds
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .uniquedPreservingOrder()
        guard !uniqueIds.isEmpty else { return [:] }

        let observedAt = now()
        let missingIds = uniqueIds.filter { id in
            leases[key(for: id)]?.isFresh(at: observedAt) != true
        }

        for batch in missingIds.chunked(maxCount: Self.maximumRefreshBatch) {
            let expectedEpoch = refreshEpoch
            let deliveries = try await refreshAttachmentUrls(batch)
            guard !revoked, refreshEpoch == expectedEpoch else { throw CancellationError() }
            for delivery in deliveries where batch.contains(delivery.attachmentId) {
                guard delivery.thumbnailUrl != nil || delivery.displayUrl != nil else { continue }
                let key = key(for: delivery.attachmentId)
                leases[key] = SharedContentDeliveryLease(
                    attachmentId: delivery.attachmentId,
                    thumbnailUrl: delivery.thumbnailUrl,
                    displayUrl: delivery.displayUrl,
                    expiresAt: observedAt.addingTimeInterval(Self.defaultLeaseLifetime),
                    opaqueKey: delivery.attachmentId
                )
            }
        }

        trim(observedAt: observedAt)
        return uniqueIds.reduce(into: [:]) { result, id in
            if let lease = leases[key(for: id)] { result[id] = lease }
        }
    }

    public func lease(for attachmentId: String) async throws -> SharedContentDeliveryLease? {
        try await resolve(attachmentIds: [attachmentId])[attachmentId]
    }

    public func invalidate(attachmentId: String) -> Bool {
        leases.removeValue(forKey: key(for: attachmentId)) != nil
    }

    /// The media caller invokes this once after a 401/403. A second call for
    /// the same generation is rejected, preventing refresh loops.
    public func refreshAfterAuthorizationFailure(
        statusCode: Int,
        attachmentId: String
    ) async throws -> SharedContentDeliveryLease? {
        guard statusCode == 401 || statusCode == 403 else { return nil }
        let key = key(for: attachmentId)
        guard authorizationRefreshes.insert(key).inserted else { return nil }
        leases.removeValue(forKey: key)
        return try await lease(for: attachmentId)
    }

    public func clearGeneration(_ generation: Int) -> Int {
        guard generation == identityGeneration else { return 0 }
        let removed = leases.count
        refreshEpoch += 1
        revoked = true
        leases.removeAll()
        authorizationRefreshes.removeAll()
        return removed
    }

    public func clear() -> Int {
        let removed = leases.count
        refreshEpoch += 1
        revoked = true
        leases.removeAll()
        authorizationRefreshes.removeAll()
        return removed
    }

    public var count: Int { leases.count }

    private func key(for attachmentId: String) -> LeaseKey {
        LeaseKey(
            ownerIdentityId: ownerIdentityId,
            conversationId: conversationId,
            identityGeneration: identityGeneration,
            attachmentId: attachmentId.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    private func trim(observedAt: Date) {
        leases = leases.filter { $0.value.isFresh(at: observedAt) }
        while leases.count > Self.maximumLeaseCount,
              let oldest = leases.min(by: { $0.value.expiresAt < $1.value.expiresAt }) {
            leases.removeValue(forKey: oldest.key)
        }
    }

    private struct LeaseKey: Hashable, Sendable {
        let ownerIdentityId: String
        let conversationId: String
        let identityGeneration: Int
        let attachmentId: String
    }
}

private extension Array where Element == String {
    func uniquedPreservingOrder() -> [String] {
        var seen = Set<String>()
        return filter { seen.insert($0).inserted }
    }

    func chunked(maxCount: Int) -> [[String]] {
        guard maxCount > 0 else { return [] }
        return stride(from: 0, to: count, by: maxCount).map { start in
            Array(self[start..<Swift.min(start + maxCount, count)])
        }
    }
}
