import ChatCore
import ChatData
import CryptoKit
import Foundation
import ImageIO
import UIKit

public actor MessageImageLoader {
    public static let shared = MessageImageLoader()

    public struct LoadContext: Sendable, Equatable {
        public let ownerIdentityId: String
        public let identityGeneration: Int
        public let conversationId: String
        public let attachmentId: String
        public let contentVersion: String
        public let intent: SharedContentFetchIntent
        public let targetPixelSize: CGSize

        public init(
            ownerIdentityId: String,
            identityGeneration: Int,
            conversationId: String,
            attachmentId: String,
            contentVersion: String,
            intent: SharedContentFetchIntent,
            targetPixelSize: CGSize
        ) {
            precondition(!ownerIdentityId.isEmpty)
            precondition(identityGeneration > 0)
            precondition(!conversationId.isEmpty)
            precondition(!attachmentId.isEmpty)
            precondition(!contentVersion.isEmpty)
            self.ownerIdentityId = ownerIdentityId
            self.identityGeneration = identityGeneration
            self.conversationId = conversationId
            self.attachmentId = attachmentId
            self.contentVersion = contentVersion
            self.intent = intent
            self.targetPixelSize = targetPixelSize
        }
    }

    private let memory = NSCache<NSString, UIImage>()
    private let session: URLSession
    private let sharedSession: URLSession
    private let cacheRoot: URL
    private let urlPolicy: SharedContentMediaURLPolicy
    private let mediaTransport: SharedContentMediaTransport
    private var inFlight: [RequestIdentity: Task<UIImage, any Error>] = [:]
    private var currentGenerations: [String: Int] = [:]
    private var sharedMemoryIdentities: Set<SharedCacheIdentity> = []

    public init(
        session: URLSession? = nil,
        sharedSession: URLSession = SharedContentEphemeralSession.make(),
        cacheRoot: URL? = nil,
        allowedHost: String? = nil,
        urlPolicy: SharedContentMediaURLPolicy? = nil,
        mediaTransport: SharedContentMediaTransport? = nil,
        mediaResolver: SharedContentDNSResolver = .system,
        requiresPeerValidation: Bool = true
    ) {
        self.session = session ?? URLSession(configuration: .default)
        self.sharedSession = sharedSession
        let resolvedPolicy = urlPolicy ?? SharedContentMediaURLPolicy(
            storageHost: allowedHost
        )
        self.urlPolicy = resolvedPolicy
        self.mediaTransport = mediaTransport ?? SharedContentMediaTransport(
            policy: resolvedPolicy,
            resolver: mediaResolver,
            requiresPeerValidation: requiresPeerValidation
        )
        self.cacheRoot = cacheRoot ?? FileManager.default.urls(
            for: .cachesDirectory,
            in: .userDomainMask
        ).first!.appending(path: "ChatMedia", directoryHint: .isDirectory)
        memory.totalCostLimit = 32 * 1024 * 1024
        try? FileManager.default.createDirectory(
            at: self.cacheRoot,
            withIntermediateDirectories: true
        )
    }

    /// Existing direct-chat image loading keeps its stable storage-path cache
    /// and disk behavior. Shared content uses the overload below so it cannot
    /// fall back to a signed URL or the direct-chat cache.
    public func image(
        storagePath: String,
        url: URL,
        attachmentId: String,
        targetPixelSize: CGSize,
        commands: (any AttachmentCommandProviding)? = nil
    ) async throws -> UIImage {
        let storageKey = storagePath.isEmpty ? url.absoluteString : storagePath
        let maximumPixel = Self.maximumPixel(for: targetPixelSize)
        let requestKey = RequestIdentity.direct("\(storageKey)#\(maximumPixel)")
        let decodeKey = Self.cacheKey(for: requestKey)
        if let cached = memory.object(forKey: decodeKey as NSString) { return cached }
        let diskUrl = cacheRoot.appending(path: Self.cacheKey(for: storageKey))
        if let data = try? Data(contentsOf: diskUrl),
           let image = Self.decode(data, targetPixelSize: targetPixelSize) {
            insert(image, key: decodeKey)
            return image
        }
        if let task = inFlight[requestKey] { return try await task.value }

        let task = Task<UIImage, any Error> {
            let data: Data
            do {
                data = try await self.fetch(url, using: self.session)
            } catch {
                guard let loadError = error as? MessageImageLoadFailure,
                      loadError.isRefreshable,
                      let commands else { throw error }
                let refreshed = try await commands.refreshUrls(attachmentIds: [attachmentId])
                guard let delivery = refreshed.first,
                      let next = storagePath.localizedCaseInsensitiveContains("thumbnail")
                        ? delivery.thumbnailUrl
                        : delivery.displayUrl
                else { throw loadError }
                data = try await self.fetch(next, using: self.session)
            }
            guard let image = Self.decode(data, targetPixelSize: targetPixelSize) else {
                throw MessageImageLoadFailure.invalidImage
            }
            try? data.write(to: diskUrl, options: .atomic)
            return image
        }
        inFlight[requestKey] = task
        defer { inFlight[requestKey] = nil }
        let image = try await task.value
        insert(image, key: decodeKey)
        return image
    }

    public func image(
        url: URL,
        context: LoadContext,
        commands: (any AttachmentCommandProviding)? = nil,
        deliveryStore: SharedContentDeliveryStore? = nil,
        thumbnailStore: SharedContentThumbnailStore? = nil
    ) async throws -> UIImage {
        guard accept(context) else { throw MessageImageLoadFailure.staleGeneration }
        let identity = SharedCacheIdentity(context: context)
        let requestKey = RequestIdentity.shared(identity)
        let decodeKey = Self.cacheKey(for: requestKey)

        if let cached = memory.object(forKey: decodeKey as NSString) { return cached }
        if context.intent != .selectedFullContent,
           let thumbnailStore,
           let bytes = await thumbnailStore.readDisplayed(identity.thumbnailKey),
           let image = Self.decode(bytes.data, targetPixelSize: context.targetPixelSize) {
            guard accept(context) else { throw MessageImageLoadFailure.staleGeneration }
            insert(image, key: decodeKey, identity: identity)
            return image
        }
        if let task = inFlight[requestKey] { return try await task.value }

        let task = Task<UIImage, any Error> {
            let data: Data
            do {
                data = try await self.fetch(url, using: self.sharedSession)
            } catch {
                guard let loadError = error as? MessageImageLoadFailure,
                      loadError.isRefreshable else { throw error }
                let next: URL?
                if let deliveryStore {
                    let lease = try await deliveryStore.refreshAfterAuthorizationFailure(
                        statusCode: 403,
                        attachmentId: context.attachmentId
                    )
                    next = Self.url(for: context.intent, lease: lease)
                } else if let commands {
                    let refreshed = try await commands.refreshUrls(attachmentIds: [context.attachmentId])
                    let delivery = refreshed.first
                    next = Self.url(for: context.intent, delivery: delivery)
                } else {
                    next = nil
                }
                guard let next else { throw loadError }
                data = try await self.fetch(next, using: self.sharedSession)
            }
            guard self.accepts(context),
                  let image = Self.decode(data, targetPixelSize: context.targetPixelSize)
            else {
                throw self.failureFor(context, fallback: .invalidImage)
            }
            if context.intent != .selectedFullContent, let thumbnailStore {
                _ = await thumbnailStore.stage(identity.thumbnailKey, bytes: data, intent: context.intent)
            }
            guard self.accepts(context) else {
                throw MessageImageLoadFailure.staleGeneration
            }
            return image
        }
        inFlight[requestKey] = task
        defer { inFlight[requestKey] = nil }

        do {
            let image = try await task.value
            guard accept(context) else { throw MessageImageLoadFailure.staleGeneration }
            insert(image, key: decodeKey, identity: identity)
            return image
        } catch is CancellationError {
            if !accept(context) { throw MessageImageLoadFailure.staleGeneration }
            throw CancellationError()
        }
    }

    public func image(
        ownerIdentityId: String,
        identityGeneration: Int,
        conversationId: String,
        attachmentId: String,
        contentVersion: String,
        intent: SharedContentFetchIntent,
        url: URL,
        targetPixelSize: CGSize,
        commands: (any AttachmentCommandProviding)? = nil,
        deliveryStore: SharedContentDeliveryStore? = nil,
        thumbnailStore: SharedContentThumbnailStore? = nil
    ) async throws -> UIImage {
        try await image(
            url: url,
            context: LoadContext(
                ownerIdentityId: ownerIdentityId,
                identityGeneration: identityGeneration,
                conversationId: conversationId,
                attachmentId: attachmentId,
                contentVersion: contentVersion,
                intent: intent,
                targetPixelSize: targetPixelSize
            ),
            commands: commands,
            deliveryStore: deliveryStore,
            thumbnailStore: thumbnailStore
        )
    }

    public func cacheIdentity(for context: LoadContext) -> String {
        Self.cacheKey(for: RequestIdentity.shared(SharedCacheIdentity(context: context)))
    }

    /// Binds the newest generation for an owner. Older generations are
    /// cancelled and cannot publish even if URLSession cancellation is delayed.
    @discardableResult
    public func setCurrentGeneration(ownerIdentityId: String, identityGeneration: Int) -> Bool {
        guard identityGeneration > 0,
              identityGeneration >= (currentGenerations[ownerIdentityId] ?? 0)
        else { return false }
        currentGenerations[ownerIdentityId] = identityGeneration
        cancelSharedWork(ownerIdentityId: ownerIdentityId, through: identityGeneration - 1)
        return true
    }

    /// Plan 12-15 uses this generation-addressable cleanup seam during purge.
    public func cancelAndRemove(ownerIdentityId: String, identityGeneration: Int) {
        currentGenerations[ownerIdentityId] = max(
            identityGeneration,
            currentGenerations[ownerIdentityId] ?? identityGeneration
        )
        cancelSharedWork(ownerIdentityId: ownerIdentityId, through: identityGeneration)
        let identities = sharedMemoryIdentities.filter {
            $0.ownerIdentityId == ownerIdentityId && $0.identityGeneration <= identityGeneration
        }
        for identity in identities {
            memory.removeObject(forKey: Self.cacheKey(for: RequestIdentity.shared(identity)) as NSString)
        }
        sharedMemoryIdentities.subtract(identities)
    }

    /// Identity-coordinator spelling that keeps the owner and generation
    /// inseparable at the purge boundary.
    public func cancelAndRemove(ownerGeneration: SharedContentOwnerGeneration) {
        cancelAndRemove(
            ownerIdentityId: ownerGeneration.ownerIdentityId,
            identityGeneration: ownerGeneration.generation
        )
    }

    public func removeAll() {
        inFlight.values.forEach { $0.cancel() }
        inFlight.removeAll()
        memory.removeAllObjects()
        currentGenerations.removeAll()
        sharedMemoryIdentities.removeAll()
        try? FileManager.default.removeItem(at: cacheRoot)
        try? FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
    }

    private func accept(_ context: LoadContext) -> Bool {
        if let current = currentGenerations[context.ownerIdentityId] {
            return current == context.identityGeneration
        }
        currentGenerations[context.ownerIdentityId] = context.identityGeneration
        return true
    }

    private func accepts(_ context: LoadContext) -> Bool { accept(context) }

    private func failureFor(
        _ context: LoadContext,
        fallback: MessageImageLoadFailure
    ) -> MessageImageLoadFailure {
        accept(context) ? fallback : .staleGeneration
    }

    private func cancelSharedWork(ownerIdentityId: String, through generation: Int) {
        for (key, task) in inFlight {
            guard case .shared(let identity) = key,
                  identity.ownerIdentityId == ownerIdentityId,
                  identity.identityGeneration <= generation else { continue }
            task.cancel()
        }
    }

    private func fetch(_ url: URL, using session: URLSession) async throws -> Data {
        if url.isFileURL { return try Data(contentsOf: url, options: .mappedIfSafe) }
        guard urlPolicy.allows(url, kind: .storage)
        else { throw MessageImageLoadFailure.untrustedUrl }
        let (data, response) = try await mediaTransport.data(
            for: url,
            kind: .storage,
            session: session
        )
        guard let http = response as? HTTPURLResponse else {
            throw MessageImageLoadFailure.unavailable
        }
        if [400, 401, 403].contains(http.statusCode) {
            throw MessageImageLoadFailure.expiredUrl
        }
        guard (200..<300).contains(http.statusCode), !data.isEmpty else {
            throw MessageImageLoadFailure.unavailable
        }
        return data
    }

    private func insert(
        _ image: UIImage,
        key: String,
        identity: SharedCacheIdentity? = nil
    ) {
        let cost = Int(image.size.width * image.scale * image.size.height * image.scale * 4)
        memory.setObject(image, forKey: key as NSString, cost: cost)
        if let identity { sharedMemoryIdentities.insert(identity) }
    }

    private nonisolated static func maximumPixel(for targetPixelSize: CGSize) -> Int {
        max(1, Int(ceil(max(targetPixelSize.width, targetPixelSize.height))))
    }

    private nonisolated static func decode(
        _ data: Data,
        targetPixelSize: CGSize
    ) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let maxPixel = maximumPixel(for: targetPixelSize)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return UIImage(cgImage: image)
    }

    private nonisolated static func cacheKey(for value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private nonisolated static func cacheKey(for identity: RequestIdentity) -> String {
        switch identity {
        case .direct(let value): cacheKey(for: value)
        case .shared(let value): cacheKey(for: value.serialized)
        }
    }

    private nonisolated static func url(
        for intent: SharedContentFetchIntent,
        delivery: SignedAttachmentUrl?
    ) -> URL? {
        guard let delivery else { return nil }
        return intent == .selectedFullContent ? delivery.displayUrl : delivery.thumbnailUrl
    }

    private nonisolated static func url(
        for intent: SharedContentFetchIntent,
        lease: SharedContentDeliveryLease?
    ) -> URL? {
        guard let lease else { return nil }
        return intent == .selectedFullContent ? lease.displayUrl : lease.thumbnailUrl
    }

    private struct SharedCacheIdentity: Hashable, Sendable {
        let ownerIdentityId: String
        let identityGeneration: Int
        let conversationId: String
        let attachmentId: String
        let contentVersion: String
        let intent: SharedContentFetchIntent
        let targetPixelSize: Int

        init(context: LoadContext) {
            ownerIdentityId = context.ownerIdentityId
            identityGeneration = context.identityGeneration
            conversationId = context.conversationId
            attachmentId = context.attachmentId
            contentVersion = context.contentVersion
            intent = context.intent
            targetPixelSize = MessageImageLoader.maximumPixel(for: context.targetPixelSize)
        }

        var serialized: String {
            [ownerIdentityId, String(identityGeneration), conversationId, attachmentId, contentVersion, intent.rawValue, String(targetPixelSize)]
                .joined(separator: "\u{1f}")
        }

        var thumbnailKey: SharedContentThumbnailKey {
            SharedContentThumbnailKey(
                ownerIdentityId,
                conversationId,
                attachmentId,
                contentVersion,
                identityGeneration: identityGeneration
            )
        }
    }

    private enum RequestIdentity: Hashable, Sendable {
        case direct(String)
        case shared(SharedCacheIdentity)
    }
}

public enum MessageImageLoadFailure: Error, Equatable, Sendable {
    case expiredUrl
    case invalidImage
    case untrustedUrl
    case unavailable
    case staleGeneration

    var isRefreshable: Bool { self == .expiredUrl }
}
