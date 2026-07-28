import Foundation
import Testing
@testable import ChatData

/// Stub transport for `BackgroundAttachmentUploadCoordinator`'s own tests.
/// Responses are delivered after `delay` so a test can create a task and
/// still find it "in flight" via `session.getAllTasks` a moment later —
/// exactly the window `upload(request:fileUrl:attachmentId:)` must reconcile
/// against instead of racing a duplicate PUT.
private final class CoordinatorURLProtocol: URLProtocol {
    nonisolated(unsafe) static var requestCount = 0
    nonisolated(unsafe) static var delay: TimeInterval = 0
    nonisolated(unsafe) static var handler: (URLRequest) -> (Int, Data) = { _ in (200, Data()) }

    static func reset(delay: TimeInterval = 0, handler: @escaping (URLRequest) -> (Int, Data) = { _ in (200, Data()) }) {
        requestCount = 0
        self.delay = delay
        self.handler = handler
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestCount += 1
        // Runs on URLSession's own loading queue, not the caller's thread —
        // blocking it briefly delays the response without needing an async
        // hop off this non-Sendable URLProtocol subclass.
        if Self.delay > 0 { Thread.sleep(forTimeInterval: Self.delay) }
        let (status, data) = Self.handler(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: nil,
            headerFields: nil
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

@Suite(.serialized) struct BackgroundAttachmentUploadCoordinatorTests {
    @Test func startsANewTaskWhenNoTaskExistsForTheAttachmentId() async throws {
        CoordinatorURLProtocol.reset()
        let coordinator = BackgroundAttachmentUploadCoordinator(sessionConfiguration: testConfiguration())
        let fileUrl = try makeFile()
        defer { try? FileManager.default.removeItem(at: fileUrl) }

        var progress: [Double] = []
        for try await value in coordinator.upload(
            request: putRequest(),
            fileUrl: fileUrl,
            attachmentId: "fresh-attachment"
        ) {
            progress.append(value)
        }
        #expect(progress.last == 1)
        #expect(CoordinatorURLProtocol.requestCount == 1)
    }

    @Test func reconcilesAnAlreadyRunningTaskInsteadOfStartingADuplicatePut() async throws {
        // A generous delay keeps the primed task "in flight" (still
        // returned by `getAllTasks`) for the moment it takes `upload` to
        // look it up, without making the test racy.
        CoordinatorURLProtocol.reset(delay: 0.2)
        let coordinator = BackgroundAttachmentUploadCoordinator(sessionConfiguration: testConfiguration())
        let fileUrl = try makeFile()
        defer { try? FileManager.default.removeItem(at: fileUrl) }

        // Simulates a task the OS is already running for this attachment —
        // e.g. one a previous, now-dead process started before the app was
        // relaunched — by creating it directly on the coordinator's session
        // rather than through `upload(...)`.
        let preexisting = coordinator.session.uploadTask(with: putRequest(), fromFile: fileUrl)
        preexisting.taskDescription = "shared-attachment"
        preexisting.resume()

        var progress: [Double] = []
        for try await value in coordinator.upload(
            request: putRequest(),
            fileUrl: fileUrl,
            attachmentId: "shared-attachment"
        ) {
            progress.append(value)
        }
        #expect(progress.last == 1)
        #expect(CoordinatorURLProtocol.requestCount == 1)
    }

    @Test func nonSuccessStatusSurfacesAsATypedFailure() async throws {
        CoordinatorURLProtocol.reset { _ in (403, Data()) }
        let coordinator = BackgroundAttachmentUploadCoordinator(sessionConfiguration: testConfiguration())
        let fileUrl = try makeFile()
        defer { try? FileManager.default.removeItem(at: fileUrl) }

        do {
            for try await _ in coordinator.upload(
                request: putRequest(),
                fileUrl: fileUrl,
                attachmentId: "expired-attachment"
            ) {}
            Issue.record("Expected the upload to fail")
        } catch let failure as AttachmentCommandFailure {
            #expect(failure.code == "upload_expired")
            #expect(failure.statusCode == 403)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    private func putRequest() -> URLRequest {
        var request = URLRequest(url: URL(string: "https://fish.test/upload")!)
        request.httpMethod = "PUT"
        return request
    }

    private func makeFile() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try Data("upload-bytes".utf8).write(to: url)
        return url
    }

    private func testConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CoordinatorURLProtocol.self]
        return configuration
    }
}
