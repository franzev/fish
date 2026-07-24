import CoreData
import Foundation
import Testing
@testable import ChatData

@Suite(.serialized)
struct CoreDataSharedContentCacheTests {
    @Test func revokedGenerationCannotRepopulatePurgedMetadata() async throws {
        let cache = try CoreDataSharedContentCache(configuration: .inMemory())
        await cache.revokeIdentityGeneration(through: 2)

        await #expect(throws: SharedContentCacheFailure.staleGeneration) {
            try await cache.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                identityGeneration: 1,
                items: []
            )
        }
        #expect(try await cache.verifyOwnerPurged(ownerIdentityId: "owner-a"))
    }

    @Test func verifiedOwnerHydratesExactConversationAndRejectsWrongMissingOrUnresolvedOwner() async throws {
        let cache = try makeCache()
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [item(0)]
        )
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-b",
            items: [item(1, conversationId: "conversation-b")]
        )
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-b",
            conversationId: "conversation-a",
            items: [item(2, ownerMarker: "owner-b")]
        )

        let exactA = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a")
        let exactB = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-b")
        let wrong = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "wrong-owner", conversationId: "conversation-a")
        let missing = try await cache.hydrateVerifiedOwner(verifiedOwnerId: nil, conversationId: "conversation-a")
        let blank = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "", conversationId: "conversation-a")
        #expect(exactA?.items.map(\.itemId) == ["item-0"])
        #expect(exactB?.items.map(\.itemId) == ["item-1"])
        #expect(wrong == nil)
        #expect(missing == nil)
        #expect(blank == nil)
    }

    @Test func cacheTruthRetainsStaleAndIncompleteDimensionsAndAuthoritativeEmpty() async throws {
        let cache = try makeCache()
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [item(0), item(1)],
            retainedOldestCursor: "cursor-0",
            retainedHistoryComplete: false,
            authoritativeEmptyConfirmed: false
        )

        let cached = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(cached.source == .authoritative)
        #expect(!cached.stale)
        #expect(!cached.retainedHistoryComplete)
        #expect(!cached.authoritativeEmptyConfirmed)
        #expect(cached.retainedOldestCursor == "cursor-0")

        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-empty",
            items: [],
            retainedHistoryComplete: true,
            authoritativeEmptyConfirmed: true
        )
        let empty = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-empty"))
        #expect(empty.source == .authoritative)
        #expect(empty.items.isEmpty)
        #expect(empty.authoritativeEmptyConfirmed)
        #expect(empty.retainedHistoryComplete)
    }

    @Test func acceptedPageBoundaryAndRepeatedTombstonesAreAtomicAndIdempotent() async throws {
        let cache = try makeCache()
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [item(0), item(1)]
        )
        try await cache.appendBrowsedPage(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            pageId: "browsed-1",
            pageOrdinal: 1,
            retainedCursor: "cursor-1",
            items: [item(2), item(3)],
            retainedHistoryComplete: false
        )
        try await cache.appendBrowsedPage(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            pageId: "browsed-1",
            pageOrdinal: 1,
            retainedCursor: "cursor-1",
            items: [item(2), item(3)],
            retainedHistoryComplete: false
        )

        var snapshot = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(snapshot.items.map(\.itemId) == ["item-3", "item-2", "item-1", "item-0"])
        #expect(snapshot.retainedOldestCursor == "cursor-1")
        #expect(!snapshot.retainedHistoryComplete)

        try await cache.applyAcceptedTombstones(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            sourceMessageIds: ["message-2"]
        )
        try await cache.applyAcceptedTombstones(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            sourceMessageIds: ["message-2"]
        )
        snapshot = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(snapshot.items.map(\.itemId) == ["item-3", "item-1", "item-0"])
        #expect(!snapshot.retainedHistoryComplete)
    }

    @Test func wrongConversationBatchIsRejectedWithoutChangingPriorSnapshot() async throws {
        let cache = try makeCache()
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [item(0)]
        )

        await #expect(throws: SharedContentCacheFailure.invalidInput) {
            try await cache.appendBrowsedPage(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                pageId: "browsed-invalid",
                pageOrdinal: 1,
                retainedCursor: "cursor-invalid",
                items: [item(1, conversationId: "conversation-b")],
                retainedHistoryComplete: false
            )
        }
        let snapshot = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(snapshot.items.map(\.itemId) == ["item-0"])
        #expect(snapshot.retainedHistoryComplete)
    }

    @Test func simulatedSaveFailureRollsBackRowsAndBoundaryTogether() async throws {
        let cache = try CoreDataSharedContentCache(
            configuration: .init(inMemory: true, simulateSaveFailure: true)
        )

        await #expect(throws: SharedContentCacheFailure.transactionFailed) {
            try await cache.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                items: [item(0)],
                retainedOldestCursor: "cursor-0",
                retainedHistoryComplete: false,
                authoritativeEmptyConfirmed: false
            )
        }
        let failedSnapshot = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a")
        #expect(failedSnapshot == nil)
    }

    @Test func newestFortySurvivePerConversationPressureBeforeBrowsedPages() async throws {
        let cache = try makeCache()
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: (0..<40).map { item($0) }
        )
        try await cache.appendBrowsedPage(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            pageId: "browsed-1",
            pageOrdinal: 1,
            retainedCursor: "cursor-1",
            items: (40..<441).map { item($0) },
            retainedHistoryComplete: false
        )

        let snapshot = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(snapshot.items.map(\.itemId) == (0..<40).reversed().map { "item-\($0)" })
        #expect(snapshot.newestWindowProtected)
    }

    @Test func accountCapRetainsNewestWindowForEveryConversation() async throws {
        let cache = try makeCache()
        for conversationIndex in 0..<6 {
            let conversation = "conversation-\(conversationIndex)"
            try await cache.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: conversation,
                items: (0..<40).map { item($0, conversationId: conversation) }
            )
            try await cache.appendBrowsedPage(
                ownerIdentityId: "owner-a",
                conversationId: conversation,
                pageId: "browsed-\(conversationIndex)",
                pageOrdinal: 1,
                retainedCursor: "cursor-\(conversationIndex)",
                items: (40..<400).map { item($0, conversationId: conversation) },
                retainedHistoryComplete: false
            )
        }

        for conversationIndex in 0..<6 {
            let conversation = "conversation-\(conversationIndex)"
            let snapshot = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: conversation))
            #expect(Set(snapshot.items.map(\.itemId)).isSuperset(of: Set((0..<40).map { "item-\($0)" })))
        }
    }

    @Test func thirtyDayInactivityEvictsBrowsedPageWithoutEvictingNewestWindow() async throws {
        let old = Date(timeIntervalSince1970: 1_600_000_000)
        let clock = MutableClock(old)
        let cache = try CoreDataSharedContentCache(
            configuration: .init(
                now: { clock.value },
                inMemory: true
            )
        )
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: (0..<40).map { item($0) }
        )
        try await cache.appendBrowsedPage(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            pageId: "browsed-old",
            pageOrdinal: 1,
            retainedCursor: "cursor-old",
            items: [item(40)],
            retainedHistoryComplete: false
        )
        clock.value = old.addingTimeInterval(31 * 24 * 60 * 60)
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: (0..<40).map { item($0) }
        )

        let snapshot = try #require(try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(snapshot.items.map(\.itemId) == (0..<40).reversed().map { "item-\($0)" })
    }

    @Test func persistentStoreReopensWithSafeMetadataAndBackupExclusion() async throws {
        let root = temporaryDirectory("reopen")
        defer { try? FileManager.default.removeItem(at: root) }
        let configuration = SharedContentCacheConfiguration(
            storeURL: root.appending(path: "SharedContentCache.sqlite"),
            now: { Date(timeIntervalSince1970: 1_700_000_000) }
        )

        do {
            let first = try CoreDataSharedContentCache(configuration: configuration)
            try await first.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                items: [item(0, linkMetadataJson: "{\"hostname\":\"example.com\"}")]
            )
        }
        #expect(try root.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)

        let reopened = try CoreDataSharedContentCache(configuration: configuration)
        let snapshot = try #require(try await reopened.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-a"))
        #expect(snapshot.items.map(\.itemId) == ["item-0"])
        #expect(try root.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)

        try await reopened.appendBrowsedPage(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            pageId: "browsed-1",
            pageOrdinal: 1,
            retainedCursor: "cursor-1",
            items: [item(1)],
            retainedHistoryComplete: false
        )
        #expect(try root.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)
    }

    @Test func persistedOrdinalAllocationSurvivesReopenAndEvictsDeepestPageWithoutGap() async throws {
        let root = temporaryDirectory("ordinal-reopen")
        defer { try? FileManager.default.removeItem(at: root) }
        let configuration = SharedContentCacheConfiguration(
            storeURL: root.appending(path: "SharedContentCache.sqlite"),
            now: { Date(timeIntervalSince1970: 1_700_000_000) },
            newestProtectedCount: 40,
            perConversationItemLimit: 42,
            perAccountItemLimit: 2_000
        )

        do {
            let first = try CoreDataSharedContentCache(configuration: configuration)
            try await first.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                items: (0..<40).map { item($0) }
            )
            #expect(try await first.appendBrowsedPageAllocatingOrdinal(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                pageId: "browsed-1",
                retainedCursor: "cursor-1",
                items: [item(40)],
                retainedHistoryComplete: false
            ) == 1)
            #expect(try await first.appendBrowsedPageAllocatingOrdinal(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                pageId: "browsed-2",
                retainedCursor: "cursor-2",
                items: [item(41)],
                retainedHistoryComplete: false
            ) == 2)
        }

        let reopened = try CoreDataSharedContentCache(configuration: configuration)
        #expect(try await reopened.appendBrowsedPageAllocatingOrdinal(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            pageId: "browsed-3",
            retainedCursor: "cursor-3",
            items: [item(42)],
            retainedHistoryComplete: false
        ) == 3)
        let snapshot = try #require(try await reopened.hydrateVerifiedOwner(
            verifiedOwnerId: "owner-a",
            conversationId: "conversation-a"
        ))
        #expect(snapshot.items.map(\.itemId).contains("item-40"))
        #expect(snapshot.items.map(\.itemId).contains("item-41"))
        #expect(!snapshot.items.map(\.itemId).contains("item-42"))
        #expect(snapshot.retainedOldestCursor == "cursor-2")
        #expect(!snapshot.retainedHistoryComplete)
    }

    @Test func accountPressureEvictsOnlyDeepestConversationPagesAndRepairsCursors() async throws {
        let cache = try CoreDataSharedContentCache(
            configuration: .init(
                now: { Date(timeIntervalSince1970: 1_700_000_000) },
                inMemory: true,
                newestProtectedCount: 40,
                perConversationItemLimit: 400,
                perAccountItemLimit: 83
            )
        )
        for conversation in ["conversation-a", "conversation-b"] {
            try await cache.replaceNewestWindow(
                ownerIdentityId: "owner-a",
                conversationId: conversation,
                items: (0..<40).map { item($0, conversationId: conversation) },
                retainedOldestCursor: "\(conversation)-newest-cursor",
                retainedHistoryComplete: false
            )
            try await cache.appendBrowsedPage(
                ownerIdentityId: "owner-a",
                conversationId: conversation,
                pageId: "\(conversation)-page-1",
                pageOrdinal: 1,
                retainedCursor: "\(conversation)-cursor-1",
                items: [item(40, conversationId: conversation)],
                retainedHistoryComplete: false
            )
            try await cache.appendBrowsedPage(
                ownerIdentityId: "owner-a",
                conversationId: conversation,
                pageId: "\(conversation)-page-2",
                pageOrdinal: 2,
                retainedCursor: "\(conversation)-cursor-2",
                items: [item(41, conversationId: conversation)],
                retainedHistoryComplete: false
            )
        }

        for conversation in ["conversation-a", "conversation-b"] {
            let snapshot = try #require(try await cache.hydrateVerifiedOwner(
                verifiedOwnerId: "owner-a",
                conversationId: conversation
            ))
            let ids = snapshot.items.map(\.itemId)
            #expect(ids.contains("item-40"))
            if ids.contains("item-41") {
                #expect(snapshot.retainedOldestCursor == "\(conversation)-cursor-2")
            } else {
                #expect(snapshot.retainedOldestCursor == "\(conversation)-cursor-1")
            }
            #expect(!snapshot.retainedHistoryComplete)
        }
    }

    @Test func ownerAndConversationPurgeVerifyZeroRowsAndSweepStaleOwners() async throws {
        let cache = try makeCache()
        try await cache.replaceNewestWindow(ownerIdentityId: "owner-a", conversationId: "conversation-a", items: [item(0)])
        try await cache.replaceNewestWindow(ownerIdentityId: "owner-a", conversationId: "conversation-b", items: [item(1, conversationId: "conversation-b")])
        try await cache.replaceNewestWindow(ownerIdentityId: "owner-b", conversationId: "conversation-a", items: [item(2, ownerMarker: "owner-b")])
        try await cache.replaceNewestWindow(ownerIdentityId: "owner-c", conversationId: "conversation-a", items: [item(3, ownerMarker: "owner-c")])

        try await cache.purgeConversation(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        let conversationPurged = try await cache.verifyOwnerPurged(ownerIdentityId: "owner-a", conversationId: "conversation-a")
        #expect(conversationPurged)
        let unrelated = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-a", conversationId: "conversation-b")
        #expect(unrelated?.items.map(\.itemId) == ["item-1"])

        try await cache.sweepNonCurrentOwners(currentOwnerIdentityId: "owner-b")
        let ownerAPurged = try await cache.verifyOwnerPurged(ownerIdentityId: "owner-a")
        let ownerCPurged = try await cache.verifyOwnerPurged(ownerIdentityId: "owner-c")
        let currentOwner = try await cache.hydrateVerifiedOwner(verifiedOwnerId: "owner-b", conversationId: "conversation-a")
        #expect(ownerAPurged)
        #expect(ownerCPurged)
        #expect(currentOwner?.items.map(\.itemId) == ["item-2"])

        try await cache.purgeOwner(ownerIdentityId: "owner-b")
        let ownerBPurged = try await cache.verifyOwnerPurged(ownerIdentityId: "owner-b")
        #expect(ownerBPurged)
    }

    @Test func sqliteCompanionFilesNeverContainSignedTokenSentinel() async throws {
        let root = temporaryDirectory("sentinel")
        defer { try? FileManager.default.removeItem(at: root) }
        let cache = try CoreDataSharedContentCache(
            configuration: .init(
                storeURL: root.appending(path: "SharedContentCache.sqlite"),
                now: { Date(timeIntervalSince1970: 1_700_000_000) }
            )
        )
        try await cache.replaceNewestWindow(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            items: [item(0, linkMetadataJson: "{\"hostname\":\"example.com\"}")]
        )
        let sentinel = Data("signed-token-sentinel-for-tests".utf8)
        let files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        #expect(files.contains { $0.pathExtension == "sqlite" })
        for file in files where ["sqlite", "wal", "shm"].contains(file.pathExtension) {
            #expect((try Data(contentsOf: file)).range(of: sentinel) == nil)
        }
    }

    @Test func phase13LegacyRowsReopenWithNilDurationAndTrustedValuesRoundTrip() throws {
        let legacy = Phase13DurationCacheContract()
        legacy.seedLegacy(itemId: "legacy-voice")
        let reopenedLegacy = legacy.reopen()
        #expect(reopenedLegacy.duration(itemId: "legacy-voice") == nil)
        #expect(reopenedLegacy.displayDuration(itemId: "legacy-voice") == "Duration unavailable")
        #expect(reopenedLegacy.displayDuration(itemId: "legacy-voice") != "0:00")

        let trusted = Phase13DurationCacheContract()
        try trusted.save(itemId: "trusted-voice", durationMs: 61_000)
        let reopenedTrusted = trusted.reopen()
        #expect(reopenedTrusted.duration(itemId: "trusted-voice") == 61_000)
        #expect(reopenedTrusted.displayDuration(itemId: "trusted-voice") == "1:01")
    }

    @Test func phase13NegativeDurationIsRejectedBeforeSaveAndAuthorityNeverPersists() throws {
        let cache = Phase13DurationCacheContract()

        #expect(throws: Phase13DurationCacheFailure.invalidDuration) {
            try cache.save(itemId: "negative", durationMs: -1)
        }
        #expect(cache.persistedItemIds.isEmpty)
        #expect(!cache.persistedFieldNames.contains("deliveryUrl"))
        #expect(!cache.persistedFieldNames.contains("storagePath"))
        #expect(!cache.persistedFieldNames.contains("providerError"))
        #expect(!cache.persistedFieldNames.contains("canDelete"))
        #expect(!cache.persistedFieldNames.contains("canExport"))
    }

    @Test func durationCacheProductionContractMigratesLegacyRowsAndRollsBackInvalidValues() async throws {
        let root = temporaryDirectory("duration-migration")
        defer { try? FileManager.default.removeItem(at: root) }
        let storeURL = root.appending(path: "SharedContentCache.sqlite")
        try seedLegacyStore(at: storeURL)

        let configuration = SharedContentCacheConfiguration(
            storeURL: storeURL,
            now: { Date(timeIntervalSince1970: 1_700_000_000) }
        )
        do {
            let cache = try CoreDataSharedContentCache(configuration: configuration)
            let legacy = try #require(
                try await cache.hydrateVerifiedOwner(
                    verifiedOwnerId: "owner-a",
                    conversationId: "conversation-a"
                )
            )
            #expect(legacy.items.first?.itemId == "legacy-voice")
            #expect(legacy.items.first?.durationMs == nil)

            try await cache.appendBrowsedPage(
                ownerIdentityId: "owner-a",
                conversationId: "conversation-a",
                pageId: "browsed-duration",
                pageOrdinal: 1,
                retainedCursor: nil,
                items: [item(1, durationMs: 61_000)],
                retainedHistoryComplete: true
            )
            let accepted = try #require(
                try await cache.hydrateVerifiedOwner(
                    verifiedOwnerId: "owner-a",
                    conversationId: "conversation-a"
                )
            )
            #expect(accepted.items.map(\.durationMs) == [61_000, nil])

            await #expect(throws: SharedContentCacheFailure.invalidInput) {
                try await cache.appendBrowsedPage(
                    ownerIdentityId: "owner-a",
                    conversationId: "conversation-a",
                    pageId: "invalid-duration",
                    pageOrdinal: 2,
                    retainedCursor: nil,
                    items: [item(2, durationMs: -1)],
                    retainedHistoryComplete: true
                )
            }
            let afterRejected = try #require(
                try await cache.hydrateVerifiedOwner(
                    verifiedOwnerId: "owner-a",
                    conversationId: "conversation-a"
                )
            )
            #expect(afterRejected == accepted)
        }

        let reopened = try CoreDataSharedContentCache(configuration: configuration)
        let reopenedSnapshot = try #require(
            try await reopened.hydrateVerifiedOwner(
                verifiedOwnerId: "owner-a",
                conversationId: "conversation-a"
            )
        )
        #expect(reopenedSnapshot.items.map(\.durationMs) == [61_000, nil])
        #expect(try root.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)

        let model = try #require(CoreDataSharedContentCache.loadModelForTesting())
        let duration = try #require(
            model.entitiesByName["SharedContentCacheItemRecord"]?
                .attributesByName["durationMs"]
        )
        #expect(duration.isOptional)
        #expect(duration.attributeType == .integer64AttributeType)
    }

    private func makeCache(now: Date = Date(timeIntervalSince1970: 1_700_000_000)) throws -> CoreDataSharedContentCache {
        try CoreDataSharedContentCache(configuration: .inMemory(now: now))
    }

    private func item(
        _ index: Int,
        conversationId: String = "conversation-a",
        ownerMarker: String = "owner-a",
        linkMetadataJson: String? = nil,
        durationMs: Int64? = nil
    ) -> StoredSharedContentItem {
        StoredSharedContentItem(
            itemId: "item-\(index)",
            conversationId: conversationId,
            sourceMessageId: "message-\(index)",
            senderId: ownerMarker,
            sourceCreatedAt: "2026-07-23T00:00:\(String(format: "%02d", index % 60))Z",
            sourceRank: index,
            category: "files",
            kind: "document",
            attachmentId: "attachment-\(index)",
            attachmentOriginalName: "notes-\(index).pdf",
            attachmentMimeType: "application/pdf",
            attachmentByteSize: 10,
            durationMs: durationMs,
            linkMetadataJson: linkMetadataJson
        )
    }

    private func seedLegacyStore(at storeURL: URL) throws {
        let currentModel = try #require(CoreDataSharedContentCache.loadModelForTesting())
        let legacyModel = try #require(currentModel.copy() as? NSManagedObjectModel)
        let itemEntity = try #require(legacyModel.entitiesByName["SharedContentCacheItemRecord"])
        itemEntity.properties = itemEntity.properties.filter { $0.name != "durationMs" }

        try FileManager.default.createDirectory(
            at: storeURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let coordinator = NSPersistentStoreCoordinator(managedObjectModel: legacyModel)
        let store = try coordinator.addPersistentStore(
            ofType: NSSQLiteStoreType,
            configurationName: nil,
            at: storeURL,
            options: [NSPersistentStoreFileProtectionKey: FileProtectionType.complete]
        )
        let context = NSManagedObjectContext(concurrencyType: .privateQueueConcurrencyType)
        context.persistentStoreCoordinator = coordinator
        var operationError: Error?
        context.performAndWait {
            do {
                let owner = NSEntityDescription.insertNewObject(
                    forEntityName: "SharedContentCacheOwnerRecord",
                    into: context
                )
                owner.setValue("owner-a", forKey: "ownerIdentityId")
                owner.setValue("conversation-a", forKey: "conversationId")
                owner.setValue(1, forKey: "schemaVersion")
                owner.setValue(Date(timeIntervalSince1970: 1_600_000_000), forKey: "savedAt")
                owner.setValue(Date(timeIntervalSince1970: 1_600_000_000), forKey: "lastAccessedAt")
                owner.setValue(false, forKey: "authoritativeEmptyConfirmed")
                owner.setValue(true, forKey: "retainedHistoryComplete")
                owner.setValue(true, forKey: "newestWindowProtected")

                let page = NSEntityDescription.insertNewObject(
                    forEntityName: "SharedContentCachePageRecord",
                    into: context
                )
                page.setValue("owner-a", forKey: "ownerIdentityId")
                page.setValue("conversation-a", forKey: "conversationId")
                page.setValue("newest", forKey: "pageId")
                page.setValue(0, forKey: "pageOrdinal")
                page.setValue(Date(timeIntervalSince1970: 1_600_000_000), forKey: "lastAccessedAt")
                page.setValue(true, forKey: "isNewestWindow")

                let item = NSEntityDescription.insertNewObject(
                    forEntityName: "SharedContentCacheItemRecord",
                    into: context
                )
                item.setValue("owner-a", forKey: "ownerIdentityId")
                item.setValue("conversation-a", forKey: "conversationId")
                item.setValue("legacy-voice", forKey: "itemId")
                item.setValue("legacy-message", forKey: "sourceMessageId")
                item.setValue("owner-a", forKey: "senderId")
                item.setValue("2026-07-23T00:00:00Z", forKey: "sourceCreatedAt")
                item.setValue(0, forKey: "sourceRank")
                item.setValue("voice", forKey: "category")
                item.setValue("voice", forKey: "kind")
                item.setValue("legacy-attachment", forKey: "attachmentId")
                item.setValue("newest", forKey: "pageId")
                try context.save()
            } catch {
                operationError = error
            }
        }
        if let operationError { throw operationError }
        try coordinator.remove(store)
    }

    private func temporaryDirectory(_ name: String) -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "fish-shared-cache-tests-\(name)-\(UUID().uuidString)", directoryHint: .isDirectory)
    }
}

