import ChatCore
import ChatData
import Foundation
import Testing
import TestSupport
@testable import PersonalChat

private final class ImageURLProtocol: URLProtocol {
    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var handler: @Sendable (URLRequest) -> (Int, Data) = {
        _ in (500, Data())
    }

    static func reset(handler: @escaping @Sendable (URLRequest) -> (Int, Data)) {
        requests = []
        self.handler = handler
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        let (status, data) = Self.handler(request)
        client?.urlProtocol(self, didReceive: HTTPURLResponse(
            url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil
        )!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private let publicTestMediaResolver = SharedContentDNSResolver {
    _ in ["93.184.216.34"]
}

private actor ImageRefreshCommands: AttachmentCommandProviding {
    private(set) var refreshCount = 0
    let freshUrl: URL

    init(freshUrl: URL) { self.freshUrl = freshUrl }
    func initializeUpload(_ request: InitializeAttachmentRequest) async throws -> AttachmentUploadAuthorization {
        throw AttachmentCommandFailure.unavailable
    }
    func completeUpload(attachmentId: String) async throws -> ChatAttachment {
        throw AttachmentCommandFailure.unavailable
    }
    func cancelUpload(attachmentId: String) async {}
    func refreshUrls(attachmentIds: [String]) async throws -> [SignedAttachmentUrl] {
        refreshCount += 1
        return [SignedAttachmentUrl(
            attachmentId: attachmentIds[0], thumbnailUrl: freshUrl, displayUrl: freshUrl
        )]
    }
}

@Suite(.serialized) struct MessageImageLoaderTests {
    @Test func cacheIsKeyedByImmutableStoragePathNotSignedUrl() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { _ in (200, data) }
        let cache = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: cache) }
        let loader = MessageImageLoader(
            session: session(), cacheRoot: cache, allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver, requiresPeerValidation: false
        )
        _ = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://media.fish.example.com/first-token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 120, height: 120)
        )
        ImageURLProtocol.handler = { _ in (500, Data()) }
        _ = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://media.fish.example.com/second-token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 120, height: 120)
        )
        #expect(ImageURLProtocol.requests.count == 1)
    }

    @Test func expiredUrlRefreshesExactlyOnceThenLoads() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { request in
            request.url?.path() == "/expired" ? (403, Data()) : (200, data)
        }
        let commands = ImageRefreshCommands(
            freshUrl: URL(string: "https://media.fish.example.com/fresh")!
        )
        let cache = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: cache) }
        let loader = MessageImageLoader(
            session: session(), cacheRoot: cache, allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver, requiresPeerValidation: false
        )
        let image = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://media.fish.example.com/expired")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 100, height: 100),
            commands: commands
        )
        #expect(image.size.width > 0)
        #expect(ImageURLProtocol.requests.map { $0.url?.path() } == ["/expired", "/fresh"])
        #expect(await commands.refreshCount == 1)
    }

    @Test func largerViewerRequestsDecodeMorePixelsFromTheSameDiskObject() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { _ in (200, data) }
        let cache = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: cache) }
        let loader = MessageImageLoader(
            session: session(), cacheRoot: cache, allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver, requiresPeerValidation: false
        )
        let small = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://media.fish.example.com/token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 48, height: 48)
        )
        let large = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://media.fish.example.com/another-token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 480, height: 480)
        )

        #expect((large.cgImage?.width ?? 0) > (small.cgImage?.width ?? 0))
        #expect(ImageURLProtocol.requests.count == 1)
    }

    @Test func untrustedHostsAreNeverFetched() async {
        ImageURLProtocol.reset { _ in (200, Data()) }
        let loader = MessageImageLoader(
            session: session(), cacheRoot: temporaryDirectory(),
            allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver, requiresPeerValidation: false
        )
        await #expect(throws: MessageImageLoadFailure.self) {
            _ = try await loader.image(
                storagePath: "c/a/display.webp",
                url: URL(string: "https://evil.test/file")!,
                attachmentId: "a",
                targetPixelSize: CGSize(width: 100, height: 100)
            )
        }
        #expect(ImageURLProtocol.requests.isEmpty)
    }

    @Test func remoteDownloadsFailClosedWithoutAConfiguredHost() async {
        ImageURLProtocol.reset { _ in (200, Data()) }
        let cache = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: cache) }
        let loader = MessageImageLoader(session: session(), cacheRoot: cache)
        await #expect(throws: MessageImageLoadFailure.self) {
            _ = try await loader.image(
                storagePath: "c/a/display.webp",
                url: URL(string: "https://media.fish.example.com/file")!,
                attachmentId: "a",
                targetPixelSize: CGSize(width: 100, height: 100)
            )
        }

        let remoteAttachment = MessageAttachmentUiModel(attachment: ChatAttachment(
            id: "document",
            kind: .file,
            originalName: "notes.pdf",
            mimeType: "application/pdf",
            byteSize: 100,
            displayPath: "c/document/file.pdf",
            displayUrl: URL(string: "https://media.fish.example.com/file")
        ))
        let downloader = AttachmentFileDownloader(session: session())
        await #expect(throws: MessageImageLoadFailure.self) {
            _ = try await downloader.download(remoteAttachment)
        }
        #expect(ImageURLProtocol.requests.isEmpty)
    }

    @Test func sharedContentIntentKeepsVisibleLookaheadAndSelectedFullContentDistinct() {
        let contract = SharedContentImageContract()
        let plan = contract.plan(
            visible: ["item-a", "item-b", "item-b"],
            lookahead: ["item-c", "item-c"],
            selected: ["item-d", "item-d"],
            lookaheadAllowed: true
        )

        #expect(plan == [
            ImageIntentBatch(intent: .visibleThumbnail, keys: ["item-a", "item-b"]),
            ImageIntentBatch(intent: .lookaheadThumbnail, keys: ["item-c"]),
            ImageIntentBatch(intent: .selectedFullContent, keys: ["item-d"]),
        ])
    }

    @Test func lowDataModeSuppressesLookaheadButKeepsVisibleIntent() {
        let contract = SharedContentImageContract()
        let plan = contract.plan(
            visible: ["item-a"],
            lookahead: ["item-b"],
            selected: [],
            lookaheadAllowed: false
        )

        #expect(plan == [ImageIntentBatch(intent: .visibleThumbnail, keys: ["item-a"])])
    }

    @Test func sharedContentLoaderRejectsStaleGenerationAfterAwaitAndUsesOpaqueCacheIdentity() {
        let contract = SharedContentImageContract()
        let first = contract.cacheIdentity(owner: "owner-a", conversation: "conversation-a", item: "item-a", generation: 1)
        let rotated = contract.cacheIdentity(owner: "owner-a", conversation: "conversation-a", item: "item-a", generation: 1)

        #expect(first == rotated)
        #expect(!contract.acceptCallback(owner: "owner-a", generation: 1, currentGeneration: 2))
        #expect(contract.acceptCallback(owner: "owner-b", generation: 2, currentGeneration: 2))
        #expect(!first.contains("owner-a"))
    }

    @Test func sharedContentUsesOpaqueContentVersionIdentityAcrossUrlRotation() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { _ in (200, data) }
        let loader = MessageImageLoader(
            session: session(),
            sharedSession: session(),
            cacheRoot: temporaryDirectory(),
            allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver,
            requiresPeerValidation: false
        )
        let context = MessageImageLoader.LoadContext(
            ownerIdentityId: "owner-a",
            identityGeneration: 1,
            conversationId: "conversation-a",
            attachmentId: "attachment-a",
            contentVersion: "version-1",
            intent: .visibleThumbnail,
            targetPixelSize: CGSize(width: 120, height: 120)
        )

        _ = try await loader.image(url: URL(string: "https://media.fish.example.com/first-token")!, context: context)
        _ = try await loader.image(url: URL(string: "https://media.fish.example.com/second-token")!, context: context)
        #expect(ImageURLProtocol.requests.count == 1)
    }

    @Test func sharedContentRejectsOldGenerationBeforeNetworkAndAfterRotation() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { _ in (200, data) }
        let loader = MessageImageLoader(
            sharedSession: session(),
            cacheRoot: temporaryDirectory(),
            allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver,
            requiresPeerValidation: false
        )
        await loader.setCurrentGeneration(ownerIdentityId: "owner-a", identityGeneration: 2)
        let context = MessageImageLoader.LoadContext(
            ownerIdentityId: "owner-a",
            identityGeneration: 1,
            conversationId: "conversation-a",
            attachmentId: "attachment-a",
            contentVersion: "version-1",
            intent: .visibleThumbnail,
            targetPixelSize: CGSize(width: 120, height: 120)
        )

        await #expect(throws: MessageImageLoadFailure.staleGeneration) {
            _ = try await loader.image(url: URL(string: "https://media.fish.example.com/old")!, context: context)
        }
        #expect(ImageURLProtocol.requests.isEmpty)
    }

    @Test func sharedContentIntentControlsThumbnailDurability() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { _ in (200, data) }
        let root = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let thumbnailStore = try SharedContentThumbnailStore(root: root)
        let loader = MessageImageLoader(
            sharedSession: session(),
            cacheRoot: temporaryDirectory(),
            allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver,
            requiresPeerValidation: false
        )

        let visible = MessageImageLoader.LoadContext(
            ownerIdentityId: "owner-a", identityGeneration: 1, conversationId: "conversation-a",
            attachmentId: "attachment-visible", contentVersion: "v1", intent: .visibleThumbnail,
            targetPixelSize: CGSize(width: 120, height: 120)
        )
        let lookahead = MessageImageLoader.LoadContext(
            ownerIdentityId: "owner-a", identityGeneration: 1, conversationId: "conversation-a",
            attachmentId: "attachment-lookahead", contentVersion: "v1", intent: .lookaheadThumbnail,
            targetPixelSize: CGSize(width: 120, height: 120)
        )
        let selected = MessageImageLoader.LoadContext(
            ownerIdentityId: "owner-a", identityGeneration: 1, conversationId: "conversation-a",
            attachmentId: "attachment-selected", contentVersion: "v1", intent: .selectedFullContent,
            targetPixelSize: CGSize(width: 120, height: 120)
        )

        _ = try await loader.image(url: URL(string: "https://media.fish.example.com/visible")!, context: visible, thumbnailStore: thumbnailStore)
        #expect(await thumbnailStore.persistedFileCount(ownerIdentityId: "owner-a") == 0)
        #expect(
            await thumbnailStore.confirmDisplayed(
                SharedContentThumbnailKey(
                    "owner-a",
                    "conversation-a",
                    "attachment-visible",
                    "v1",
                    identityGeneration: 1
                )
            )
        )

        _ = try await loader.image(url: URL(string: "https://media.fish.example.com/lookahead")!, context: lookahead, thumbnailStore: thumbnailStore)
        _ = try await loader.image(url: URL(string: "https://media.fish.example.com/selected")!, context: selected, thumbnailStore: thumbnailStore)
        #expect(await thumbnailStore.persistedFileCount(ownerIdentityId: "owner-a") == 1)
    }

    @Test func sharedContentPurgeClearsDecodedMemoryDiskAndTemporaryReferences() {
        let contract = SharedContentImageContract()
        contract.seed(owner: "owner-a")
        contract.purge(owner: "owner-a")

        #expect(contract.memoryCount == 0)
        #expect(contract.diskCount == 0)
        #expect(contract.temporaryCount == 0)
        #expect(contract.deliveryReferenceCount == 0)
    }

    @Test func generationAddressableCleanupCancelsOldSharedWorkAndRejectsItsCallbacks() async throws {
        let data = try Data(contentsOf: AttachmentFixtures.imageUrl)
        ImageURLProtocol.reset { _ in (200, data) }
        let cache = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: cache) }
        let loader = MessageImageLoader(
            sharedSession: session(),
            cacheRoot: cache,
            allowedHost: "media.fish.example.com",
            mediaResolver: publicTestMediaResolver,
            requiresPeerValidation: false
        )
        let ownerGeneration = SharedContentOwnerGeneration(ownerIdentityId: "owner-a", generation: 1)
        let context = MessageImageLoader.LoadContext(
            ownerIdentityId: ownerGeneration.ownerIdentityId,
            identityGeneration: ownerGeneration.generation,
            conversationId: "conversation-a",
            attachmentId: "attachment-a",
            contentVersion: "v1",
            intent: .visibleThumbnail,
            targetPixelSize: CGSize(width: 120, height: 120)
        )

        _ = try await loader.image(url: URL(string: "https://media.fish.example.com/old")!, context: context)
        await loader.cancelAndRemove(ownerGeneration: ownerGeneration)
        await loader.setCurrentGeneration(ownerIdentityId: "owner-a", identityGeneration: 2)

        await #expect(throws: MessageImageLoadFailure.staleGeneration) {
            _ = try await loader.image(url: URL(string: "https://media.fish.example.com/stale")!, context: context)
        }
    }

    private func session() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ImageURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "fish-image-loader-\(UUID().uuidString)", directoryHint: .isDirectory)
    }
}

