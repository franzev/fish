package space.fishhub.android.messaging

import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage

/**
 * Delivery logic for queued notification replies. The worker owns retries;
 * this class owns the decisions. Marking read happens as soon as the reply is
 * processed for an authorized conversation — replying proves the user read
 * the notified message, independent of whether this send attempt succeeds.
 */
internal class ChatReplyDrain(
    private val pending: () -> List<PendingChatReply>,
    private val remove: (String) -> Unit,
    private val listConversations: suspend () -> ChatResult<AuthorizedChatDirectory>,
    private val send: suspend (conversationId: String, body: String, clientRequestId: String) -> ChatResult<ChatMessage>,
    private val markRead: suspend (conversationId: String, messageId: String) -> Unit,
    private val flushOutbox: suspend (conversationId: String) -> Unit,
    private val pendingOutboxCount: suspend (conversationId: String) -> Int,
    private val saveDraft: suspend (conversationId: String, body: String) -> Unit,
    private val notifyFailure: (conversationId: String?, messageId: String?) -> Unit,
) {
    enum class Outcome { Done, Retry }

    suspend fun run(attempt: Int): Outcome {
        val entries = pending()
        if (entries.isEmpty()) return Outcome.Done
        if (attempt >= MaxAttempts) {
            entries.forEach { reply ->
                suspendRunCatching { saveDraft(reply.conversationId, reply.body) }
                notifyFailure(reply.conversationId, reply.messageId)
                remove(reply.id)
            }
            return Outcome.Done
        }
        val directory = listConversations()
        if (directory !is ChatResult.Success) return Outcome.Retry
        val allowed = directory.value.conversations.mapTo(mutableSetOf()) { it.conversationId }
        var retry = false
        val flushTargets = mutableSetOf<String>()
        entries.forEach { reply ->
            if (reply.conversationId !in allowed) {
                // The current account cannot access this conversation; a reply
                // must not survive an account switch. The notice cannot deep
                // link anywhere useful.
                remove(reply.id)
                notifyFailure(null, null)
                return@forEach
            }
            reply.messageId?.let { messageId ->
                suspendRunCatching { markRead(reply.conversationId, messageId) }
            }
            when (val result = send(reply.conversationId, reply.body, reply.id)) {
                is ChatResult.Success -> {
                    remove(reply.id)
                    flushTargets += reply.conversationId
                }
                is ChatResult.Failure -> when (result.category) {
                    FailureCategory.Authentication, FailureCategory.Authorization -> {
                        remove(reply.id)
                        notifyFailure(reply.conversationId, reply.messageId)
                    }
                    else -> retry = true
                }
            }
        }
        flushTargets.forEach { conversationId ->
            suspendRunCatching { flushOutbox(conversationId) }
            val remaining = suspendRunCatching { pendingOutboxCount(conversationId) } ?: 0
            if (remaining > 0) retry = true
        }
        return if (retry) Outcome.Retry else Outcome.Done
    }

    companion object {
        const val MaxAttempts = 7
    }
}
