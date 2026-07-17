import Foundation
import PresenceData
import UIComponents

/// Everything a surface needs to render one user's status.
public struct PresencePresentation: Sendable, Equatable {
    public let status: PresenceDisplayStatus
    public let label: String
    public let detail: String?

    public init(
        status: PresenceDisplayStatus = .offline,
        label: String = "Offline",
        detail: String? = nil
    ) {
        self.status = status
        self.label = label
        self.detail = detail
    }
}

/// The single feature-level UI state. `presentationFor(_:)` is the per-user
/// lookup every surface consumes.
public struct PresenceUiState: Sendable, Equatable {
    public var currentUserId: String?
    public var own: PresencePresentation
    public var ownPreference: PresencePreferenceSetting
    public var subjects: [String: PresencePresentation]
    public var connection: PresenceConnectionState
    public var updating: Bool
    public var notice: String?

    public init(
        currentUserId: String? = nil,
        own: PresencePresentation = PresencePresentation(),
        ownPreference: PresencePreferenceSetting = PresencePreferenceSetting(),
        subjects: [String: PresencePresentation] = [:],
        connection: PresenceConnectionState = .signedOut,
        updating: Bool = false,
        notice: String? = nil
    ) {
        self.currentUserId = currentUserId
        self.own = own
        self.ownPreference = ownPreference
        self.subjects = subjects
        self.connection = connection
        self.updating = updating
        self.notice = notice
    }

    public func presentationFor(_ userId: String?) -> PresencePresentation {
        guard let userId, let presentation = subjects[userId] else {
            return PresencePresentation()
        }
        return presentation
    }
}
