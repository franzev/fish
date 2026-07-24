import ChatCore
import ChatData
import Foundation
import Testing

private actor DeliveryRefreshRecorder {
    private(set) var calls: [[String]] = []
    private var sequence = 0

    func refresh(_ ids: [String]) -> [SignedAttachmentUrl] {
        calls.append(ids)
        sequence += 1
        return ids.map { id in
            SignedAttachmentUrl(
                attachmentId: id,
                thumbnailUrl: URL(string: "https://fish.test/thumb-\(sequence)-\(id)"),
                displayUrl: URL(string: "https://fish.test/display-\(sequence)-\(id)")
            )
        }
    }
}

private final class DeliveryClock: @unchecked Sendable {
    var date: Date

    init(_ date: Date = Date(timeIntervalSince1970: 0)) {
        self.date = date
    }
}

private actor SuspendedDeliveryRefresh {
    private var continuation: CheckedContinuation<[SignedAttachmentUrl], Never>?
    private var startedWaiters: [CheckedContinuation<Void, Never>] = []

    func refresh(_ ids: [String]) async -> [SignedAttachmentUrl] {
        startedWaiters.forEach { $0.resume() }
        startedWaiters.removeAll()
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilStarted() async {
        if continuation != nil { return }
        await withCheckedContinuation { continuation in
            startedWaiters.append(continuation)
        }
    }

    func finish(attachmentId: String) {
        continuation?.resume(returning: [
            SignedAttachmentUrl(
                attachmentId: attachmentId,
                thumbnailUrl: URL(string: "https://fish.test/late"),
                displayUrl: nil
            ),
        ])
        continuation = nil
    }
}

@Suite(.serialized)
struct SharedContentDeliveryStoreTests {
    @Test func deliveryDeduplicatesAndChunksAtFifty() async throws {
        let recorder = DeliveryRefreshRecorder()
        let store = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in await recorder.refresh(ids) }
        )

        let ids = (0..<51).map { "attachment-\($0)" } + ["attachment-0"]
        let resolved = try await store.resolve(attachmentIds: ids)
        let calls = await recorder.calls

        #expect(calls.map(\.count) == [50, 1])
        #expect(resolved.count == 51)
        #expect(resolved.keys.allSatisfy { $0.hasPrefix("attachment-") })
    }

    @Test func freshnessUsesTwoMinuteMarginAndKeepsOpaqueIdentityAcrossRotation() async throws {
        let recorder = DeliveryRefreshRecorder()
        let clock = DeliveryClock()
        let store = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in await recorder.refresh(ids) },
            now: { clock.date }
        )

        let first = try #require(await store.lease(for: "attachment-a"))
        clock.date = Date(timeIntervalSince1970: 13 * 60 - 1)
        let stillFresh = try #require(await store.lease(for: "attachment-a"))
        #expect(stillFresh == first)

        clock.date = Date(timeIntervalSince1970: 13 * 60)
        let rotated = try #require(await store.lease(for: "attachment-a"))
        #expect(rotated.opaqueKey == first.opaqueKey)
        #expect(rotated.thumbnailUrl != first.thumbnailUrl)
        #expect(await recorder.calls.count == 2)
    }

    @Test func authorizationFailureInvalidatesAndRefreshesExactlyOnce() async throws {
        let recorder = DeliveryRefreshRecorder()
        let store = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in await recorder.refresh(ids) }
        )

        _ = try await store.lease(for: "attachment-a")
        #expect(try await store.refreshAfterAuthorizationFailure(statusCode: 401, attachmentId: "attachment-a") != nil)
        #expect(await recorder.calls.count == 2)

        #expect(try await store.refreshAfterAuthorizationFailure(statusCode: 403, attachmentId: "attachment-a") == nil)
        #expect(await recorder.calls.count == 2)
    }

    @Test func ephemeralSessionDisablesDurableCookiesCacheAndCredentials() {
        let configuration = SharedContentEphemeralSession.configuration()

        #expect(configuration.urlCache == nil)
        #expect(configuration.httpCookieStorage == nil)
        #expect(configuration.urlCredentialStorage == nil)
        #expect(configuration.requestCachePolicy == .reloadIgnoringLocalCacheData)
    }

    @Test func leasesAreOwnerGenerationScopedAndRedacted() async throws {
        let recorder = DeliveryRefreshRecorder()
        let store = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 7,
            refreshAttachmentUrls: { ids in await recorder.refresh(ids) }
        )
        let lease = try #require(await store.lease(for: "attachment-a"))

        #expect(lease.opaqueKey == "attachment-a")
        #expect(String(describing: lease).contains("https://") == false)
        #expect(String(describing: lease).contains("owner-a") == false)
        #expect(String(describing: lease).contains("conversation-a") == false)
        #expect(await store.count == 1)
        #expect(await store.clearGeneration(6) == 0)
        #expect(await store.clearGeneration(7) == 1)
        #expect(await store.count == 0)
    }

    @Test func clearDuringSuspendedRefreshRejectsTheLateLease() async {
        let refresh = SuspendedDeliveryRefresh()
        let store = SharedContentDeliveryStore(
            ownerIdentityId: "owner-a",
            conversationId: "conversation-a",
            identityGeneration: 1,
            refreshAttachmentUrls: { ids in await refresh.refresh(ids) }
        )
        let resolve = Task {
            try await store.resolve(attachmentIds: ["attachment-a"])
        }
        await refresh.waitUntilStarted()

        #expect(await store.clear() == 0)
        await refresh.finish(attachmentId: "attachment-a")

        await #expect(throws: CancellationError.self) {
            _ = try await resolve.value
        }
        #expect(await store.count == 0)
    }
}
