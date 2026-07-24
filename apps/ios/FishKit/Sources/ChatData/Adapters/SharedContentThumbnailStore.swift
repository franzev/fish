import ChatCore
import CryptoKit
import Foundation

/// Opaque identity for one displayed thumbnail. The raw values never appear
/// in the filesystem path or in the value's textual representation.
public struct SharedContentThumbnailKey: Hashable, Sendable, CustomStringConvertible {
    public let ownerIdentityId: String
    public let conversationId: String
    public let itemId: String
    public let contentVersion: String
    public let identityGeneration: Int

    public let ownerFingerprint: String
    public let opaqueRelativePath: String

    public init(
        _ ownerIdentityId: String,
        _ conversationId: String,
        _ itemId: String,
        _ contentVersion: String,
        identityGeneration: Int
    ) {
        precondition(!ownerIdentityId.isEmpty)
        precondition(!conversationId.isEmpty)
        precondition(!itemId.isEmpty)
        precondition(!contentVersion.isEmpty)
        precondition(identityGeneration > 0)
        self.ownerIdentityId = ownerIdentityId
        self.conversationId = conversationId
        self.itemId = itemId
        self.contentVersion = contentVersion
        self.identityGeneration = identityGeneration
        ownerFingerprint = Self.sha256(ownerIdentityId)
        let conversationFingerprint = Self.sha256(conversationId)
        let itemFingerprint = Self.sha256(itemId)
        let versionFingerprint = Self.sha256("\(contentVersion)|\(identityGeneration)")
        opaqueRelativePath = "\(ownerFingerprint)/\(conversationFingerprint)/\(itemFingerprint)-\(versionFingerprint).thumb"
    }

