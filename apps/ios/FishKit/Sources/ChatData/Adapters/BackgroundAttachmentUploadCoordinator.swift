import Foundation

/// Runs attachment upload transport through a single, app-wide background
/// `URLSession` so an upload keeps running when the app is backgrounded or
/// killed by the OS — the OS finishes the transfer out-of-process, matching
/// Android's WorkManager-backed uploads. `SignedUrlByteUploader` delegates
/// every call here instead of creating its own session per upload.
///
/// One instance must live for the life of the app. `FishAppDelegate` touches
/// `shared` from `application(_:didFinishLaunchingWithOptions:)` so the
/// session (and this delegate) exist before the OS can deliver
/// `application(_:handleEventsForBackgroundURLSession:completionHandler:)`
/// for a transfer that finished while the app was suspended or terminated —
/// constructing the session lazily on first upload would be too late for
/// that relaunch path.
public final class BackgroundAttachmentUploadCoordinator: NSObject, @unchecked Sendable {
    public static let shared = BackgroundAttachmentUploadCoordinator()

    /// Stable across launches: the OS uses it to reconnect a relaunched
    /// process to the transfers its previous process started.
    public static let backgroundSessionIdentifier = "app.fish.chat-attachment-uploads"

    private let lock = NSLock()
    private var observers: [String: AsyncThrowingStream<Double, Error>.Continuation] = [:]
    // Not `@Sendable`: UIKit hands `handleEventsForBackgroundURLSession`'s
    // completion handler in as a plain `() -> Void`. This class opts out of
    // the compiler's Sendability checking itself (`@unchecked Sendable`) and
    // guards every access to this dictionary with `lock`.
    private var launchCompletionHandlers: [String: () -> Void] = [:]

    // `internal` (not `private`) so `@testable import` tests can prime a
    // task directly on this session to exercise the reconciliation path
    // without a real background-session relaunch.
    private(set) var session: URLSession!

    /// Production callers use the default background configuration. Tests
    /// inject a non-background configuration (e.g. `.ephemeral` with a
    /// stubbed `URLProtocol`) so they exercise the same reconciliation code
    /// without touching the network or the one app-wide background session.
    public init(sessionConfiguration: URLSessionConfiguration? = nil) {
        let configuration = sessionConfiguration
            ?? .background(withIdentifier: Self.backgroundSessionIdentifier)
        configuration.timeoutIntervalForRequest = 60
        if configuration.identifier == nil {
            // Not a background configuration (tests): match the foreground
            // behavior `SignedUrlByteUploader` used before this session
            // became shared.
            configuration.waitsForConnectivity = true
            configuration.timeoutIntervalForResource = 120
        } else {
            // A background session always waits for connectivity —
            // `waitsForConnectivity` is a documented no-op here — and its
            // whole point is to let a large upload run for as long as the OS
            // is willing to keep it alive, so `timeoutIntervalForResource`
            // deliberately stays at Apple's generous system default instead
            // of being clamped the way a foreground session's would be.
            configuration.isDiscretionary = false
            configuration.sessionSendsLaunchEvents = true
        }
        super.init()
        session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }

    /// Stores the completion handler the OS hands
    /// `application(_:handleEventsForBackgroundURLSession:completionHandler:)`
    /// so it can be called back once `urlSessionDidFinishEvents` reports the
    /// session has delivered every queued event.
    public func storeLaunchCompletionHandler(
        _ handler: @escaping () -> Void,
        forSessionIdentifier identifier: String
    ) {
        lock.withLock { launchCompletionHandlers[identifier] = handler }
    }

    /// Starts (or reattaches to) the upload identified by `attachmentId`. If
    /// a task with a matching `taskDescription` is already running in this
    /// session — e.g. the app relaunched into a conversation whose upload
    /// the OS kept transferring in the background — this attaches to it
    /// instead of starting a duplicate PUT.
    public func upload(
        request: URLRequest,
        fileUrl: URL,
        attachmentId: String
    ) -> AsyncThrowingStream<Double, Error> {
        AsyncThrowingStream { continuation in
            Task { [weak self] in
                guard let self else {
                    continuation.finish(throwing: AttachmentCommandFailure.unavailable)
                    return
                }
                let task: URLSessionUploadTask
                if let existing = await self.existingTask(withAttachmentId: attachmentId) {
                    task = existing
                } else {
                    task = self.session.uploadTask(with: request, fromFile: fileUrl)
                    task.taskDescription = attachmentId
                }
                self.register(continuation, attachmentId: attachmentId)
                // Safe to assign after the fact: if the stream already
                // terminated while we were awaiting `existingTask`, Swift
                // calls `onTermination` immediately, so the task still gets
                // cancelled instead of running unobserved.
                continuation.onTermination = { @Sendable _ in task.cancel() }
                task.resume()
            }
        }
    }

    private func existingTask(withAttachmentId attachmentId: String) async -> URLSessionUploadTask? {
        await withCheckedContinuation { continuation in
            session.getAllTasks { tasks in
                continuation.resume(
                    returning: tasks.first { $0.taskDescription == attachmentId } as? URLSessionUploadTask
                )
            }
        }
    }

    private func register(
        _ continuation: AsyncThrowingStream<Double, Error>.Continuation,
        attachmentId: String
    ) {
        lock.withLock { observers[attachmentId] = continuation }
    }

    private func observer(for attachmentId: String) -> AsyncThrowingStream<Double, Error>.Continuation? {
        lock.withLock { observers[attachmentId] }
    }

    private func removeObserver(for attachmentId: String) {
        lock.withLock { observers.removeValue(forKey: attachmentId) }
    }
}

extension BackgroundAttachmentUploadCoordinator: URLSessionTaskDelegate {
    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard totalBytesExpectedToSend > 0, let attachmentId = task.taskDescription else { return }
        observer(for: attachmentId)?.yield(
            min(1, max(0, Double(totalBytesSent) / Double(totalBytesExpectedToSend)))
        )
    }

    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: (any Error)?
    ) {
        guard let attachmentId = task.taskDescription else { return }
        defer { removeObserver(for: attachmentId) }
        guard let continuation = observer(for: attachmentId) else { return }
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

    public func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        let identifier = session.configuration.identifier ?? Self.backgroundSessionIdentifier
        let handler = lock.withLock { launchCompletionHandlers.removeValue(forKey: identifier) }
        guard let handler else { return }
        DispatchQueue.main.async { handler() }
    }
}
