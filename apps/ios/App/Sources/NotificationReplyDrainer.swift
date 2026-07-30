import ChatData
import Foundation

/// Delivery decisions for queued notification replies. Marking read happens
/// as soon as an authorized reply is processed — replying proves the user
/// read the notified message, independent of this send attempt's outcome.
struct NotificationReplyDrainer {
    enum SendOutcome {
        case sent
        case terminal
        case retryLater
    }

    var pendingReplies: () async -> [ChatNotificationReply]
    var remove: (String) async -> Void
    var isAuthorized: (String) -> Bool
    var send: (ChatNotificationReply) async -> SendOutcome
    var markRead: (String, String) async -> Void
    var saveDraft: (String, String) async -> Void
    var postFailureNotice: (ChatNotificationReply) async -> Void

    /// Returns whether at least one reply reached the server, so the caller
    /// can refresh the directory and application badge.
    ///
    /// Isolated to the main actor: `FishAppModel`'s wiring closes over
    /// `UNUserNotificationCenter` (not `Sendable`) and other main-actor state,
    /// which makes the constructed drainer main-actor-isolated in Swift 6's
    /// region analysis. Running here keeps that data on the actor it belongs
    /// to instead of "sending" it into a nonisolated context. The app-target
    /// tests construct a drainer off-actor with only `Sendable` captures
    /// (an actor recorder plus plain values) and `await` this method, which
    /// is a safe one-shot transfer since nothing else holds that instance.
    @MainActor
    func run() async -> Bool {
        var sentAny = false
        for reply in await pendingReplies() {
            guard isAuthorized(reply.conversationId) else {
                // The current account cannot access this conversation. Do not
                // retain a reply that could be sent after an account switch.
                await remove(reply.id)
                continue
            }
            if let messageId = reply.messageId {
                await markRead(reply.conversationId, messageId)
            }
            switch await send(reply) {
            case .sent:
                sentAny = true
                await remove(reply.id)
            case .terminal:
                await saveDraft(reply.conversationId, reply.body)
                await postFailureNotice(reply)
                await remove(reply.id)
            case .retryLater:
                break
            }
        }
        return sentAny
    }
}