    public var description: String {
        "SharedContentThumbnailKey(ownerFingerprint=\(ownerFingerprint), opaqueRelativePath=\(opaqueRelativePath))"
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Thumbnail bytes are copied at the boundary and carry no URL/path metadata.
public struct SharedContentThumbnailBytes: Equatable, Sendable, CustomStringConvertible {
    public let data: Data
    public var size: Int { data.count }

    public init(_ data: Data) {
        self.data = Data(data)
    }

    public var description: String { "SharedContentThumbnailBytes(size=\(size))" }
}

/// Explicit marker for the only durable media intent.
public enum SharedContentDisplayedIntent: Sendable, Equatable {
    case displayedThumbnail
}

/// Owner-scoped displayed-thumbnail cache. Lookahead and selected-full bytes
/// remain in bounded actor memory; only `confirmDisplayed` writes a file.
public actor SharedContentThumbnailStore {
    public static let maximumThumbnailBytes: Int64 = 8 * 1024 * 1024
    public static let maximumStagedBytes: Int64 = 16 * 1024 * 1024
    public static let defaultMaximumBytes: Int64 = 64 * 1024 * 1024
    public static let defaultInactivity: TimeInterval = 30 * 24 * 60 * 60

    public let root: URL
    public let isExcludedFromBackup: Bool
    private let fileManager: FileManager
    private let now: @Sendable () -> Date
    private let canonicalRoot: URL
    private var staged: [SharedContentThumbnailKey: SharedContentThumbnailBytes] = [:]
    private var stagedByteCount: Int64 = 0
    private var revokedThroughGeneration: [String: Int] = [:]

    public init(
        root: URL? = nil,
        fileManager: FileManager = .default,
        now: @escaping @Sendable () -> Date = Date.init
    ) throws {
        self.fileManager = fileManager
        self.now = now
        if let root {
            self.root = root
        } else {
            guard let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
                throw SharedContentThumbnailStoreFailure.unavailable
            }
            self.root = caches.appending(path: "SharedContentThumbnails", directoryHint: .isDirectory)
        }
        try fileManager.createDirectory(at: self.root, withIntermediateDirectories: true)
        self.canonicalRoot = self.root.standardizedFileURL
        try Self.protectAndExclude(self.root)
        self.isExcludedFromBackup = true
    }

    @discardableResult
    public func stageLookahead(
        _ key: SharedContentThumbnailKey,
        bytes: Data
    ) -> Bool {
        stage(key, bytes: bytes, intent: .lookaheadThumbnail)
    }

    @discardableResult
    public func stage(
        _ key: SharedContentThumbnailKey,
        bytes: Data,
        intent: SharedContentFetchIntent
    ) -> Bool {
        guard key.identityGeneration > revokedThroughGeneration[key.ownerIdentityId, default: 0],
              intent != .selectedFullContent,
              !bytes.isEmpty,
              Int64(bytes.count) <= Self.maximumThumbnailBytes
        else { return false }

        if let old = staged.removeValue(forKey: key) { stagedByteCount -= Int64(old.size) }
        staged[key] = SharedContentThumbnailBytes(bytes)
        stagedByteCount += Int64(bytes.count)
        while stagedByteCount > Self.maximumStagedBytes, let first = staged.first {
            staged.removeValue(forKey: first.key)
            stagedByteCount -= Int64(first.value.size)
        }
        return true
    }

    @discardableResult
    public func confirmDisplayed(_ key: SharedContentThumbnailKey) -> Bool {
        guard key.identityGeneration > revokedThroughGeneration[key.ownerIdentityId, default: 0] else {
            removeStaged(key)
            return false
        }
        guard let bytes = staged[key], writeDisplayedAtomically(key, bytes: bytes) else { return false }
        removeStaged(key)
        return true
    }

    public func readDisplayed(_ key: SharedContentThumbnailKey) -> SharedContentThumbnailBytes? {
        guard key.identityGeneration > revokedThroughGeneration[key.ownerIdentityId, default: 0],
              let url = containedFile(for: key),
              let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
              values.isRegularFile == true,
              let fileSize = values.fileSize,
              fileSize > 0,
              Int64(fileSize) <= Self.maximumThumbnailBytes,
              let data = try? Data(contentsOf: url, options: .mappedIfSafe)
        else { return nil }
        try? fileManager.setAttributes([.modificationDate: now()], ofItemAtPath: url.path)
        return SharedContentThumbnailBytes(data)
    }

    /// Reads staged or durable bytes without promoting lookahead work.
    public func readRenderable(_ key: SharedContentThumbnailKey) -> SharedContentThumbnailBytes? {
        guard key.identityGeneration > revokedThroughGeneration[key.ownerIdentityId, default: 0]
        else { return nil }
        if let value = staged[key] {
            return SharedContentThumbnailBytes(value.data)
        }
        return readDisplayed(key)
    }

    public func prune(
        ownerIdentityId: String,
        maxBytes: Int64 = SharedContentThumbnailStore.defaultMaximumBytes,
        inactiveAfter: TimeInterval = SharedContentThumbnailStore.defaultInactivity
    ) {
        guard !ownerIdentityId.isEmpty, maxBytes >= 0, inactiveAfter >= 0,
              let ownerRoot = containedOwnerRoot(ownerIdentityId)
        else { return }
        let cutoff = now().addingTimeInterval(-inactiveAfter)
        let files = thumbnailFiles(under: ownerRoot)
        files.filter { modificationDate(for: $0) <= cutoff }.forEach { try? fileManager.removeItem(at: $0) }

        var remaining = thumbnailFiles(under: ownerRoot)
        var total = remaining.reduce(Int64(0)) { $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
        for file in remaining.sorted(by: { modificationDate(for: $0) < modificationDate(for: $1) }) where total > maxBytes {
            let size = Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
            try? fileManager.removeItem(at: file)
            total -= size
        }
        remaining = thumbnailFiles(under: ownerRoot)
        removeEmptyDirectories(under: ownerRoot)
        _ = remaining
    }

    @discardableResult
    public func purgeOwner(ownerIdentityId: String) -> Bool {
        guard !ownerIdentityId.isEmpty else { return false }
        staged = staged.filter { key, bytes in
            guard key.ownerIdentityId != ownerIdentityId else {
                stagedByteCount -= Int64(bytes.size)
                return false
            }
            return true
        }
        guard let ownerRoot = containedOwnerRoot(ownerIdentityId) else { return false }
        deleteContainedTree(ownerRoot)
        return !fileManager.fileExists(atPath: ownerRoot.path)
    }

    @discardableResult
    public func purgeConversation(ownerIdentityId: String, conversationId: String) -> Bool {
        guard !ownerIdentityId.isEmpty, !conversationId.isEmpty else { return false }
        staged = staged.filter { key, bytes in
            guard key.ownerIdentityId != ownerIdentityId || key.conversationId != conversationId else {
                stagedByteCount -= Int64(bytes.size)
                return false
            }
            return true
        }
        let conversationRoot = root
            .appending(path: SHA256.hash(data: Data(ownerIdentityId.utf8)).map { String(format: "%02x", $0) }.joined())
            .appending(path: SHA256.hash(data: Data(conversationId.utf8)).map { String(format: "%02x", $0) }.joined())
        guard isContained(conversationRoot) else { return false }
        deleteContainedTree(conversationRoot)
        return !fileManager.fileExists(atPath: conversationRoot.path)
    }

    public var stagedCount: Int { staged.count }

    public func stagedCount(ownerIdentityId: String) -> Int {
        staged.keys.lazy.filter { $0.ownerIdentityId == ownerIdentityId }.count
    }

    public func revokeIdentityGeneration(ownerIdentityId: String, through generation: Int) {
        guard !ownerIdentityId.isEmpty, generation > 0 else { return }
        revokedThroughGeneration[ownerIdentityId] = max(
            revokedThroughGeneration[ownerIdentityId, default: 0],
            generation
        )
        staged = staged.filter { key, bytes in
            guard key.ownerIdentityId != ownerIdentityId || key.identityGeneration > generation else {
                stagedByteCount -= Int64(bytes.size)
                return false
            }
            return true
        }
    }

    public func persistedFileCount(ownerIdentityId: String) -> Int {
        guard let ownerRoot = containedOwnerRoot(ownerIdentityId) else { return 0 }
        return thumbnailFiles(under: ownerRoot).count
    }

    public func persistedByteCount(ownerIdentityId: String) -> Int64 {
        guard let ownerRoot = containedOwnerRoot(ownerIdentityId) else { return 0 }
        return thumbnailFiles(under: ownerRoot).reduce(Int64(0)) {
            $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
    }

    private func writeDisplayedAtomically(
        _ key: SharedContentThumbnailKey,
        bytes: SharedContentThumbnailBytes
    ) -> Bool {
        guard let destination = containedFile(for: key),
              bytes.size > 0,
              Int64(bytes.size) <= Self.maximumThumbnailBytes
        else { return false }
        do {
            try fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Self.protectAndExclude(destination.deletingLastPathComponent())
            let temporary = destination.deletingLastPathComponent()
                .appending(path: ".\(destination.lastPathComponent).tmp")
            try bytes.data.write(to: temporary, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            try Self.protectAndExclude(temporary)
            if fileManager.fileExists(atPath: destination.path) { try fileManager.removeItem(at: destination) }
            try fileManager.moveItem(at: temporary, to: destination)
            try Self.protectAndExclude(destination)
            return true
        } catch {
            let temporary = destination.deletingLastPathComponent()
                .appending(path: ".\(destination.lastPathComponent).tmp")
            try? fileManager.removeItem(at: temporary)
            return false
        }
    }

    private func removeStaged(_ key: SharedContentThumbnailKey) {
        guard let bytes = staged.removeValue(forKey: key) else { return }
        stagedByteCount -= Int64(bytes.size)
    }

    private func containedFile(for key: SharedContentThumbnailKey) -> URL? {
        let candidate = canonicalRoot.appending(path: key.opaqueRelativePath)
        return isContained(candidate) ? candidate : nil
    }

    private func containedOwnerRoot(_ ownerIdentityId: String) -> URL? {
        let fingerprint = SHA256.hash(data: Data(ownerIdentityId.utf8)).map { String(format: "%02x", $0) }.joined()
        let candidate = canonicalRoot.appending(path: fingerprint)
        return isContained(candidate) ? candidate : nil
    }

    private func isContained(_ url: URL) -> Bool {
        let rootPath = canonicalRoot.resolvingSymlinksInPath().path
        let path = url.standardizedFileURL.resolvingSymlinksInPath().path
        return path == rootPath || path.hasPrefix(rootPath + "/")
    }

    private func thumbnailFiles(under directory: URL) -> [URL] {
        guard isContained(directory), let enumerator = fileManager.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return enumerator.compactMap { value in
            guard let url = value as? URL, url.pathExtension == "thumb", isContained(url),
                  (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
            else { return nil }
            return url
        }
    }

    private func modificationDate(for url: URL) -> Date {
        (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
    }

    private func deleteContainedTree(_ directory: URL) {
        guard isContained(directory), fileManager.fileExists(atPath: directory.path),
              let enumerator = fileManager.enumerator(at: directory, includingPropertiesForKeys: nil)
        else { return }
        let entries = enumerator.compactMap { $0 as? URL }.sorted { $0.path.count > $1.path.count }
        for entry in entries where isContained(entry) { try? fileManager.removeItem(at: entry) }
        try? fileManager.removeItem(at: directory)
    }

    private func removeEmptyDirectories(under directory: URL) {
        guard isContained(directory), let enumerator = fileManager.enumerator(at: directory, includingPropertiesForKeys: [.isDirectoryKey]) else { return }
        for entry in enumerator.compactMap({ $0 as? URL }).sorted(by: { $0.path.count > $1.path.count }) where isContained(entry) {
            if (try? entry.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true,
               (try? fileManager.contentsOfDirectory(at: entry, includingPropertiesForKeys: nil)).map(\.isEmpty) == true {
                try? fileManager.removeItem(at: entry)
            }
        }
    }

    private static func protectAndExclude(_ url: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableUrl = url
        try mutableUrl.setResourceValues(values)
    }
}

public enum SharedContentThumbnailStoreFailure: Error, Equatable, Sendable {
    case unavailable
}
