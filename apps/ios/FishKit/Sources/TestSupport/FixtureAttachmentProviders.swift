import ChatData
import Foundation

public struct FixtureAttachmentCommands: AttachmentCommandProviding {
    public init() {}

    public func initializeUpload(
        _ request: InitializeAttachmentRequest
    ) async throws -> AttachmentUploadAuthorization {
        AttachmentUploadAuthorization(
            attachmentId: "server-\(request.clientUploadId)",
            bucket: "chat-images",
            objectPath: "fixture/server-\(request.clientUploadId)/staging",
            uploadToken: "fixture-token",
            uploadMimeType: request.uploadMimeType,
            signedUploadUrl: URL(string: "https://fish.test/upload")!,
            expiresAt: Date().addingTimeInterval(7_200)
        )
    }

    public func completeUpload(attachmentId: String) async throws -> ChatAttachment {
        ChatAttachment(
            id: attachmentId,
            kind: .image,
            originalName: "Photo",
            mimeType: "image/webp",
            byteSize: 120_000,
            width: 400,
            height: 300,
            thumbnailPath: "fixture/\(attachmentId)/thumbnail.webp",
            displayPath: "fixture/\(attachmentId)/display.webp"
        )
    }

    public func cancelUpload(attachmentId: String) async {}

    public func refreshUrls(
        attachmentIds: [String]
    ) async throws -> [SignedAttachmentUrl] {
        attachmentIds.map {
            SignedAttachmentUrl(
                attachmentId: $0,
                thumbnailUrl: AttachmentFixtures.imageUrl,
                displayUrl: AttachmentFixtures.imageUrl
            )
        }
    }
}

public struct FixtureAttachmentUploader: AttachmentByteUploading {
    public init() {}

    public func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error> {
        AsyncThrowingStream { continuation in
            continuation.yield(0.25)
            continuation.yield(0.7)
            continuation.yield(1)
            continuation.finish()
        }
    }
}

public struct FixtureAttachmentHydration: AttachmentHydrating {
    private let values: [String: [ChatAttachment]]

    public init(values: [String: [ChatAttachment]] = [:]) {
        self.values = values
    }

    public func readyAttachments(
        forMessageIds messageIds: [String]
    ) async throws -> [String: [ChatAttachment]] {
        values.filter { messageIds.contains($0.key) }
    }
}
