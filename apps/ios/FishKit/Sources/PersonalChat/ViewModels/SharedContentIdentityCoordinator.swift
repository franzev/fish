import ChatData
import CryptoKit
import Foundation
import Observation

/// The owner and monotonically increasing generation carried by every
/// shared-content operation. It is intentionally opaque to presentation code.
public struct SharedContentOwnerGeneration: Equatable, Hashable, Sendable {
    public let ownerIdentityId: String
    public let generation: Int

    public init(ownerIdentityId: String, generation: Int) {
        precondition(!ownerIdentityId.isEmpty)
        precondition(generation > 0)
        self.ownerIdentityId = ownerIdentityId
        self.generation = generation
    }
}

public enum SharedContentIdentityFailure: Error, Equatable, Sendable {
    case purgeIncomplete
}

public enum SharedContentIdentityState: Equatable, Sendable {
    case unresolved
    case purging(SharedContentOwnerGeneration)
    case eligible(SharedContentOwnerGeneration)
    case unavailable(SharedContentIdentityFailure)
}

/// The application-owned side of the identity boundary. Implementations may
/// use Core Data, file stores, or provider adapters, but must expose only
/// lifecycle operations and redacted outcome categories to the coordinator.
public protocol SharedContentPurgePort: Sendable {
    func revokeIdentityGeneration(_ generation: Int) async
    func hideOldState() async
    func cancelWork(ownerGeneration: SharedContentOwnerGeneration) async
    func clearLeases(ownerGeneration: SharedContentOwnerGeneration) async
    func clearDecodedMemory(ownerGeneration: SharedContentOwnerGeneration) async
    func purgeMetadata(ownerIdentityId: String?, preserving newOwner: String?) async throws
    func purgeThumbnailRoot(ownerIdentityId: String?) async throws
    func purgeTemporaryRoot(ownerIdentityId: String?) async throws
    func verifyPurge(ownerIdentityId: String?) async throws -> Bool
    func bindNewOwner(_ ownerGeneration: SharedContentOwnerGeneration) async
    func publishEligible(_ ownerGeneration: SharedContentOwnerGeneration) async
}

/// Main-actor identity state machine. The old owner becomes ineligible before
/// the first await; the new owner is not eligible until every zero probe has
/// passed. A failed purge affects only gallery eligibility, not auth/session
/// state, and is retried by `retry`, `start`, or `foreground`.
@MainActor @Observable
public final class SharedContentIdentityCoordinator {
    public private(set) var state: SharedContentIdentityState = .unresolved
    public private(set) var identityGeneration = 0

    private let purgePort: any SharedContentPurgePort
    private weak var sharedContentStore: SharedContentStore?
    private var currentOwner: SharedContentOwnerGeneration?
    private var pendingOwnerIdentityId: String?
    private var transitionTask: Task<Bool, Never>?

    public init(
        purgePort: any SharedContentPurgePort,
        sharedContentStore: SharedContentStore? = nil
    ) {
        self.purgePort = purgePort
        self.sharedContentStore = sharedContentStore
        sharedContentStore?.revokeIdentityGeneration(identityGeneration)
    }

    /// Replaces the weak route-scoped store attachment.
    ///
    /// Both the prior store and the newly attached store are synchronously
    /// revoked to the coordinator boundary. Binding a verified conversation
    /// remains an explicit route-composition step after attachment.
    public func attachStore(_ store: SharedContentStore?) {
        if let current = sharedContentStore, current !== store {
            let generation = max(identityGeneration, current.identityGeneration)
            _ = current.revokeIdentityGeneration(generation)
        }
        sharedContentStore = store
        guard let store else { return }
        let generation = max(identityGeneration, store.identityGeneration)
        _ = store.revokeIdentityGeneration(generation)
    }

    /// Serializes all restore, replacement, sign-out, and invalidation paths.
    @discardableResult
    public func transition(to ownerIdentityId: String?) async -> Bool {
        if let transitionTask {
            _ = await transitionTask.value
        }

        let task = Task { @MainActor [weak self] in
            guard let self else { return false }
            return await self.performTransition(to: ownerIdentityId)
        }
        transitionTask = task
        let result = await task.value
        transitionTask = nil
        return result
    }

    /// Startup and restored-session entry point. It deliberately uses the
    /// same purge-before-bind path as an account replacement.
    @discardableResult
    public func start(verifiedOwnerIdentityId: String?) async -> Bool {
        await transition(to: verifiedOwnerIdentityId)
    }

    /// Retries the last target after a failed purge. No target is ever bound
    /// from an unavailable state without a fresh zero verification.
    @discardableResult
    public func retry() async -> Bool {
        guard let pendingOwnerIdentityId else { return false }
        return await transition(to: pendingOwnerIdentityId)
    }

    /// Foreground cleanup retry is intentionally narrow: healthy eligible
    /// identities are left alone, while unavailable cleanup retries.
    @discardableResult
    public func foreground() async -> Bool {
        if case .unavailable = state { return await retry() }
        return isGalleryAvailable
    }

