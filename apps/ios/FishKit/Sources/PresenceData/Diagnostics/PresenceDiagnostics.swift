import Foundation

/// Privacy rule (ADR 0004): events carry only operation, result, duration,
/// and a broad failure category — never identifiers, modes, or timestamps.
public enum PresenceOperation: String, Sendable {
    case refresh
    case heartbeat
    case endSession
    case realtime
    case setPreference
}

public enum PresenceFailureCategory: String, Sendable {
    case authentication
    case network
    case remote
    case malformed
}

public struct PresenceDiagnosticEvent: Sendable, Equatable {
    public let operation: PresenceOperation
    public let succeeded: Bool
    public let duration: Duration
    public let failureCategory: PresenceFailureCategory?

    public init(
        operation: PresenceOperation,
        succeeded: Bool,
        duration: Duration,
        failureCategory: PresenceFailureCategory? = nil
    ) {
        self.operation = operation
        self.succeeded = succeeded
        self.duration = duration
        self.failureCategory = failureCategory
    }
}

public protocol PresenceDiagnostics: Sendable {
    func record(_ event: PresenceDiagnosticEvent)
}

public struct NoOpPresenceDiagnostics: PresenceDiagnostics {
    public init() {}
    public func record(_ event: PresenceDiagnosticEvent) {}
}
