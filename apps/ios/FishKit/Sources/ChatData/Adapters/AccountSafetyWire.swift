import Foundation

struct ChatAccountProfileWire: Decodable {
    let displayName: String
    let username: String?
    let role: ChatAccountRole

    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case username
        case role
    }

    var domain: ChatAccountProfile {
        ChatAccountProfile(displayName: displayName, username: username, role: role)
    }
}

struct ChatPresencePreferenceWire: Decodable {
    let mode: ChatPresenceVisibility
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case mode
        case expiresAt = "expires_at"
    }

    var domain: ChatPresencePreference {
        ChatPresencePreference(visibility: mode, expiresAt: expiresAt)
    }
}

struct ChatPresenceCommandRequest: Encodable {
    let mode: ChatPresenceVisibility
    let durationSeconds: Int?
}

struct ChatPresenceCommandWire: Decodable {
    struct Setting: Decodable {
        let preference: ChatPresenceVisibility
        let expiresAt: String?
    }

    let setting: Setting

    var domain: ChatPresenceCommandResult {
        ChatPresenceCommandResult(
            preference: ChatPresencePreference(
                visibility: setting.preference,
                expiresAt: setting.expiresAt
            )
        )
    }
}

struct ChatBlockedPersonWire: Decodable {
    let userId: String
    let displayName: String
    let username: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case username
    }

    var domain: ChatBlockedPerson {
        ChatBlockedPerson(
            userId: userId,
            displayName: displayName,
            username: username
        )
    }
}

struct UnblockUserRequest: Encodable {
    let targetId: String

    enum CodingKeys: String, CodingKey {
        case targetId = "p_target_id"
    }
}

enum ChatAccountProfileError: Error {
    case missing
}
