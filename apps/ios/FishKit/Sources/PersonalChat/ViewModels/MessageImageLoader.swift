import ChatData
import CryptoKit
import Foundation
import ImageIO
import UIKit

public actor MessageImageLoader {
    public static let shared = MessageImageLoader()

    private let memory = NSCache<NSString, UIImage>()
    private let session: URLSession
    private let cacheRoot: URL
    private let allowedHost: String?
    private var inFlight: [String: Task<UIImage, any Error>] = [:]

    public init(
        session: URLSession = .shared,
        cacheRoot: URL? = nil,
        allowedHost: String? = nil
    ) {
        self.session = session
        self.allowedHost = allowedHost?.lowercased()
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

    public func image(
        storagePath: String,
        url: URL,
        attachmentId: String,
        targetPixelSize: CGSize,
        commands: (any AttachmentCommandProviding)? = nil
    ) async throws -> UIImage {
        let storageKey = storagePath.isEmpty ? url.absoluteString : storagePath
        let maximumPixel = max(1, Int(ceil(max(targetPixelSize.width, targetPixelSize.height))))
        let decodeKey = "\(storageKey)#\(maximumPixel)"
        if let cached = memory.object(forKey: decodeKey as NSString) { return cached }
        let diskUrl = cacheRoot.appending(path: Self.cacheKey(storageKey))
        if let data = try? Data(contentsOf: diskUrl),
           let image = Self.decode(data, targetPixelSize: targetPixelSize) {
            insert(image, key: decodeKey)
            return image
        }
        if let task = inFlight[decodeKey] { return try await task.value }
        let task = Task<UIImage, any Error> {
            let data: Data
            do {
                data = try await self.fetch(url)
            } catch {
                guard let loadError = error as? MessageImageLoadFailure,
                      loadError.isRefreshable,
                      let commands else { throw error }
                let refreshed = try await commands.refreshUrls(attachmentIds: [attachmentId])
                guard let delivery = refreshed.first else { throw loadError }
                let next = storagePath.localizedCaseInsensitiveContains("thumbnail")
                    ? delivery.thumbnailUrl
                    : delivery.displayUrl
                guard let next else { throw loadError }
                data = try await self.fetch(next)
            }
            guard let image = Self.decode(data, targetPixelSize: targetPixelSize) else {
                throw MessageImageLoadFailure.invalidImage
            }
            try? data.write(to: diskUrl, options: .atomic)
            return image
        }
        inFlight[decodeKey] = task
        defer { inFlight[decodeKey] = nil }
        let image = try await task.value
        insert(image, key: decodeKey)
        return image
    }

    public func removeAll() {
        memory.removeAllObjects()
        try? FileManager.default.removeItem(at: cacheRoot)
        try? FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
    }

    private func fetch(_ url: URL) async throws -> Data {
        if url.isFileURL { return try Data(contentsOf: url, options: .mappedIfSafe) }
        guard let allowedHost,
              url.scheme == "https" || (url.scheme == "http" && Self.isLocal(url)),
              url.host?.lowercased() == allowedHost
        else { throw MessageImageLoadFailure.untrustedUrl }
        let (data, response) = try await session.data(from: url)
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

    private func insert(_ image: UIImage, key: String) {
        let cost = Int(image.size.width * image.scale * image.size.height * image.scale * 4)
        memory.setObject(image, forKey: key as NSString, cost: cost)
    }

    private nonisolated static func decode(
        _ data: Data,
        targetPixelSize: CGSize
    ) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let maxPixel = max(1, Int(max(targetPixelSize.width, targetPixelSize.height)))
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

    private nonisolated static func cacheKey(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private nonisolated static func isLocal(_ url: URL) -> Bool {
        ["localhost", "127.0.0.1"].contains(url.host ?? "")
    }
}

public enum MessageImageLoadFailure: Error, Equatable, Sendable {
    case expiredUrl
    case invalidImage
    case untrustedUrl
    case unavailable

    var isRefreshable: Bool { self == .expiredUrl }
}
