import Foundation

/// Wire contracts of the `call-command` Edge Function and the `calls` table —
/// mirrors `ClientCall` and friends in `apps/web/lib/services/contracts.ts`.
public enum ClientCallStatus: String, Codable, Sendable {
    case ringing
    case connecting
    case active
    case ended
    case rejected
    case cancelled
    case missed
    case failed
}

public struct ClientCall: Codable, Sendable, Equatable {
    public let id: String
    public let lessonSlotId: String?
    public let coachId: String
    public let clientId: String
    public let initiatedBy: String
    public let kind: CallKind
    public let status: ClientCallStatus
    public let expiresAt: String
    public let acceptedAt: String?
    public let connectedAt: String?
    public let endedAt: String?
    public let endReason: String?
    public let createdAt: String
    public let updatedAt: String

    public init(
        id: String,
        lessonSlotId: String? = nil,
        coachId: String,
        clientId: String,
        initiatedBy: String,
        kind: CallKind,
        status: ClientCallStatus,
        expiresAt: String,
        acceptedAt: String? = nil,
        connectedAt: String? = nil,
        endedAt: String? = nil,
        endReason: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.lessonSlotId = lessonSlotId
        self.coachId = coachId
        self.clientId = clientId
        self.initiatedBy = initiatedBy
        self.kind = kind
        self.status = status
        self.expiresAt = expiresAt
        self.acceptedAt = acceptedAt
        self.connectedAt = connectedAt
        self.endedAt = endedAt
        self.endReason = endReason
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// LiveKit join credentials minted by `call-command` for `accept`/`join`.
public struct CallConnection: Codable, Sendable, Equatable {
    public let serverUrl: String
    public let participantToken: String

    public init(serverUrl: String, participantToken: String) {
        self.serverUrl = serverUrl
        self.participantToken = participantToken
    }
}

/// Successful command result. `connection` is present only when the server
/// minted a media token (accept and join).
public struct CallCommandReply: Sendable, Equatable {
    public let call: ClientCall
    public let connection: CallConnection?

    public init(call: ClientCall, connection: CallConnection? = nil) {
        self.call = call
        self.connection = connection
    }
}

/// Calm failure surface of the command endpoint — `code` is the stable
/// machine code, `notice` the user-facing sentence the server (or transport
/// fallback) chose.
public struct CallCommandFailure: Error, Sendable, Equatable {
    public let code: String
    public let notice: String

    public init(code: String, notice: String) {
        self.code = code
        self.notice = notice
    }

    /// Transport-level fallback — the same copy the web client uses when the
    /// function is unreachable or returns an unreadable payload.
    public static let unavailable = CallCommandFailure(
        code: "call_unavailable",
        notice: "Calling is taking a break. Messages still work."
    )
}

/// A call row joined with the counterpart's display name
/// (`get_call_counterpart_name` RPC).
public struct CallSnapshot: Sendable, Equatable {
    public let call: ClientCall
    public let counterpartName: String

    public init(call: ClientCall, counterpartName: String) {
        self.call = call
        self.counterpartName = counterpartName
    }
}

/// Broadcast wakeup payload — `calls:user:<userId>` / `call.changed`.
public struct CallRealtimeEvent: Sendable, Equatable {
    public let callId: String
    public let status: ClientCallStatus
    public let occurredAt: String

    public init(callId: String, status: ClientCallStatus, occurredAt: String) {
        self.callId = callId
        self.status = status
        self.occurredAt = occurredAt
    }
}

/// Stream element of a realtime subscription: a call wakeup, or a recovery
/// marker (subscription (re)established — reload durable state).
public enum CallRealtimeSignal: Sendable, Equatable {
    case event(CallRealtimeEvent)
    case recovered
}
