import Foundation

/// Validates a signed upload URL and hands the actual transfer to
/// `BackgroundAttachmentUploadCoordinator`, which runs it on a single
/// app-wide background `URLSession` so it survives backgrounding and
/// process death. This type stays a thin, stateless validator: every
/// session/task/delegate concern lives in the coordinator.
public struct SignedUrlByteUploader: AttachmentByteUploading {
    private let configuration: ChatBackendConfiguration
    private let coordinator: BackgroundAttachmentUploadCoordinator

    /// `sessionConfiguration` and `completedMarks` are a paired test seam:
    /// passing either creates a private coordinator (session + marks store)
    /// scoped to this instance instead of using the shared, app-wide
    /// background session and its disk-backed marks file — production
    /// callers should leave both `nil`. Tests that pass one should pass the
    /// other too, so an isolated session never falls back to reading or
    /// writing the real `CompletedAttachmentUploadMarks.shared` file.
    public init(
        configuration: ChatBackendConfiguration,
        sessionConfiguration: URLSessionConfiguration? = nil,
        completedMarks: CompletedAttachmentUploadMarks? = nil
    ) {
        self.configuration = configuration
        coordinator = (sessionConfiguration != nil || completedMarks != nil)
            ? BackgroundAttachmentUploadCoordinator(
                sessionConfiguration: sessionConfiguration,
                completedMarks: completedMarks
            )
            : .shared
    }

    public func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error> {
        guard authorization.bucket == "chat-images",
              isTrusted(authorization.signedUploadUrl),
              FileManager.default.fileExists(atPath: fileUrl.path) else {
            return AsyncThrowingStream { continuation in
                continuation.finish(throwing: AttachmentCommandFailure.unavailable)
            }
        }
        var request = URLRequest(url: authorization.signedUploadUrl)
        request.httpMethod = "PUT"
        request.setValue(authorization.uploadMimeType, forHTTPHeaderField: "Content-Type")
        request.setValue("false", forHTTPHeaderField: "x-upsert")
        return coordinator.upload(
            request: request,
            fileUrl: fileUrl,
            attachmentId: authorization.attachmentId
        )
    }

    private func isTrusted(_ url: URL) -> Bool {
        guard url.user == nil, url.password == nil,
              url.host?.lowercased() == configuration.supabaseUrl.host?.lowercased()
        else { return false }
        if url.scheme == "https" { return true }
        return url.scheme == "http" && ["localhost", "127.0.0.1"].contains(url.host ?? "")
    }
}
