import ChatCore
import ChatData
import Foundation
import UIKit

/// Route-scoped media delivery. Closing the runtime revokes its delivery
/// generation and invalidates every in-flight URLSession request.
public actor SharedContentMediaRuntime {
    private static let maximumBytes = 8 * 1024 * 1024
    private static let maximumFullContentBytes = 25 * 1024 * 1024

    private let messaging: any ChatMessagingProviding
    private let deliveryStore: SharedContentDeliveryStore
    private let thumbnailStore: SharedContentThumbnailStore
    private let session: URLSession
    private let urlPolicy: SharedContentMediaURLPolicy
    private let mediaTransport: SharedContentMediaTransport
    private var activeGeneration: Int?
    private var temporaryFiles = Set<URL>()

    public struct FullContentRequest: Sendable, Equatable {
        public let ownerIdentityId: String
        public let conversationId: String
        public let identityGeneration: Int
        public let itemId: String
        public let contentVersion: String
        public let kind: String
        public let attachmentId: String?
        public let name: String
        public let mimeType: String
        public let expectedByteSize: Int64

        public init(
            ownerIdentityId: String,
            conversationId: String,
            identityGeneration: Int,
            itemId: String,
            contentVersion: String,
            kind: String,
            attachmentId: String?,
            name: String,
            mimeType: String,
            expectedByteSize: Int64
        ) {
            self.ownerIdentityId = ownerIdentityId
            self.conversationId = conversationId
            self.identityGeneration = identityGeneration
            self.itemId = itemId
            self.contentVersion = contentVersion
            self.kind = kind
            self.attachmentId = attachmentId
            self.name = name
            self.mimeType = mimeType
            self.expectedByteSize = expectedByteSize
        }
    }

    public struct VerifiedFile: Sendable, Equatable {
        public let url: URL
        public let name: String
        public let mimeType: String
        public let byteSize: Int64
    }

    public init(
        messaging: any ChatMessagingProviding,
        deliveryStore: SharedContentDeliveryStore,
        thumbnailStore: SharedContentThumbnailStore,
        urlPolicy: SharedContentMediaURLPolicy,
        session: URLSession = SharedContentEphemeralSession.make(),
        mediaTransport: SharedContentMediaTransport? = nil
    ) {
        self.messaging = messaging
        self.deliveryStore = deliveryStore
        self.thumbnailStore = thumbnailStore
        self.urlPolicy = urlPolicy
        self.mediaTransport = mediaTransport ?? SharedContentMediaTransport(
            policy: urlPolicy
        )
        self.session = session
        activeGeneration = deliveryStore.identityGeneration
    }

    public func load(
        _ request: SharedContentMediaThumbnailRequest,
        intent: SharedContentFetchIntent
    ) async -> Data? {
        guard isCurrent(request) else { return nil }
        let key = SharedContentThumbnailKey(
            request.ownerIdentityId,
            request.conversationId,
            request.itemId,
            request.contentVersion,
            identityGeneration: request.identityGeneration
        )

        let cached = await thumbnailStore.readRenderable(key)
        guard isCurrent(request) else { return nil }
        if let cached {
            return cached.data
        }

        let url: URL?
        let urlKind: SharedContentMediaURLKind
        switch request.kind {
        case "photo", "video":
            guard isCurrent(request), let attachmentId = request.attachmentId else {
                return nil
            }
            do {
                let lease = try await deliveryStore.lease(for: attachmentId)
                guard isCurrent(request) else { return nil }
                url = lease?.thumbnailUrl ?? lease?.displayUrl
            } catch {
                return nil
            }
            urlKind = .storage
        case "gif":
            guard isCurrent(request), let sourceMessageId = request.sourceMessageId else {
                return nil
            }
            do {
                let message = try await messaging.messages(ids: [sourceMessageId]).first
                guard isCurrent(request) else { return nil }
                url = message?.gif?.posterUrl
            } catch {
                return nil
            }
            urlKind = .gif
        case "sticker":
            // Stickers are bundled assets and never enter the network runtime.
            return nil
        default:
            return nil
        }

        guard isCurrent(request),
              let url,
              urlPolicy.allows(url, kind: urlKind)
        else { return nil }

        let response: (Data, URLResponse)
        do {
            response = try await mediaTransport.data(
                for: url,
                kind: urlKind,
                session: session
            )
        } catch {
            return nil
        }
        guard isCurrent(request),
              (response.1 as? HTTPURLResponse).map({ 200..<300 ~= $0.statusCode }) == true,
              !response.0.isEmpty,
              response.0.count <= Self.maximumBytes,
              UIImage(data: response.0) != nil
        else { return nil }

        guard await thumbnailStore.stage(key, bytes: response.0, intent: intent),
              isCurrent(request)
        else { return nil }
        return response.0
    }

    public func close(generation: Int) async {
        guard activeGeneration == generation else { return }
        activeGeneration = nil
        session.invalidateAndCancel()
        for file in temporaryFiles { try? FileManager.default.removeItem(at: file) }
        temporaryFiles.removeAll()
        _ = await deliveryStore.clearGeneration(generation)
    }

    /// Downloads an attachment through the current generation's live lease.
    /// GIFs and stickers intentionally have no export path until their rights
    /// are verified. The returned file is temporary and owned by this actor.
    public func loadFullContent(_ request: FullContentRequest) async -> VerifiedFile? {
        guard isCurrent(request),
              request.kind != "gif",
              request.kind != "sticker",
              let attachmentId = request.attachmentId,
              request.expectedByteSize > 0,
              request.expectedByteSize <= Int64(Self.maximumFullContentBytes)
        else { return nil }
        let lease: SharedContentDeliveryLease?
        do {
            lease = try await deliveryStore.lease(for: attachmentId)
        } catch {
            return nil
        }
        guard isCurrent(request),
              let url = lease?.displayUrl,
              urlPolicy.allows(url, kind: .storage)
        else { return nil }
        let response: (Data, URLResponse)
        do {
            response = try await mediaTransport.data(
                for: url,
                kind: .storage,
                session: session
            )
        } catch {
            return nil
        }
        let responseMime = response.1.mimeType?.split(separator: ";", maxSplits: 1).first
            .map {
                String($0)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .lowercased()
            }
        guard isCurrent(request),
              (response.1 as? HTTPURLResponse).map({ 200..<300 ~= $0.statusCode }) == true,
              response.0.count > 0,
              Int64(response.0.count) == request.expectedByteSize,
              responseMime == nil || responseMime == request.mimeType.lowercased() ||
                  responseMime == "application/octet-stream"
        else { return nil }

        let suffix = request.name.split(separator: ".").last.map(String.init) ?? "bin"
        let destination = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString.lowercased())
            .appendingPathExtension(suffix)
        do {
            try response.0.write(to: destination, options: .atomic)
        } catch {
            return nil
        }
        guard isCurrent(request) else {
            try? FileManager.default.removeItem(at: destination)
            return nil
        }
        temporaryFiles.insert(destination)
        return VerifiedFile(
            url: destination,
            name: request.name,
            mimeType: request.mimeType,
            byteSize: request.expectedByteSize
        )
    }

    public func discard(_ file: VerifiedFile) {
        temporaryFiles.remove(file.url)
        try? FileManager.default.removeItem(at: file.url)
    }

    private func isCurrent(_ request: SharedContentMediaThumbnailRequest) -> Bool {
        !Task.isCancelled &&
            activeGeneration == request.identityGeneration &&
            request.identityGeneration > 0 &&
            !request.ownerIdentityId.isEmpty &&
            !request.conversationId.isEmpty &&
            !request.itemId.isEmpty &&
            !request.contentVersion.isEmpty &&
            request.ownerIdentityId == deliveryStore.ownerIdentityId &&
            request.conversationId == deliveryStore.conversationId
    }

    private func isCurrent(_ request: FullContentRequest) -> Bool {
        !Task.isCancelled &&
            activeGeneration == request.identityGeneration &&
            request.identityGeneration > 0 &&
            !request.ownerIdentityId.isEmpty &&
            !request.conversationId.isEmpty &&
            !request.itemId.isEmpty &&
            !request.contentVersion.isEmpty &&
            request.ownerIdentityId == deliveryStore.ownerIdentityId &&
            request.conversationId == deliveryStore.conversationId
    }
}
