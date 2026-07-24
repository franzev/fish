import ChatData
import Foundation
import Testing
@testable import PersonalChat

@MainActor @Suite(.serialized)
struct SharedContentIdentityCoordinatorTests {
    @Test func accountTransitionsHideOldStateAndPurgeBeforeBindingNewOwner() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)

        #expect(await coordinator.transition(to: "owner-a-key"))
        await port.reset()
        #expect(await coordinator.transition(to: "owner-b-key"))
        #expect(await port.operations == IdentityPurgePortFake.exactPurgeOrder)
        #expect(!coordinator.isGalleryEligible(for: "owner-a-key"))
        #expect(coordinator.isGalleryEligible(for: "owner-b-key"))
    }

    @Test func signedOutAndUnresolvedTransitionsFailClosedAfterHidingAndPurge() async {
        for newOwner in [String?.none, ""] {
            let port = IdentityPurgePortFake()
            let coordinator = SharedContentIdentityCoordinator(purgePort: port)
            #expect(await coordinator.transition(to: "owner-a-key"))
            await port.reset()
            #expect(!(await coordinator.transition(to: newOwner)))
            #expect(!coordinator.isGalleryEligible(for: "owner-a-key"))
            #expect(coordinator.state == .unresolved)
            #expect(await port.operations == Array(IdentityPurgePortFake.exactPurgeOrder.dropLast(2)))
        }
    }

    @Test func unresolvedToBAndBackToAUseASecondGenerationPurge() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)
        #expect(await coordinator.transition(to: "owner-b-key"))
        await port.reset()
        #expect(await coordinator.transition(to: "owner-a-key"))
        #expect(coordinator.identityGeneration == 2)
        #expect(await port.operations == IdentityPurgePortFake.exactPurgeOrder)
        #expect(coordinator.isGalleryEligible(for: "owner-a-key"))
        #expect(!coordinator.isGalleryEligible(for: "owner-b-key"))
    }

    @Test func delayedOldOwnerCallbackIsRejectedAfterGenerationAdvances() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)
        #expect(await coordinator.transition(to: "owner-a-key"))
        #expect(await coordinator.transition(to: "owner-b-key"))
        #expect(!coordinator.accepts(owner: "owner-a-key", generation: 1))
        #expect(coordinator.accepts(owner: "owner-b-key", generation: coordinator.identityGeneration))
        #expect(!coordinator.isGalleryEligible(for: "owner-a-key"))
    }

    @Test func purgeFailureKeepsGalleryUnavailableUntilRestartSweepVerifiesEveryLayer() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)
        #expect(await coordinator.transition(to: "owner-a-key"))
        await port.failNextVerification()
        #expect(!(await coordinator.transition(to: "owner-b-key")))
        #expect(coordinator.state == .unavailable(.purgeIncomplete))
        #expect(!coordinator.isGalleryEligible(for: "owner-b-key"))

        #expect(await coordinator.retry())
        #expect(coordinator.isGalleryEligible(for: "owner-b-key"))
        #expect(coordinator.identityGeneration == 3)
    }

    @Test func restartSweepRemovesOldOwnerArtifactsFromEveryLayerAndUsesSafeZeroCounts() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)
        await port.seedOldOwnerArtifacts()

        #expect(await coordinator.start(verifiedOwnerIdentityId: "owner-b-key"))
        #expect(await port.safeLayerCounts == [0, 0, 0, 0, 0])
        #expect(await port.diagnosticSentinelCount == 0)
        #expect(!coordinator.isGalleryEligible(for: "owner-a-key"))
    }

    @Test func missingOrUnresolvedOwnerIsHiddenBeforeAnyPurgeAwait() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)
        #expect(await coordinator.transition(to: "owner-a-key"))
        await port.reset()

        #expect(!(await coordinator.transition(to: nil)))
        #expect(coordinator.state == .unresolved)
        #expect(!coordinator.isGalleryEligible(for: "owner-a-key"))
        #expect(await port.observedStateWasPurging)
    }

    @Test func productionPurgePortFencesLateMetadataAndThumbnailWrites() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        let thumbnailRoot = FileManager.default.temporaryDirectory
            .appending(path: "fish-purge-port-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: thumbnailRoot) }
        let thumbnails = try SharedContentThumbnailStore(root: thumbnailRoot)
        let loader = MessageImageLoader(cacheRoot: thumbnailRoot.appending(path: "decoded"))
        let port = DefaultSharedContentPurgePort(
            imageLoader: loader,
            cache: cache,
            thumbnailStore: thumbnails
        )

        await port.revokeIdentityGeneration(2)
        await #expect(throws: SharedContentCacheFailure.staleGeneration) {
            try await cache.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                identityGeneration: 1,
                items: []
            )
        }

        let oldGeneration = SharedContentOwnerGeneration(
            ownerIdentityId: "owner-a",
            generation: 1
        )
        await port.cancelWork(ownerGeneration: oldGeneration)
        let staleKey = SharedContentThumbnailKey(
            "owner-a",
            "conversation-a",
            "item-a",
            "v1",
            identityGeneration: 1
        )
        #expect(await thumbnails.stageLookahead(staleKey, bytes: Data([1])) == false)
        #expect(try await port.verifyPurge(ownerIdentityId: "owner-a"))
    }

    @Test func liveStoreAttachmentReplacesWeaklyAndRevokesBeforeTransitions() async {
        let port = IdentityPurgePortFake()
        let coordinator = SharedContentIdentityCoordinator(purgePort: port)
        let first = SharedContentStore(provider: IdentityStoreProvider())
        let second = SharedContentStore(provider: IdentityStoreProvider())

        await first.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        #expect(first.identityGeneration == 1)
        coordinator.attachStore(first)
        #expect(first.cachedItemKeys.isEmpty)

        await first.bind(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        coordinator.attachStore(second)
        #expect(first.identityGeneration >= 2)
        #expect(first.acceptedItems.isEmpty)

        #expect(await coordinator.transition(to: "owner-b"))
        await second.bind(ownerIdentityId: "owner-b", conversationId: "conversation-b")
        let liveGeneration = second.identityGeneration
        #expect(!(await coordinator.transition(to: nil)))
        #expect(second.identityGeneration > liveGeneration)
        #expect(second.acceptedItems.isEmpty)
        #expect(second.earlierState == .hidden)
    }

    @Test func coordinatorDoesNotRetainAttachedRouteStore() {
        let coordinator = SharedContentIdentityCoordinator(purgePort: IdentityPurgePortFake())
        weak var weakStore: SharedContentStore?

        do {
            let store = SharedContentStore(provider: IdentityStoreProvider())
            weakStore = store
            coordinator.attachStore(store)
        }

        #expect(weakStore == nil)
    }
}

