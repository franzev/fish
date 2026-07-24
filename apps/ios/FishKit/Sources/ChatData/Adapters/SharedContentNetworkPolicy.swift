import Foundation
import Network

/// The adapter-level path facts keep Low Data Mode separate from ordinary
/// connectivity and cost. Constrained paths remain usable for visible work;
/// only lookahead is suppressed.
public struct SharedContentNetworkPolicy: Sendable, Equatable {
    public let usable: Bool
    public let constrained: Bool
    public let expensive: Bool
    public let lookaheadAllowed: Bool

    public init(
        usable: Bool,
        constrained: Bool,
        expensive: Bool,
        lookaheadAllowed: Bool? = nil
    ) {
        self.usable = usable
        self.constrained = constrained
        self.expensive = expensive
        self.lookaheadAllowed = (lookaheadAllowed ?? true) && usable && !constrained
    }

    /// Portable ChatCore policy consumed by later orchestration without
    /// importing Network or exposing path/provider values.
    public var sharedContentPolicy: SharedContentNetworkPolicyProjection {
        SharedContentNetworkPolicyProjection(
            networkUsable: usable,
            lookaheadAllowed: lookaheadAllowed
        )
    }
}

public typealias SharedContentNetworkPathPolicy = SharedContentNetworkPolicy

/// The two-field portable projection used by existing ChatCore delivery
/// planning. Path cost and Low Data Mode remain adapter-only facts.
public struct SharedContentNetworkPolicyProjection: Sendable, Equatable {
    public let networkUsable: Bool
    public let lookaheadAllowed: Bool

    public init(networkUsable: Bool, lookaheadAllowed: Bool) {
        self.networkUsable = networkUsable
        self.lookaheadAllowed = lookaheadAllowed
    }
}

/// Buffering-newest NWPathMonitor adapter for the shared-content seam.
public final class SharedContentNetworkPolicyMonitor: @unchecked Sendable {
    public let updates: AsyncStream<SharedContentNetworkPathPolicy>

    private let monitor: NWPathMonitor
    private let queue: DispatchQueue
    private let lock = NSLock()
    private var latest = SharedContentNetworkPathPolicy(
        usable: false,
        constrained: false,
        expensive: false
    )
    private let continuation: AsyncStream<SharedContentNetworkPathPolicy>.Continuation

    public init(
        monitor: NWPathMonitor = NWPathMonitor(),
        queue: DispatchQueue = DispatchQueue(label: "app.fish.shared-content-network-policy")
    ) {
        let stream = AsyncStream<SharedContentNetworkPathPolicy>.makeStream(
            bufferingPolicy: .bufferingNewest(1)
        )
        updates = stream.stream
        continuation = stream.continuation
        self.monitor = monitor
        self.queue = queue
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            let policy = SharedContentNetworkPathPolicy(
                usable: path.status == .satisfied,
                constrained: path.isConstrained,
                expensive: path.isExpensive
            )
            self.lock.withLock { self.latest = policy }
            self.continuation.yield(policy)
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
        continuation.finish()
    }

    public func current() async -> SharedContentNetworkPathPolicy {
        lock.withLock { latest }
    }
}
