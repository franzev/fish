import Foundation

public protocol AttachmentCommandProviding: Sendable {
    func initializeUpload(
        _ request: InitializeAttachmentRequest
    ) async throws -> AttachmentUploadAuthorization
    func completeUpload(attachmentId: String) async throws -> ChatAttachment
    func cancelUpload(attachmentId: String) async
    func refreshUrls(attachmentIds: [String]) async throws -> [SignedAttachmentUrl]
}

public protocol AttachmentByteUploading: Sendable {
    func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error>
}

public protocol AttachmentHydrating: Sendable {
    func readyAttachments(
        forMessageIds messageIds: [String]
    ) async throws -> [String: [ChatAttachment]]
}

public protocol AttachmentConnectivityProviding: Sendable {
    var updates: AsyncStream<Bool> { get }
    func current() async -> Bool
}
