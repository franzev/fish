import Foundation
import Network

public final class NetworkAttachmentConnectivity: AttachmentConnectivityProviding, @unchecked Sendable {
    public let updates: AsyncStream<Bool>

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "app.fish.chat-attachment-connectivity")
    private let lock = NSLock()
    private var latest = true
    private let continuation: AsyncStream<Bool>.Continuation

    public init() {
        let stream = AsyncStream<Bool>.makeStream(bufferingPolicy: .bufferingNewest(1))
        updates = stream.stream
        continuation = stream.continuation
        monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            let connected = path.status == .satisfied
            self.lock.withLock { self.latest = connected }
            self.continuation.yield(connected)
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
        continuation.finish()
    }

    public func current() async -> Bool {
        lock.withLock { latest }
    }
}

public struct AlwaysConnectedAttachmentConnectivity: AttachmentConnectivityProviding {
    public let updates: AsyncStream<Bool>
    private let value: Bool

    public init(_ value: Bool = true) {
        self.value = value
        updates = AsyncStream { continuation in
            continuation.yield(value)
            continuation.finish()
        }
    }

    public func current() async -> Bool { value }
}