private enum ImageLoadIntent: Equatable { case visibleThumbnail, lookaheadThumbnail, selectedFullContent }

private struct ImageIntentBatch: Equatable {
    let intent: ImageLoadIntent
    let keys: [String]
}

private final class SharedContentImageContract {
    private(set) var memoryCount = 0
    private(set) var diskCount = 0
    private(set) var temporaryCount = 0
    private(set) var deliveryReferenceCount = 0

    func plan(visible: [String], lookahead: [String], selected: [String], lookaheadAllowed: Bool) -> [ImageIntentBatch] {
        var batches = [ImageIntentBatch(intent: .visibleThumbnail, keys: visible.uniquePreservingOrder())]
        if lookaheadAllowed, !lookahead.isEmpty {
            batches.append(ImageIntentBatch(intent: .lookaheadThumbnail, keys: lookahead.uniquePreservingOrder()))
        }
        if !selected.isEmpty {
            batches.append(ImageIntentBatch(intent: .selectedFullContent, keys: selected.uniquePreservingOrder()))
        }
        return batches
    }

    func cacheIdentity(owner: String, conversation: String, item: String, generation: Int) -> String {
        _ = (owner, conversation, generation)
        return "opaque-cache-\(item)"
    }

    func acceptCallback(owner: String, generation: Int, currentGeneration: Int) -> Bool {
        !owner.isEmpty && generation == currentGeneration
    }

    func seed(owner: String) {
        _ = owner
        memoryCount = 1
        diskCount = 1
        temporaryCount = 1
        deliveryReferenceCount = 1
    }

    func purge(owner: String) {
        _ = owner
        memoryCount = 0
        diskCount = 0
        temporaryCount = 0
        deliveryReferenceCount = 0
    }
}

private extension Array where Element == String {
    func uniquePreservingOrder() -> [String] {
        var seen = Set<String>()
        return filter { seen.insert($0).inserted }
    }
}
