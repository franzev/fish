package space.fishhub.android.messaging

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.UserRole

class ChatReplyDrainTest {
    private val reply = PendingChatReply("reply-1", "conv-1", "hello", "msg-1")

    private class Recorder {
        val removed = mutableListOf<String>()
        val markedRead = mutableListOf<Pair<String, String>>()
        val flushed = mutableListOf<String>()
        val drafts = mutableListOf<Pair<String, String>>()
        val notices = mutableListOf<Pair<String?, String?>>()
    }

    private fun sentMessage() = ChatMessage(
        id = "server-1",
        conversationId = "conv-1",
        senderId = "me",
        senderRole = UserRole.Client,
        body = "hello",
        clientRequestId = "reply-1",
        createdAt = "2026-07-30T00:00:00Z",
    )

    private fun directory(vararg conversationIds: String): ChatResult<AuthorizedChatDirectory> =
        ChatResult.Success(
            AuthorizedChatDirectory(
                currentUser = AuthorizedChatIdentity(
                    userId = "me",
                    role = UserRole.Client,
                    displayName = "Me",
                ),
                conversations = conversationIds.map { sampleConversation(it) },
            ),
        )

    private fun drain(
        recorder: Recorder,
        entries: List<PendingChatReply> = listOf(reply),
        listConversations: suspend () -> ChatResult<AuthorizedChatDirectory> = { directory("conv-1") },
        send: suspend (String, String, String) -> ChatResult<ChatMessage> =
            { _, _, _ -> ChatResult.Success(sentMessage()) },
        pendingOutboxCount: suspend (String) -> Int = { 0 },
    ) = ChatReplyDrain(
        pending = { entries },
        remove = { recorder.removed += it },
        listConversations = listConversations,
        send = send,
        markRead = { conversationId, messageId -> recorder.markedRead += conversationId to messageId },
        flushOutbox = { recorder.flushed += it },
        pendingOutboxCount = pendingOutboxCount,
        saveDraft = { conversationId, body -> recorder.drafts += conversationId to body },
        notifyFailure = { conversationId, messageId -> recorder.notices += conversationId to messageId },
    )

    @Test
    fun `sends, marks read, flushes, and removes on success`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf("conv-1" to "msg-1"), recorder.markedRead)
        assertEquals(listOf("conv-1"), recorder.flushed)
        assertTrue(recorder.notices.isEmpty())
    }

    @Test
    fun `skips mark read when the reply has no message id`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, entries = listOf(reply.copy(messageId = null))).run(attempt = 0)
        assertTrue(recorder.markedRead.isEmpty())
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `drops unauthorized replies with a generic notice`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, listConversations = { directory("other-conv") }).run(attempt = 0)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf<Pair<String?, String?>>(null to null), recorder.notices)
        assertTrue(recorder.markedRead.isEmpty())
    }

    @Test
    fun `retries when the directory read fails`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            listConversations = {
                ChatResult.Failure("offline", recoverable = true, category = FailureCategory.Network)
            },
        ).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
    }

    @Test
    fun `drops with a notice on authorization failure`() = runBlocking {
        val recorder = Recorder()
        drain(
            recorder,
            send = { _, _, _ ->
                ChatResult.Failure("gone", recoverable = false, category = FailureCategory.Authorization)
            },
        ).run(attempt = 0)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf<Pair<String?, String?>>("conv-1" to "msg-1"), recorder.notices)
    }

    @Test
    fun `keeps other failures durable and signals retry`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            send = { _, _, _ ->
                ChatResult.Failure("later", recoverable = true, category = FailureCategory.Remote)
            },
        ).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
        assertTrue(recorder.notices.isEmpty())
    }

    @Test
    fun `retries while the outbox still holds queued sends`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder, pendingOutboxCount = { 1 }).run(attempt = 0)
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `exhaustion saves drafts, notices, and stops`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder).run(attempt = ChatReplyDrain.MaxAttempts)
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("conv-1" to "hello"), recorder.drafts)
        assertEquals(listOf<Pair<String?, String?>>("conv-1" to "msg-1"), recorder.notices)
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `empty store is done without side effects`() = runBlocking {
        val recorder = Recorder()
        assertEquals(ChatReplyDrain.Outcome.Done, drain(recorder, entries = emptyList()).run(attempt = 0))
        assertTrue(recorder.removed.isEmpty() && recorder.flushed.isEmpty())
    }

    private fun sampleConversation(id: String) =
        space.fishhub.android.data.chat.AuthorizedConversation(
            conversationId = id,
            currentUserId = "me",
            currentUserRole = UserRole.Client,
            currentUserDisplayName = "Me",
            participantId = "coach",
            participantRole = UserRole.Coach,
            participantDisplayName = "Coach",
            latestMessageText = null,
            latestMessageCreatedAt = null,
            unreadCount = 0,
        )
}
