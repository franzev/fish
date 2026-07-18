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
            session: session(), cacheRoot: cache, allowedHost: "fish.test"
        )
        _ = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://fish.test/first-token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 120, height: 120)
        )
        ImageURLProtocol.handler = { _ in (500, Data()) }
        _ = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://fish.test/second-token")!,
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
            freshUrl: URL(string: "https://fish.test/fresh")!
        )
        let cache = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: cache) }
        let loader = MessageImageLoader(
            session: session(), cacheRoot: cache, allowedHost: "fish.test"
        )
        let image = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://fish.test/expired")!,
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
            session: session(), cacheRoot: cache, allowedHost: "fish.test"
        )
        let small = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://fish.test/token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 48, height: 48)
        )
        let large = try await loader.image(
            storagePath: "c/a/display.webp",
            url: URL(string: "https://fish.test/another-token")!,
            attachmentId: "a",
            targetPixelSize: CGSize(width: 480, height: 480)
        )

        #expect((large.cgImage?.width ?? 0) > (small.cgImage?.width ?? 0))
        #expect(ImageURLProtocol.requests.count == 1)
    }

    @Test func untrustedHostsAreNeverFetched() async {
        ImageURLProtocol.reset { _ in (200, Data()) }
        let loader = MessageImageLoader(
            session: session(), cacheRoot: temporaryDirectory(), allowedHost: "fish.test"
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
                url: URL(string: "https://fish.test/file")!,
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
            displayUrl: URL(string: "https://fish.test/file")
        ))
        let downloader = AttachmentFileDownloader(session: session())
        await #expect(throws: MessageImageLoadFailure.self) {
            _ = try await downloader.download(remoteAttachment)
        }
        #expect(ImageURLProtocol.requests.isEmpty)
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
