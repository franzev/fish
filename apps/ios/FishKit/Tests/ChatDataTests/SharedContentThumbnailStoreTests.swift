import ChatCore
import ChatData
import Foundation
import Testing

private final class ThumbnailClock: @unchecked Sendable {
    var date: Date

    init(_ date: Date = Date(timeIntervalSince1970: 2_000)) {
        self.date = date
    }
}

@Suite(.serialized)
struct SharedContentThumbnailStoreTests {
    @Test func lookaheadIsMemoryOnlyDisplayedConfirmationWritesOneProtectedFileAndSelectionWritesNoFullFile() async throws {
        let root = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try SharedContentThumbnailStore(root: root)
        let key = SharedContentThumbnailKey(
            "owner-a", "conversation-a", "item-a", "v1", identityGeneration: 1
        )

        #expect(await store.stageLookahead(key, bytes: Data([1, 2, 3])))
        #expect(await store.persistedFileCount(ownerIdentityId: "owner-a") == 0)
        #expect(await store.readRenderable(key)?.data == Data([1, 2, 3]))
        #expect(await store.readDisplayed(key) == nil)

        #expect(await store.confirmDisplayed(key))
        #expect(await store.persistedFileCount(ownerIdentityId: "owner-a") == 1)
        #expect(await store.readDisplayed(key)?.data == Data([1, 2, 3]))

        #expect(await store.stage(key, bytes: Data([9, 8, 7]), intent: .selectedFullContent) == false)
        #expect(await store.persistedFileCount(ownerIdentityId: "owner-a") == 1)
    }

    @Test func thumbnailKeysAreOpaqueAndPathsStayContained() throws {
        let key = SharedContentThumbnailKey(
            "owner-a", "conversation-a", "item-a", "v1", identityGeneration: 1
        )
        #expect(key.opaqueRelativePath.contains("owner-a") == false)
        #expect(key.opaqueRelativePath.contains("conversation-a") == false)
        #expect(key.opaqueRelativePath.contains("item-a") == false)
        #expect(key.opaqueRelativePath.contains("v1") == false)
        #expect(key.opaqueRelativePath.hasSuffix(".thumb"))

        #expect(key.opaqueRelativePath.hasPrefix("../") == false)
    }

    @Test func pruningUsesSixtyFourMiBAndThirtyDayInactivityLimits() async throws {
        let root = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let clock = ThumbnailClock(Date(timeIntervalSince1970: 2_000))
        let store = try SharedContentThumbnailStore(root: root, now: { clock.date })

        let old = SharedContentThumbnailKey(
            "owner-a", "conversation-a", "item-old", "v1", identityGeneration: 1
        )
        #expect(await store.stageLookahead(old, bytes: Data(repeating: 1, count: 8 * MIB)))
        #expect(await store.confirmDisplayed(old))

        clock.date = Date(timeIntervalSince1970: 2_000 + 31 * DAY)
        for index in 0..<9 {
            let key = SharedContentThumbnailKey(
                "owner-a", "conversation-a", "item-\(index)", "v1", identityGeneration: 1
            )
            #expect(await store.stageLookahead(key, bytes: Data(repeating: UInt8(index), count: 8 * MIB)))
            #expect(await store.confirmDisplayed(key))
        }
        await store.prune(ownerIdentityId: "owner-a")

        #expect(await store.persistedByteCount(ownerIdentityId: "owner-a") <= 64 * MIB)
        #expect(await store.readDisplayed(old) == nil)
        #expect(
            await store.readDisplayed(
                SharedContentThumbnailKey(
                    "owner-a", "conversation-a", "item-8", "v1", identityGeneration: 1
                )
            ) != nil
        )
    }

    @Test func rootIsBackupExcludedAndOwnerPurgeReturnsSafeZeroCounts() async throws {
        let root = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try SharedContentThumbnailStore(root: root)
        let key = SharedContentThumbnailKey(
            "owner-a", "conversation-a", "item-a", "v1", identityGeneration: 1
        )
        #expect(await store.stageLookahead(key, bytes: Data([1])))
        #expect(await store.confirmDisplayed(key))

        let values = try root.resourceValues(forKeys: [.isExcludedFromBackupKey])
        #expect(values.isExcludedFromBackup == true)
        #expect(await store.purgeOwner(ownerIdentityId: "owner-a"))
        #expect(await store.persistedFileCount(ownerIdentityId: "owner-a") == 0)
        #expect(await store.stagedCount == 0)
    }

    @Test func selectedBytesAndDeliverySentinelsNeverEnterThumbnailStorage() async throws {
        let root = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try SharedContentThumbnailStore(root: root)
        let key = SharedContentThumbnailKey(
            "owner-a", "conversation-a", "item-a", "v1", identityGeneration: 1
        )
        let sentinel = Data("opaque-delivery-probe".utf8)

        #expect(await store.stage(key, bytes: sentinel, intent: .selectedFullContent) == false)
        #expect(await store.stageLookahead(key, bytes: Data([1, 2, 3])))
        #expect(await store.confirmDisplayed(key))
        let files: [URL]
        if let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) {
            files = enumerator.compactMap { $0 as? URL }
        } else {
            files = []
        }
        let fileBytes = try files.filter { $0.pathExtension == "thumb" }.map { try Data(contentsOf: $0) }
        #expect(fileBytes.contains(sentinel) == false)
    }

    @Test func revokedGenerationRejectsLateStagingAndCannotBeConfirmed() async throws {
        let root = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try SharedContentThumbnailStore(root: root)
        let stale = SharedContentThumbnailKey(
            "owner-a",
            "conversation-a",
            "item-a",
            "v1",
            identityGeneration: 1
        )

        await store.revokeIdentityGeneration(ownerIdentityId: "owner-a", through: 1)

        #expect(await store.stageLookahead(stale, bytes: Data([1, 2, 3])) == false)
        #expect(await store.confirmDisplayed(stale) == false)
        #expect(await store.stagedCount(ownerIdentityId: "owner-a") == 0)
        #expect(await store.persistedFileCount(ownerIdentityId: "owner-a") == 0)
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "fish-thumbnail-store-\(UUID().uuidString)", directoryHint: .isDirectory)
    }
}

private let MIB = 1_048_576
private let DAY: TimeInterval = 24 * 60 * 60
