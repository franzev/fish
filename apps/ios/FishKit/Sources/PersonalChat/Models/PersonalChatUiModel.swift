public enum ChatConnectionState: Sendable, Equatable {
    case connected
    case connecting
    case reconnecting
    case offline
}

public enum OlderMessagesState: Sendable, Equatable {
    case hidden
    case idle
    case loading
    case failed
}

public enum PresenceTone: Sendable, Equatable {
    case online
    case idle
    case away
    case busy
    case offline
}

public struct PresenceUiModel: Sendable, Equatable {
    public let label: String
    public let tone: PresenceTone

    public init(label: String, tone: PresenceTone) {
        self.label = label
        self.tone = tone
    }
}

public enum PersonalChatPhase: Sendable, Equatable {
    case loading
    case unavailable
    case ready
}

public struct PersonalChatUiModel: Sendable, Equatable {
    public let participantName: String
    public let presence: PresenceUiModel?
    public let phase: PersonalChatPhase
    public let connection: ChatConnectionState
    public let olderMessages: OlderMessagesState
    public let messages: [MessageUiModel]
    public let unreadAfterMessageId: String?
    public let isParticipantTyping: Bool

    public init(
        participantName: String,
        presence: PresenceUiModel? = nil,
        phase: PersonalChatPhase = .ready,
        connection: ChatConnectionState = .connected,
        olderMessages: OlderMessagesState = .hidden,
        messages: [MessageUiModel] = [],
        unreadAfterMessageId: String? = nil,
        isParticipantTyping: Bool = false
    ) {
        self.participantName = participantName
        self.presence = presence
        self.phase = phase
        self.connection = connection
        self.olderMessages = olderMessages
        self.messages = messages
        self.unreadAfterMessageId = unreadAfterMessageId
        self.isParticipantTyping = isParticipantTyping
    }
}