    public var isGalleryAvailable: Bool {
        if case .eligible = state { return true }
        return false
    }

    public func isGalleryEligible(for ownerIdentityId: String) -> Bool {
        guard case .eligible(let owner) = state else { return false }
        return owner.ownerIdentityId == ownerIdentityId
    }

    /// Every async caller can cheaply reject old callbacks without exposing
    /// URLs, filesystem paths, or provider diagnostics.
    public func accepts(owner: String, generation: Int) -> Bool {
        guard case .eligible(let current) = state else { return false }
        return current.ownerIdentityId == owner && current.generation == generation
    }

    private func performTransition(to requestedOwner: String?) async -> Bool {
        let newOwner = requestedOwner?.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedOwner = newOwner?.isEmpty == true ? nil : newOwner
        let previousOwner = currentOwner
        identityGeneration = max(
            identityGeneration + 1,
            (sharedContentStore?.identityGeneration ?? 0) + 1
        )
        let generation = identityGeneration
        pendingOwnerIdentityId = normalizedOwner

        // Hide synchronously before any cleanup can suspend. No old or new
        // gallery state can be observed while the transition is in flight.
        state = .unresolved
        let purgeOwner = previousOwner?.ownerIdentityId ?? normalizedOwner ?? "unresolved"
        let ownerGeneration = SharedContentOwnerGeneration(
            ownerIdentityId: purgeOwner,
            generation: previousOwner?.generation ?? generation
        )
        state = .purging(ownerGeneration)

        sharedContentStore?.revokeIdentityGeneration(generation)
        await purgePort.revokeIdentityGeneration(generation)
        await purgePort.hideOldState()
        await purgePort.cancelWork(ownerGeneration: ownerGeneration)
        await purgePort.clearLeases(ownerGeneration: ownerGeneration)
        await purgePort.clearDecodedMemory(ownerGeneration: ownerGeneration)

        do {
            try await purgePort.purgeMetadata(
                ownerIdentityId: previousOwner?.ownerIdentityId,
                preserving: normalizedOwner
            )
            try await purgePort.purgeThumbnailRoot(ownerIdentityId: previousOwner?.ownerIdentityId)
            try await purgePort.purgeTemporaryRoot(ownerIdentityId: previousOwner?.ownerIdentityId)
            guard try await purgePort.verifyPurge(ownerIdentityId: previousOwner?.ownerIdentityId) else {
                throw SharedContentIdentityFailure.purgeIncomplete
            }
        } catch {
            currentOwner = nil
            state = .unavailable(.purgeIncomplete)
            return false
        }

        guard let normalizedOwner else {
            currentOwner = nil
            state = .unresolved
            return false
        }

        let newOwnerGeneration = SharedContentOwnerGeneration(
            ownerIdentityId: normalizedOwner,
            generation: generation
        )
        await purgePort.bindNewOwner(newOwnerGeneration)
        currentOwner = newOwnerGeneration
        state = .eligible(newOwnerGeneration)
        await purgePort.publishEligible(newOwnerGeneration)
        pendingOwnerIdentityId = nil
        return true
    }
}

/// Production composition for the coordinator. The ports below remain
/// provider-neutral to the state machine while the concrete adapters stay in
/// ChatData and the image loader remains the only decoded-memory owner.
public final class DefaultSharedContentPurgePort: @unchecked Sendable, SharedContentPurgePort {
    private let imageLoader: MessageImageLoader
    private let cache: (any SharedContentCaching)?
    private let generationRevokers: [any SharedContentGenerationRevoking]
    private let thumbnailStore: SharedContentThumbnailStore?
    private let deliveryStores: [SharedContentDeliveryStore]
    private let temporaryRoot: URL
    private let fileManager: FileManager
    private let storageAvailable: Bool
    private let temporaryRootAvailable: Bool

    public init(
        imageLoader: MessageImageLoader,
        cache: (any SharedContentCaching)? = nil,
        generationRevokers: [any SharedContentGenerationRevoking] = [],
        thumbnailStore: SharedContentThumbnailStore? = nil,
        deliveryStores: [SharedContentDeliveryStore] = [],
        temporaryRoot: URL? = nil,
        fileManager: FileManager = .default,
        storageAvailable: Bool = true
    ) {
        self.imageLoader = imageLoader
        self.cache = cache
        self.generationRevokers = generationRevokers
        self.thumbnailStore = thumbnailStore
        self.deliveryStores = deliveryStores
        self.fileManager = fileManager
        self.storageAvailable = storageAvailable
        self.temporaryRoot = temporaryRoot ?? fileManager.temporaryDirectory
            .appending(path: "FishSharedContent", directoryHint: .isDirectory)
        try? fileManager.createDirectory(at: self.temporaryRoot, withIntermediateDirectories: true)
        self.temporaryRootAvailable = fileManager.fileExists(atPath: self.temporaryRoot.path)
        Self.excludeFromBackup(self.temporaryRoot)
    }

