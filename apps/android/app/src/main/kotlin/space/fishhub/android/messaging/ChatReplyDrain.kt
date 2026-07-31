package space.fishhub.android.messaging

import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage

/**
 * Delivery logic for queued notification replies. The worker owns retry
 * pacing; this class owns the decisions, and each entry carries its own
 * attempt budget so chained work runs can neither destroy a fresh reply
 * nor grant an old one a new budget. Marking read happens as soon as an
 * authorized, unexpired entry is processed — replying proves the user read
 * the notified message, independent of the send outcome.
 */
internal class ChatReplyDrain(
    private val pending: () -> List<PendingChatReply>,
    private val remove: (String) -> Unit,
    private val recordAttempt: (String) -> Unit,
    private val listConversations: suspend () -> ChatResult<AuthorizedChatDirectory>,
    private val send: suspend (conversationId: String, body: String, clientRequestId: String) -> ChatResult<ChatMessage>,
    private val markRead: suspend (conversationId: String, messageId: String) -> Unit,
    private val flushOutbox: suspend (conversationId: String) -> Unit,
    private val pendingOutboxCount: suspend (conversationId: String) -> Int,
    private val saveDraft: suspend (conversationId: String, body: String) -> Boolean,
    private val notifyFailure: (conversationId: String?, messageId: String?) -> Unit,
) {
    enum class Outcome { Done, Retry }

    suspend fun run(): Outcome {
        val entries = pending()
        // The directory read is load-bearing beyond authorization: its
        // success upserts conversation rows into Room, which sendMessage
        // and saveDraft both require. Exhausted entries are preserved and
        // dropped only after a successful read for exactly that reason.
        val directory = listConversations()
        // Directory failures are treated as transient: sign-out clears the
        // store and cancels the worker, so a revoked session cannot retry
        // forever, and entry budgets are not spent on runs that never
        // reached a send.
        if (directory !is ChatResult.Success || !directory.value.isAuthoritative) {
            // A cached directory is safe for rendering but cannot prove that
            // a conversation is still authorized. Keep every reply queued so
            // a new conversation that has never reached Room cannot lose its
            // text while the remote authorization read is unavailable.
            return Outcome.Retry
        }
        val allowed = directory.value.conversations.mapTo(mutableSetOf()) { it.conversationId }
        var retry = false
        entries.forEach { reply ->
            if (reply.conversationId !in allowed) {
                // The current account cannot access this conversation; a
                // reply must not survive an account switch, and neither a
                // draft nor a deep link can land anywhere useful.
                remove(reply.id)
                runCatching { notifyFailure(null, null) }
                return@forEach
            }
            if (reply.attempts >= MaxAttempts) {
                if (suspendRunCatching { saveDraft(reply.conversationId, reply.body) } == true) {
                    runCatching { notifyFailure(reply.conversationId, reply.messageId) }
                    remove(reply.id)
                } else {
                    // Preservation failed; keep the entry so a later run
                    // retries the draft instead of destroying the text.
                    retry = true
                }
                return@forEach
            }
            reply.messageId?.let { messageId ->
                suspendRunCatching { markRead(reply.conversationId, messageId) }
            }
            when (val result = send(reply.conversationId, reply.body, reply.id)) {
                is ChatResult.Success -> remove(reply.id)
                is ChatResult.Failure -> when (result.category) {
                    FailureCategory.Authentication, FailureCategory.Authorization -> {
                        remove(reply.id)
                        runCatching { notifyFailure(reply.conversationId, reply.messageId) }
                    }
                    else -> {
                        recordAttempt(reply.id)
                        retry = true
                    }
                }
            }
        }
        // The worker owns final delivery for the whole text outbox: a send
        // that hit a network failure was queued there with optimistic
        // success, and the composer's own flush only runs while its
        // screen is open. Every authorized conversation is checked, so a
        // retry run with an empty reply store still flushes.
        allowed.forEach { conversationId ->
            if ((suspendRunCatching { pendingOutboxCount(conversationId) } ?: 0) == 0) return@forEach
            suspendRunCatching { flushOutbox(conversationId) }
            if ((suspendRunCatching { pendingOutboxCount(conversationId) } ?: 0) > 0) retry = true
        }
        return if (retry) Outcome.Retry else Outcome.Done
    }

    companion object {
        const val MaxAttempts = 7
    }
}
