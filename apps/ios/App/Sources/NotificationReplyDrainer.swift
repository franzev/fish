import ChatData
import Foundation

/// Delivery decisions for queued notification replies. Marking read happens
/// as soon as an authorized reply is processed — replying proves the user
/// read the notified message, independent of this send attempt's outcome.
struct NotificationReplyDrainer {
    enum SendOutcome: Equatable {
        case sent
        case terminal
        case retryLater
    }

    var pendingReplies: () async -> [ChatNotificationReply]
    var remove: (String) async -> Void
    var isAuthorized: (String) -> Bool
    var send: (ChatNotificationReply) async -> SendOutcome
    var markRead: (String, String) async -> Void
    /// Returns whether the reply text was durably preserved. "Threw" and
    /// "no-opped" both mean "not preserved" — the caller must keep the entry
    /// queued rather than destroy the user's text (mirrors the Android drain,
    /// `ce19d8c6`).
    var saveDraft: (String, String) async -> Bool
    var postFailureNotice: (ChatNotificationReply) async -> Void
    /// `false` once the signed-in account no longer matches the one that
    /// owned this drain pass (e.g. a sign-out/sign-in raced the drain).
    /// Checked once per entry so a switch stops the pass immediately instead
    /// of sending — or marking read — on someone else's behalf.
    var isStillCurrentAccount: () -> Bool

    /// Returns whether at least one reply reached the server, so the caller
    /// can refresh the directory and application badge.
    ///
    /// Isolated to the main actor: `FishAppModel`'s wiring closes over
    /// `UNUserNotificationCenter`, `ConversationStore`, and other main-actor
    /// state (none of it `Sendable`), which makes the constructed drainer
    /// main-actor-isolated in Swift 6's region analysis. Running here keeps
    /// that data on the actor it belongs to instead of "sending" it into a
    /// nonisolated context. The app-target tests construct a drainer
    /// off-actor with only `Sendable` captures (an actor recorder, an
    /// `@unchecked Sendable` flag, plus plain values) and `await` this
    /// method, which is a safe one-shot transfer since nothing else holds
    /// that instance.
    @MainActor
    func run() async -> Bool {
        var sentAny = false
        for reply in await pendingReplies() {
            guard isStillCurrentAccount() else { return sentAny }
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
                if await saveDraft(reply.conversationId, reply.body) {
                    await postFailureNotice(reply)
                    await remove(reply.id)
                }
                // else: keep the entry durable; a later drain retries preservation.
            case .retryLater:
                break
            }
        }
        return sentAny
    }

    /// Classifies a send failure: terminal failures (auth lost, conversation
    /// gone, malformed request) are unrecoverable and should preserve the
    /// text instead of retrying; everything else (network blips, transient
    /// server errors) should stay queued for the next drain.
    static func outcome(for failure: ChatCommandFailure) -> SendOutcome {
        if failure.statusCode == 401 || failure.statusCode == 403 ||
            ["conversation_not_available", "invalid_request"].contains(failure.code) {
            return .terminal
        }
        return .retryLater
    }

    /// Joins a failed reply onto any existing composer draft, trimming and
    /// dropping empty sides so a first draft doesn't gain a stray newline.
    static func joinedDraft(existing: String?, reply: String) -> String {
        let trimmed = existing?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return [trimmed, reply].filter { !$0.isEmpty }.joined(separator: "\n")
    }
}
