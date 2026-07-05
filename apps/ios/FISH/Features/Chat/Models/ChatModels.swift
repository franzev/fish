import Foundation

struct ChatParticipantView: Identifiable, Equatable {
    let id: String
    let name: String
    let role: String
}

enum MessageStatus: String, Equatable {
    case sending = "Sending"
    case sent = "Sent"
    case delivered = "Delivered"
    case read = "Read"
}

struct ChatMessageView: Identifiable, Equatable {
    let id: String
    let author: ChatParticipantView
    let body: String
    let sentAt: String
    let mine: Bool
    var status: MessageStatus?
}

enum ChatPreviewData {
    static let coach = ChatParticipantView(id: "coach-1", name: "Maya Chen", role: "Coach")
    static let client = ChatParticipantView(id: "client-1", name: "Alex Rivera", role: "You")

    static let messages = [
        ChatMessageView(
            id: "message-1",
            author: coach,
            body: "Good morning, Alex. Today we will keep this small: one reply about the meeting phrase you want to practice.",
            sentAt: "9:12",
            mine: false
        ),
        ChatMessageView(
            id: "message-2",
            author: client,
            body: "I want to sound more natural when I ask for more time.",
            sentAt: "9:14",
            mine: true,
            status: .read
        ),
        ChatMessageView(
            id: "message-3",
            author: coach,
            body: "Try this: Could I have a little more time to think that through?",
            sentAt: "9:15",
            mine: false
        )
    ]
}
