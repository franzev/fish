import Foundation
import Testing
@testable import ChatData

private final class AttachmentURLProtocol: URLProtocol {
    typealias Handler = @Sendable (URLRequest) -> (Int, Data)

    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var handler: Handler = { _ in (200, Data("{}".utf8)) }

    static func reset(handler: @escaping Handler) {
        requests = []
        self.handler = handler
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        var captured = request
        if captured.httpBody == nil, let stream = captured.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var data = Data()
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 4_096)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let count = stream.read(buffer, maxLength: 4_096)
                guard count > 0 else { break }
                data.append(buffer, count: count)
            }
            captured.httpBody = data
        }
        Self.requests.append(captured)
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

private actor RefreshCommands: AttachmentCommandProviding {
    let urls: [String: SignedAttachmentUrl]
    private(set) var batches: [[String]] = []

    init(urls: [String: SignedAttachmentUrl]) { self.urls = urls }

    func initializeUpload(_ request: InitializeAttachmentRequest) async throws -> AttachmentUploadAuthorization {
        throw AttachmentCommandFailure.unavailable
    }

    func completeUpload(attachmentId: String) async throws -> ChatAttachment {
        throw AttachmentCommandFailure.unavailable
    }

    func cancelUpload(attachmentId: String) async {}

    func refreshUrls(attachmentIds: [String]) async throws -> [SignedAttachmentUrl] {
        batches.append(attachmentIds)
        return attachmentIds.compactMap { urls[$0] }
    }
}

private struct EmptyHydration: AttachmentHydrating {
    func readyAttachments(forMessageIds messageIds: [String]) async throws -> [String: [ChatAttachment]] {
        [:]
    }
}

@Suite(.serialized) struct AttachmentAdapterTests {
    private let backend = ChatBackendConfiguration(
        supabaseUrl: URL(string: "https://fish.test")!,
        anonKey: "anon-key",
        accessToken: { "access-token" }
    )

