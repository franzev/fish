import ChatData
import Foundation
import PersonalChat

/// Realistic coaching copy for every deterministic screen state.
public enum PersonalChatFixtures {
    public static let coachName = "Sam Rivera"

    public static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()
    public static let locale = Locale(identifier: "en_US")
    public static let now = date("2026-07-16T15:00:00Z")

    public static var context: TranscriptContext {
        TranscriptContext(now: now, calendar: calendar, locale: locale)
    }

    private static func date(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }

    private static func incoming(
        _ id: String,
        _ body: String,
        media: MessageMedia? = nil,
        attachments: [MessageAttachmentUiModel] = [],
        at value: String
    ) -> MessageUiModel {
        MessageUiModel(
            id: id,
            direction: .incoming,
            senderId: "coach",
            senderName: coachName,
            body: body,
            media: media,
            attachments: attachments,
            sentAt: date(value)
        )
    }

    private static func outgoing(
        _ id: String,
        _ body: String,
        media: MessageMedia? = nil,
        attachments: [MessageAttachmentUiModel] = [],
        at value: String,
        delivery: MessageDeliveryStatus
    ) -> MessageUiModel {
        MessageUiModel(
            id: id,
            direction: .outgoing,
            senderId: "client",
            senderName: "Maya Chen",
            body: body,
            media: media,
            attachments: attachments,
            sentAt: date(value),
            delivery: delivery
        )
    }

    private static let baseMessages: [MessageUiModel] = [
        incoming(
            "m1",
            "How did the presentation go?",
            at: "2026-07-15T09:00:00Z"
        ),
        incoming(
            "m2",
            "Remember — pause before your key point. It gives your listeners time to catch up.",
            at: "2026-07-15T09:02:00Z"
        ),
        outgoing(
            "m3",
            "It went really well! I used the pause twice.",
            at: "2026-07-15T18:30:00Z",
            delivery: .read
        ),
        incoming(
            "m4",
            "That's great progress. Tomorrow, let's practice questions for your team meeting.",
            at: "2026-07-16T08:05:00Z"
        ),
        outgoing(
            "m5",
            "Sounds good. See you then!",
            at: "2026-07-16T08:06:00Z",
            delivery: .delivered
        ),
    ]

    private static func model(
        participantName: String = coachName,
        phase: PersonalChatPhase = .ready,
        connection: ChatConnectionState = .connected,
        older: OlderMessagesState = .idle,
        messages: [MessageUiModel] = baseMessages,
        unreadAfter: String? = nil,
        typing: Bool = false,
        presence: PresenceUiModel? = PresenceUiModel(
            label: "Online",
            tone: .online
        )
    ) -> PersonalChatUiModel {
        PersonalChatUiModel(
            participantName: participantName,
            presence: presence,
            phase: phase,
            connection: connection,
            olderMessages: older,
            messages: messages,
            unreadAfterMessageId: unreadAfter,
            isParticipantTyping: typing
        )
    }

    public static let loading = model(phase: .loading, messages: [])
    public static let unavailable = model(
        phase: .unavailable,
        messages: [],
        presence: nil
    )
    public static let empty = model(older: .hidden, messages: [])
    public static let loaded = model()
    public static let unread = model(unreadAfter: "m3")
    public static let loadingEarlier = model(older: .loading)
    public static let earlierFailed = model(older: .failed)
    public static let typing = model(typing: true)
    public static let reconnecting = model(connection: .reconnecting)
    public static let offline = model(
        connection: .offline,
        presence: PresenceUiModel(label: "Offline", tone: .offline)
    )
    public static let sending = model(messages: baseMessages + [
        outgoing(
            "m6",
            "One more question about the agenda.",
            at: "2026-07-16T14:59:30Z",
            delivery: .sending
        ),
    ])
    public static let sendFailed = model(messages: baseMessages + [
        outgoing(
            "m6",
            "One more question about the agenda.",
            at: "2026-07-16T14:59:30Z",
            delivery: .failed
        ),
    ])

    /// Sticker, GIF, unavailable fallbacks, and an emoji-only body — the
    /// transcript media matrix. Compact rows come first and the tall GIF
    /// last so every state stays visible from the transcript's initial
    /// position in snapshots.
    public static let media = model(messages: [
        incoming(
            "m8",
            "",
            media: .sticker(id: "aquatic-not-in-this-pack"),
            at: "2026-07-16T14:40:00Z"
        ),
        incoming(
            "m9",
            "",
            media: .gifUnavailable,
            at: "2026-07-16T14:41:00Z"
        ),
        outgoing(
            "m10",
            "🎉",
            at: "2026-07-16T14:42:00Z",
            delivery: .read
        ),
        outgoing(
            "m11",
            "",
            media: .sticker(id: "aquatic-great-job-sea-star"),
            at: "2026-07-16T14:43:00Z",
            delivery: .delivered
        ),
        incoming(
            "m12",
            "This is how the pause felt from here:",
            media: .gif(ChatMediaFixtures.gifs[0]),
            at: "2026-07-16T14:44:00Z"
        ),
    ])

    public static var attachments: PersonalChatUiModel {
        model(messages: [
            incoming(
                "a1",
                "Here is the example we discussed.",
                attachments: [AttachmentFixtures.imageUi],
                at: "2026-07-16T14:35:00Z"
            ),
            outgoing(
                "a2",
                "My notes are attached too.",
                attachments: [
                    AttachmentFixtures.imageUi,
                    AttachmentFixtures.portraitImageUi,
                    AttachmentFixtures.documentUi,
                ],
                at: "2026-07-16T14:36:00Z",
                delivery: .delivered
            ),
        ])
    }

    /// Staged composer selections for previews and snapshots.
    public static let stagedGif = ComposerSelection.gif(
        ChatMediaFixtures.gifs[0],
        searchQuery: "otter"
    )
    public static let stagedSticker: ComposerSelection = {
        guard let sticker = StickerCatalog.sticker(for: "aquatic-hello-otter") else {
            preconditionFailure("Bundled sticker catalog is missing aquatic-hello-otter")
        }
        return .sticker(sticker)
    }()

    private static let longMessage: String = {
        let prefix = "Here is my practice paragraph 😊 https://example.com/very/long/path/that/should/wrap/gracefully "
        let repeated = String(
            repeating: "I want to describe the quarterly results clearly and confidently. ",
            count: 80
        )
        return String((prefix + repeated).prefix(4_000))
    }()

    public static let longContent = model(
        participantName: "Alexandria Montgomery-Washington",
        messages: baseMessages + [
            outgoing(
                "m7",
                longMessage,
                at: "2026-07-16T14:45:00Z",
                delivery: .sent
            ),
        ]
    )
}
