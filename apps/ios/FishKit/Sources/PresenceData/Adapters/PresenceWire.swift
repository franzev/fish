import Foundation

// The presence wire format: database rows and RPC replies are snake_case;
// the Edge Function speaks camelCase. Unknown enum values fail decoding —
// a new server status must never render as something it is not.

struct PresenceSnapshotRow: Decodable {
    let userId: String
    let status: PresenceStatus
    let lastHeartbeatAt: String?
    let lastSeenAt: String?
    let revision: Int64
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case status
        case lastHeartbeatAt = "last_heartbeat_at"
        case lastSeenAt = "last_seen_at"
        case revision
        case updatedAt = "updated_at"
    }

    var snapshot: PresenceSnapshot {
        PresenceSnapshot(
            userId: userId,
            status: status,
            lastHeartbeatAt: lastHeartbeatAt,
            lastSeenAt: lastSeenAt,
            revision: revision,
            updatedAt: updatedAt
        )
    }
}

extension PresenceStatus: Decodable {}
extension PresencePreference: Codable {}

struct PresencePreferenceRow: Decodable {
    let mode: PresencePreference
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case mode
        case expiresAt = "expires_at"
    }

    /// Expired rows resolve to automatic — the web repository's read clamp.
    func setting(now: Date) -> PresencePreferenceSetting {
        if let expiresAt,
           let expiry = PresenceTimestamp.parse(expiresAt),
           expiry <= now {
            return PresencePreferenceSetting()
        }
        return PresencePreferenceSetting(preference: mode, expiresAt: expiresAt)
    }
}

struct TouchPresenceParams: Encodable {
    let sessionId: String
    let activity: Bool
    let ended: Bool

    enum CodingKeys: String, CodingKey {
        case sessionId = "p_session_id"
        case activity = "p_activity"
        case ended = "p_ended"
    }
}

struct PresenceCommandRequest: Encodable {
    let mode: PresencePreference
    let durationSeconds: Int?
}

struct PresenceCommandResponse: Decodable {
    struct Snapshot: Decodable {
        let userId: String
        let status: PresenceStatus
        let lastHeartbeatAt: String?
        let lastSeenAt: String?
        let revision: Int64
        let updatedAt: String
    }

    struct Setting: Decodable {
        let preference: PresencePreference
        let expiresAt: String?
    }

    let snapshot: Snapshot
    let setting: Setting

    var result: PresenceCommandResult {
        PresenceCommandResult(
            snapshot: PresenceSnapshot(
                userId: snapshot.userId,
                status: snapshot.status,
                lastHeartbeatAt: snapshot.lastHeartbeatAt,
                lastSeenAt: snapshot.lastSeenAt,
                revision: snapshot.revision,
                updatedAt: snapshot.updatedAt
            ),
            setting: PresencePreferenceSetting(
                preference: setting.preference,
                expiresAt: setting.expiresAt
            )
        )
    }
}

struct PresenceCalmError: Decodable {
    let code: String?
    let error: String?

    var failure: PresenceCommandFailure {
        PresenceCommandFailure(
            code: code ?? PresenceCommandFailure.unavailable.code,
            notice: error ?? PresenceCommandFailure.unavailable.notice
        )
    }

    static func failure(from data: Data) -> PresenceCommandFailure {
        guard let body = try? JSONDecoder().decode(PresenceCalmError.self, from: data) else {
            return .unavailable
        }
        return body.failure
    }
}