    @Test func edgeCommandsSendAuthenticatedInitializeAndDecodeAuthorization() async throws {
        AttachmentURLProtocol.reset { _ in
            (200, Data(#"""
            {
              "attachmentId":"a1","bucket":"chat-images","objectPath":"c/a1/staging.jpg",
              "uploadToken":"secret","uploadMimeType":"image/jpeg",
              "signedUploadUrl":"http://kong:8000/storage/upload/a1","expiresAt":"2026-07-18T01:00:00.123456Z"
            }
            """#.utf8))
        }
        let commands = EdgeFunctionAttachmentCommands(configuration: backend, session: session())
        let authorization = try await commands.initializeUpload(InitializeAttachmentRequest(
            conversationId: "c1",
            clientUploadId: "client-1",
            originalName: "Photo",
            sourceMimeType: "image/heic",
            sourceByteSize: 200,
            uploadMimeType: "image/jpeg",
            uploadSha256: String(repeating: "f", count: 64)
        ))
        #expect(authorization.attachmentId == "a1")
        #expect(authorization.uploadMimeType == "image/jpeg")
        #expect(authorization.signedUploadUrl.host() == "fish.test")
        #expect(authorization.signedUploadUrl.path() == "/storage/v1/object/upload/sign/chat-images/c/a1/staging.jpg")
        #expect(authorization.signedUploadUrl.query() == "token=secret")

        let request = try #require(AttachmentURLProtocol.requests.first)
        #expect(request.url?.path() == "/functions/v1/chat-image-command")
        #expect(request.value(forHTTPHeaderField: "apikey") == "anon-key")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer access-token")
        let requestData = try #require(request.httpBody)
        let body = try #require(
            JSONSerialization.jsonObject(with: requestData) as? [String: Any]
        )
        #expect(body["action"] as? String == "initialize-upload")
        #expect(body["uploadMimeType"] as? String == "image/jpeg")
    }

    @Test func completionMapsSnakeCaseRowsAndSignedPaths() async throws {
        AttachmentURLProtocol.reset { _ in
            (200, Data(#"""
            {
              "attachment": {
                "id":"a1","status":"ready","kind":"image","original_name":"Photo",
                "stored_mime_type":"image/webp","stored_byte_size":987,"width":800,"height":600,
                "thumbnail_path":"c/a1/thumbnail.webp","display_path":"c/a1/display.webp"
              },
              "urls": [
                {"path":"c/a1/thumbnail.webp","signedUrl":"https://fish.test/thumb"},
                {"path":"c/a1/display.webp","signedUrl":"https://fish.test/display"}
              ]
            }
            """#.utf8))
        }
        let attachment = try await EdgeFunctionAttachmentCommands(
            configuration: backend,
            session: session()
        ).completeUpload(attachmentId: "a1")
        #expect(attachment.kind == .image)
        #expect(attachment.mimeType == "image/webp")
        #expect(attachment.thumbnailUrl?.path() == "/thumb")
        #expect(attachment.displayUrl?.path() == "/display")
    }

    @Test func edgeFailuresPreserveCodeNoticeAndStatus() async {
        AttachmentURLProtocol.reset { _ in
            (429, Data(#"{"code":"rate_limited","error":"Try again in a little while."}"#.utf8))
        }
        do {
            _ = try await EdgeFunctionAttachmentCommands(
                configuration: backend,
                session: session()
            ).initializeUpload(InitializeAttachmentRequest(
                conversationId: "c1",
                clientUploadId: "client-1",
                originalName: "notes.txt",
                sourceMimeType: "text/plain",
                sourceByteSize: 3,
                uploadMimeType: "text/plain",
                uploadSha256: String(repeating: "a", count: 64)
            ))
            Issue.record("Expected the command to fail")
        } catch let failure as AttachmentCommandFailure {
            #expect(failure.code == "rate_limited")
            #expect(failure.notice == "Try again in a little while.")
            #expect(failure.statusCode == 429)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test func refreshRejectsEmptyDuplicateAndOversizedBatchesWithoutNetwork() async {
        AttachmentURLProtocol.reset { _ in (200, Data("{}".utf8)) }
        let commands = EdgeFunctionAttachmentCommands(configuration: backend, session: session())
        await #expect(throws: AttachmentCommandFailure.self) {
            _ = try await commands.refreshUrls(attachmentIds: [])
        }
        await #expect(throws: AttachmentCommandFailure.self) {
            _ = try await commands.refreshUrls(attachmentIds: ["a", "a"])
        }
        await #expect(throws: AttachmentCommandFailure.self) {
            _ = try await commands.refreshUrls(attachmentIds: (0...50).map(String.init))
        }
        #expect(AttachmentURLProtocol.requests.isEmpty)
    }

    @Test func signedPutRejectsForeignHostsAndCompletesTrustedUploads() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try Data("upload".utf8).write(to: root)
        defer { try? FileManager.default.removeItem(at: root) }
        let base = AttachmentUploadAuthorization(
            attachmentId: "a1",
            bucket: "chat-images",
            objectPath: "c/a1/staging",
            uploadToken: "secret",
            uploadMimeType: "text/plain",
            signedUploadUrl: URL(string: "https://evil.test/upload")!,
            expiresAt: Date().addingTimeInterval(60)
        )
        let uploader = SignedUrlByteUploader(
            configuration: backend,
            sessionConfiguration: uploadSessionConfiguration()
        )
        await #expect(throws: AttachmentCommandFailure.self) {
            for try await _ in uploader.upload(fileUrl: root, to: base) {}
        }

        AttachmentURLProtocol.reset { request in
            #expect(request.httpMethod == "PUT")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "text/plain")
            return (200, Data())
        }
        let trusted = AttachmentUploadAuthorization(
            attachmentId: base.attachmentId,
            bucket: base.bucket,
            objectPath: base.objectPath,
            uploadToken: base.uploadToken,
            uploadMimeType: base.uploadMimeType,
            signedUploadUrl: URL(string: "https://fish.test/upload")!,
            expiresAt: base.expiresAt
        )
        var progress: [Double] = []
        for try await value in uploader.upload(fileUrl: root, to: trusted) { progress.append(value) }
        #expect(progress.last == 1)
    }

    @Test func hydrationOrdersRowsAndRefreshesInFiftyItemBatches() async throws {
        let rows = (0..<51).map { index in
            """
            {"id":"a\(index)","message_id":"m1","position":\(50 - index),"status":"ready",
             "kind":"file","original_name":"n\(index).txt","stored_mime_type":"text/plain",
             "stored_byte_size":1,"width":null,"height":null,"thumbnail_path":null,
             "display_path":"c/a\(index)/file.txt"}
            """
        }.joined(separator: ",")
        AttachmentURLProtocol.reset { request in
            #expect(request.url?.path() == "/rest/v1/message_attachments")
            return (200, Data("[\(rows)]".utf8))
        }
        let urls = Dictionary(uniqueKeysWithValues: (0..<51).map { index in
            let id = "a\(index)"
            return (id, SignedAttachmentUrl(
                attachmentId: id,
                thumbnailUrl: nil,
                displayUrl: URL(string: "https://fish.test/\(id)")!
            ))
        })
        let commands = RefreshCommands(urls: urls)
        let values = try await RestAttachmentHydration(
            configuration: backend,
            commands: commands,
            session: session()
        ).readyAttachments(forMessageIds: ["m1", "m1"])
        #expect(values["m1"]?.count == 51)
        #expect(values["m1"]?.first?.id == "a50")
        #expect(values["m1"]?.last?.id == "a0")
        #expect(await commands.batches.map(\.count) == [50, 1])
    }

    @Test func minimalMessagingSliceSendsAttachmentOrderAndFetchesMessages() async throws {
        AttachmentURLProtocol.reset { request in
            if request.url?.path() == "/functions/v1/send-message" {
                return (200, Data(#"{"message":{"id":"m1","conversation_id":"c1","sender_id":"u1","sender_role":"client","body":"Hi","created_at":"2026-07-18T00:00:00.123Z"}}"#.utf8))
            }
            return (200, Data(#"[{"id":"m1","conversation_id":"c1","sender_id":"u1","sender_role":"client","body":"Hi","created_at":"2026-07-18T00:00:00Z"}]"#.utf8))
        }
        let messaging = RestChatMessaging(
            configuration: backend,
            hydration: EmptyHydration(),
            session: session()
        )
        let sent = try await messaging.send(SendChatMessageRequest(
            conversationId: "c1",
            body: "Hi",
            clientRequestId: "request-1",
            attachmentIds: ["a2", "a1"]
        ))
        #expect(sent.id == "m1")
        let request = try #require(AttachmentURLProtocol.requests.first)
        let requestData = try #require(request.httpBody)
        let body = try #require(
            JSONSerialization.jsonObject(with: requestData) as? [String: Any]
        )
        #expect(body["attachmentIds"] as? [String] == ["a2", "a1"])

        let fetched = try await messaging.messages(conversationId: "c1")
        #expect(fetched.map(\.id) == ["m1"])
        #expect(AttachmentURLProtocol.requests.last?.url?.query?.contains("conversation_id=eq.c1") == true)
    }

    private func session() -> URLSession {
        URLSession(configuration: uploadSessionConfiguration())
    }

    private func uploadSessionConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AttachmentURLProtocol.self]
        return configuration
    }
}