    public func revokeIdentityGeneration(_ generation: Int) async {
        await cache?.revokeIdentityGeneration(through: generation)
        for revoker in generationRevokers {
            await revoker.revokeIdentityGeneration(generation)
        }
    }

    public func hideOldState() async {}

    public func cancelWork(ownerGeneration: SharedContentOwnerGeneration) async {
        await imageLoader.cancelAndRemove(ownerGeneration: ownerGeneration)
        await thumbnailStore?.revokeIdentityGeneration(
            ownerIdentityId: ownerGeneration.ownerIdentityId,
            through: ownerGeneration.generation
        )
    }

    public func clearLeases(ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        for store in deliveryStores { _ = await store.clear() }
    }

    public func clearDecodedMemory(ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        // cancelAndRemove is intentionally the single loader cleanup seam;
        // keeping this phase explicit documents the required purge order.
    }

    public func purgeMetadata(ownerIdentityId: String?, preserving newOwner: String?) async throws {
        guard storageAvailable else { throw SharedContentIdentityFailure.purgeIncomplete }
        guard let cache else { return }
        if let newOwner, !newOwner.isEmpty {
            try await cache.sweepNonCurrentOwners(currentOwnerIdentityId: newOwner)
        } else if let ownerIdentityId, !ownerIdentityId.isEmpty {
            try await cache.purgeOwner(ownerIdentityId: ownerIdentityId)
        }
    }

    public func purgeThumbnailRoot(ownerIdentityId: String?) async throws {
        guard storageAvailable, temporaryRootAvailable else {
            throw SharedContentIdentityFailure.purgeIncomplete
        }
        if let ownerIdentityId, let thumbnailStore {
            guard await thumbnailStore.purgeOwner(ownerIdentityId: ownerIdentityId) else {
                throw SharedContentIdentityFailure.purgeIncomplete
            }
        }
        reapplyProtectionAndSweepTemporaryRoot(keeping: nil)
    }

    public func purgeTemporaryRoot(ownerIdentityId: String?) async throws {
        guard storageAvailable, temporaryRootAvailable else {
            throw SharedContentIdentityFailure.purgeIncomplete
        }
        if let ownerIdentityId, !ownerIdentityId.isEmpty {
            let root = ownerRoot(for: ownerIdentityId)
            deleteContainedTree(root)
            guard !fileManager.fileExists(atPath: root.path) else {
                throw SharedContentIdentityFailure.purgeIncomplete
            }
        }
        reapplyProtectionAndSweepTemporaryRoot(keeping: nil)
    }

    public func verifyPurge(ownerIdentityId: String?) async throws -> Bool {
        guard storageAvailable, temporaryRootAvailable else { return false }
        if let ownerIdentityId, !ownerIdentityId.isEmpty {
            if let cache, try await cache.verifyOwnerPurged(ownerIdentityId: ownerIdentityId, conversationId: nil) == false {
                return false
            }
            if let thumbnailStore {
                if await thumbnailStore.persistedFileCount(ownerIdentityId: ownerIdentityId) != 0 {
                    return false
                }
                if await thumbnailStore.stagedCount(ownerIdentityId: ownerIdentityId) != 0 {
                    return false
                }
            }
            if fileManager.fileExists(atPath: ownerRoot(for: ownerIdentityId).path) { return false }
        }
        return true
    }

    public func bindNewOwner(_ ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        reapplyProtectionAndSweepTemporaryRoot(keeping: ownerGeneration.ownerIdentityId)
    }

    public func publishEligible(_ ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        reapplyProtectionAndSweepTemporaryRoot(keeping: ownerGeneration.ownerIdentityId)
    }

    private func ownerRoot(for ownerIdentityId: String) -> URL {
        let digest = SHA256.hash(data: Data(ownerIdentityId.utf8))
            .map { String(format: "%02x", $0) }.joined()
        return temporaryRoot.appending(path: digest, directoryHint: .isDirectory)
    }

    private func reapplyProtectionAndSweepTemporaryRoot(keeping ownerIdentityId: String?) {
        try? fileManager.createDirectory(at: temporaryRoot, withIntermediateDirectories: true)
        Self.excludeFromBackup(temporaryRoot)
        guard let entries = try? fileManager.contentsOfDirectory(
            at: temporaryRoot,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return }
        let keep = ownerIdentityId.map { ownerRoot(for: $0).standardizedFileURL.path }
        for entry in entries where entry.standardizedFileURL.path != keep {
            deleteContainedTree(entry)
        }
    }

    private func deleteContainedTree(_ directory: URL) {
        let root = temporaryRoot.standardizedFileURL.resolvingSymlinksInPath().path
        let path = directory.standardizedFileURL.resolvingSymlinksInPath().path
        guard path.hasPrefix(root + "/") else { return }
        try? fileManager.removeItem(at: directory)
    }

    private static func excludeFromBackup(_ url: URL) {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = url
        try? mutable.setResourceValues(values)
    }
}
