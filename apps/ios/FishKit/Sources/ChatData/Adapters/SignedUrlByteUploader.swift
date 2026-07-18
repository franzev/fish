import Foundation

public struct SignedUrlByteUploader: AttachmentByteUploading {
    private let configuration: ChatBackendConfiguration
    private let sessionConfiguration: URLSessionConfiguration

    public init(
        configuration: ChatBackendConfiguration,
        sessionConfiguration: URLSessionConfiguration? = nil
    ) {
        self.configuration = configuration
        let networkConfiguration = sessionConfiguration ?? .ephemeral
        networkConfiguration.waitsForConnectivity = true
        networkConfiguration.timeoutIntervalForRequest = 60
        networkConfiguration.timeoutIntervalForResource = 120
        self.sessionConfiguration = networkConfiguration
    }

    public func upload(
        fileUrl: URL,
        to authorization: AttachmentUploadAuthorization
    ) -> AsyncThrowingStream<Double, any Error> {
        AsyncThrowingStream { continuation in
            guard authorization.bucket == "chat-images",
                  isTrusted(authorization.signedUploadUrl),
                  FileManager.default.fileExists(atPath: fileUrl.path) else {
                continuation.finish(throwing: AttachmentCommandFailure.unavailable)
                return
            }
            var request = URLRequest(url: authorization.signedUploadUrl)
            request.httpMethod = "PUT"
            request.setValue(authorization.uploadMimeType, forHTTPHeaderField: "Content-Type")
            request.setValue("false", forHTTPHeaderField: "x-upsert")
            let delegate = UploadProgressDelegate(continuation: continuation)
            let session = URLSession(
                configuration: sessionConfiguration,
                delegate: delegate,
                delegateQueue: nil
            )
            delegate.session = session
            let task = session.uploadTask(with: request, fromFile: fileUrl)
            delegate.task = task
            continuation.onTermination = { @Sendable _ in task.cancel() }
            task.resume()
        }
    }

    private func isTrusted(_ url: URL) -> Bool {
        guard url.user == nil, url.password == nil,
              url.host?.lowercased() == configuration.supabaseUrl.host?.lowercased()
        else { return false }
        if url.scheme == "https" { return true }
        return url.scheme == "http" && ["localhost", "127.0.0.1"].contains(url.host ?? "")
    }
}

private final class UploadProgressDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    private let continuation: AsyncThrowingStream<Double, any Error>.Continuation
    var task: URLSessionUploadTask?
    var session: URLSession?

    init(continuation: AsyncThrowingStream<Double, any Error>.Continuation) {
        self.continuation = continuation
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard totalBytesExpectedToSend > 0 else { return }
        continuation.yield(min(1, max(0, Double(totalBytesSent) / Double(totalBytesExpectedToSend))))
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: (any Error)?
    ) {
        defer {
            session.finishTasksAndInvalidate()
            self.session = nil
            self.task = nil
        }
        if let error {
            if (error as? URLError)?.code == .cancelled {
                continuation.finish(throwing: CancellationError())
            } else {
                continuation.finish(throwing: AttachmentCommandFailure.unavailable)
            }
            return
        }
        guard let response = task.response as? HTTPURLResponse,
              (200..<300).contains(response.statusCode) else {
            let status = (task.response as? HTTPURLResponse)?.statusCode
            continuation.finish(throwing: AttachmentCommandFailure(
                code: status == 401 || status == 403 ? "upload_expired" : "upload_unavailable",
                notice: "That attachment did not finish yet. Try again.",
                statusCode: status
            ))
            return
        }
        continuation.yield(1)
        continuation.finish()
    }
}