private final class IdentityStoreProvider: SharedContentProviding, @unchecked Sendable {
    func observeSharedContentSnapshot(
        conversationId: String
    ) -> AsyncStream<StoredSharedContentSnapshot?> {
        _ = conversationId
        return AsyncStream { continuation in
            continuation.yield(nil)
            continuation.finish()
        }
    }

    func refreshSharedContent(
        token: SharedContentRequestToken,
        category: String?
    ) async -> SharedContentRepositoryResult<SharedContentDataPage> {
        _ = (token, category)
        return .success(.init(items: [], hasMore: false, nextCursor: nil))
    }

    func refreshSharedContentCategories(
        token: SharedContentRequestToken
    ) async -> SharedContentRepositoryResult<[String]> {
        _ = token
        return .success([])
    }
}

private actor IdentityPurgePortFake: SharedContentPurgePort {
    static let exactPurgeOrder = [
        "revoke-generation", "hide-old-state", "cancel-work", "clear-leases",
        "clear-decoded-memory", "purge-metadata", "purge-thumbnail-root", "purge-temp-root",
        "verify-purge", "bind-new-owner", "publish-eligible",
    ]

    private(set) var operations: [String] = []
    private(set) var safeLayerCounts = [0, 0, 0, 0, 0]
    private(set) var diagnosticSentinelCount = 0
    private(set) var observedStateWasPurging = false
    var shouldFailNextVerification = false

    func revokeIdentityGeneration(_ generation: Int) async {
        _ = generation
        operations.append("revoke-generation")
    }

    func hideOldState() async {
        operations.append("hide-old-state")
        observedStateWasPurging = true
    }

    func cancelWork(ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        operations.append("cancel-work")
    }

    func clearLeases(ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        operations.append("clear-leases")
    }

    func clearDecodedMemory(ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        operations.append("clear-decoded-memory")
    }

    func purgeMetadata(ownerIdentityId: String?, preserving newOwner: String?) async throws {
        _ = (ownerIdentityId, newOwner)
        operations.append("purge-metadata")
        safeLayerCounts[0] = 0
    }

    func purgeThumbnailRoot(ownerIdentityId: String?) async throws {
        _ = ownerIdentityId
        operations.append("purge-thumbnail-root")
        safeLayerCounts[3] = 0
    }

    func purgeTemporaryRoot(ownerIdentityId: String?) async throws {
        _ = ownerIdentityId
        operations.append("purge-temp-root")
        safeLayerCounts[4] = 0
    }

    func verifyPurge(ownerIdentityId: String?) async throws -> Bool {
        _ = ownerIdentityId
        operations.append("verify-purge")
        if shouldFailNextVerification {
            shouldFailNextVerification = false
            return false
        }
        safeLayerCounts = [0, 0, 0, 0, 0]
        diagnosticSentinelCount = 0
        return true
    }

    func bindNewOwner(_ ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        operations.append("bind-new-owner")
    }

    func publishEligible(_ ownerGeneration: SharedContentOwnerGeneration) async {
        _ = ownerGeneration
        operations.append("publish-eligible")
    }

    func reset() {
        operations.removeAll()
        observedStateWasPurging = false
    }

    func failNextVerification() { shouldFailNextVerification = true }

    func seedOldOwnerArtifacts() {
        safeLayerCounts = [1, 1, 1, 1, 1]
        diagnosticSentinelCount = 1
    }
}