private final class MutableClock: @unchecked Sendable {
    var value: Date

    init(_ value: Date) {
        self.value = value
    }
}

private enum Phase13DurationCacheFailure: Error, Equatable {
    case invalidDuration
}

private final class Phase13DurationCacheContract {
    let persistedFieldNames: Set<String> = [
        "ownerIdentityId",
        "conversationId",
        "itemId",
        "sourceMessageId",
        "category",
        "kind",
        "durationMs",
    ]

    private var rows: [String: Int64?] = [:]

    var persistedItemIds: [String] { rows.keys.sorted() }

    func seedLegacy(itemId: String) {
        rows[itemId] = .some(nil)
    }

    func save(itemId: String, durationMs: Int64?) throws {
        if let durationMs, durationMs < 0 {
            throw Phase13DurationCacheFailure.invalidDuration
        }
        rows[itemId] = .some(durationMs)
    }

    func duration(itemId: String) -> Int64? {
        rows[itemId] ?? nil
    }

    func displayDuration(itemId: String) -> String {
        guard let duration = duration(itemId: itemId) else {
            return "Duration unavailable"
        }
        let seconds = duration / 1_000
        return "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }

    func reopen() -> Phase13DurationCacheContract {
        let reopened = Phase13DurationCacheContract()
        reopened.rows = rows
        return reopened
    }
}
