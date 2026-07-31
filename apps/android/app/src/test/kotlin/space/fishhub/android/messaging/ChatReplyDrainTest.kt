package space.fishhub.android.messaging

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.fishhub.android.data.chat.AuthorizedChatDirectory
import space.fishhub.android.data.chat.AuthorizedChatIdentity
import space.fishhub.android.data.chat.AuthorizedConversation
import space.fishhub.android.data.chat.ChatResult
import space.fishhub.android.data.chat.FailureCategory
import space.fishhub.android.data.chat.model.ChatMessage
import space.fishhub.android.data.chat.model.UserRole

class ChatReplyDrainTest {
    private val reply = PendingChatReply("reply-1", "conv-1", "hello", "msg-1")

    private class Recorder {
        val removed = mutableListOf<String>()
        val markedRead = mutableListOf<Pair<String, String>>()
        val sendCalls = mutableListOf<String>()
        val attemptsRecorded = mutableListOf<String>()
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
        outboxCounts: (String) -> Int = { 0 },
        saveDraftResult: Boolean = true,
    ) = ChatReplyDrain(
        pending = { entries },
        remove = { recorder.removed += it },
        recordAttempt = { recorder.attemptsRecorded += it },
        listConversations = listConversations,
        send = { conversationId, body, clientRequestId ->
            recorder.sendCalls += clientRequestId
            send(conversationId, body, clientRequestId)
        },
        markRead = { conversationId, messageId -> recorder.markedRead += conversationId to messageId },
        flushOutbox = { recorder.flushed += it },
        pendingOutboxCount = { conversationId ->
            if (conversationId in recorder.flushed) 0 else outboxCounts(conversationId)
        },
        saveDraft = { conversationId, body ->
            recorder.drafts += conversationId to body
            saveDraftResult
        },
        notifyFailure = { conversationId, messageId -> recorder.notices += conversationId to messageId },
    )

    @Test
    fun `sends, marks read, and removes on success`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder).run()
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf("conv-1" to "msg-1"), recorder.markedRead)
        assertTrue(recorder.notices.isEmpty())
        assertTrue(recorder.flushed.isEmpty())
    }

    @Test
    fun `skips mark read when the reply has no message id`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, entries = listOf(reply.copy(messageId = null))).run()
        assertTrue(recorder.markedRead.isEmpty())
        assertEquals(listOf("reply-1"), recorder.removed)
    }

    @Test
    fun `drops unauthorized replies without sending or flushing`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, listConversations = { directory("other-conv") }).run()
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf<Pair<String?, String?>>(null to null), recorder.notices)
        assertTrue(recorder.markedRead.isEmpty())
        assertTrue(recorder.sendCalls.isEmpty())
        assertTrue(recorder.flushed.isEmpty())
    }

    @Test
    fun `retries when the directory read fails`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            listConversations = {
                ChatResult.Failure("offline", recoverable = true, category = FailureCategory.Network)
            },
        ).run()
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
        assertTrue(recorder.sendCalls.isEmpty())
        assertTrue(recorder.attemptsRecorded.isEmpty())
    }

    @Test
    fun `retries when the directory is only a cache fallback`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            listConversations = {
                ChatResult.Success(
                    directory("conv-1").value.copy(isAuthoritative = false),
                )
            },
        ).run()
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
        assertTrue(recorder.sendCalls.isEmpty())
        assertTrue(recorder.attemptsRecorded.isEmpty())
    }

    @Test
    fun `authorization failure drops with a notice but still marks read`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            send = { _, _, _ ->
                ChatResult.Failure("gone", recoverable = false, category = FailureCategory.Authorization)
            },
        ).run()
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf<Pair<String?, String?>>("conv-1" to "msg-1"), recorder.notices)
        assertEquals(listOf("conv-1" to "msg-1"), recorder.markedRead)
    }

    @Test
    fun `other failures record an attempt and signal retry`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            send = { _, _, _ ->
                ChatResult.Failure("later", recoverable = true, category = FailureCategory.Remote)
            },
        ).run()
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
        assertTrue(recorder.notices.isEmpty())
        assertEquals(listOf("reply-1"), recorder.attemptsRecorded)
    }

    @Test
    fun `mixed outcomes remove successes and keep failures`() = runBlocking {
        val recorder = Recorder()
        val second = PendingChatReply("reply-2", "conv-1", "again", "msg-2")
        val outcome = drain(
            recorder,
            entries = listOf(reply, second),
            send = { _, _, clientRequestId ->
                if (clientRequestId == "reply-1") {
                    ChatResult.Success(sentMessage())
                } else {
                    ChatResult.Failure("later", recoverable = true, category = FailureCategory.Network)
                }
            },
        ).run()
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertEquals(listOf("reply-1"), recorder.removed)
        assertEquals(listOf("reply-2"), recorder.attemptsRecorded)
    }

    @Test
    fun `flushes queued outbox rows even when the reply store is empty`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(recorder, entries = emptyList(), outboxCounts = { 1 }).run()
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("conv-1"), recorder.flushed)
    }

    @Test
    fun `signals retry while a flush leaves rows behind`() = runBlocking {
        val recorder = Recorder()
        val stubborn = ChatReplyDrain(
            pending = { emptyList() },
            remove = {},
            recordAttempt = {},
            listConversations = { directory("conv-1") },
            send = { _, _, _ -> ChatResult.Success(sentMessage()) },
            markRead = { _, _ -> },
            flushOutbox = { recorder.flushed += it },
            pendingOutboxCount = { 1 },
            saveDraft = { _, _ -> true },
            notifyFailure = { _, _ -> },
        )
        assertEquals(ChatReplyDrain.Outcome.Retry, stubborn.run())
        assertEquals(listOf("conv-1"), recorder.flushed)
    }

    @Test
    fun `exhausted entries become drafts while fresh entries still send`() = runBlocking {
        val recorder = Recorder()
        val exhausted = PendingChatReply("reply-old", "conv-1", "stuck", "msg-0", attempts = ChatReplyDrain.MaxAttempts)
        val outcome = drain(recorder, entries = listOf(exhausted, reply)).run()
        assertEquals(ChatReplyDrain.Outcome.Done, outcome)
        assertEquals(listOf("conv-1" to "stuck"), recorder.drafts)
        assertEquals(listOf<Pair<String?, String?>>("conv-1" to "msg-0"), recorder.notices)
        assertEquals(listOf("reply-old", "reply-1"), recorder.removed)
        assertEquals(listOf("reply-1"), recorder.sendCalls)
    }

    @Test
    fun `a failed draft keeps the exhausted entry for another run`() = runBlocking {
        val recorder = Recorder()
        val exhausted = reply.copy(attempts = ChatReplyDrain.MaxAttempts)
        val outcome = drain(recorder, entries = listOf(exhausted), saveDraftResult = false).run()
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.removed.isEmpty())
        assertTrue(recorder.notices.isEmpty())
    }

    @Test
    fun `an entry one attempt under the limit still sends`() = runBlocking {
        val recorder = Recorder()
        drain(recorder, entries = listOf(reply.copy(attempts = ChatReplyDrain.MaxAttempts - 1))).run()
        assertEquals(listOf("reply-1"), recorder.sendCalls)
        assertTrue(recorder.drafts.isEmpty())
    }

    @Test
    fun `empty store and empty outboxes finish without side effects`() = runBlocking {
        val recorder = Recorder()
        assertEquals(ChatReplyDrain.Outcome.Done, drain(recorder, entries = emptyList()).run())
        assertTrue(recorder.removed.isEmpty() && recorder.flushed.isEmpty() && recorder.sendCalls.isEmpty())
    }

    @Test
    fun `empty store with a failing directory still retries for the outbox`() = runBlocking {
        val recorder = Recorder()
        val outcome = drain(
            recorder,
            entries = emptyList(),
            listConversations = {
                ChatResult.Failure("offline", recoverable = true, category = FailureCategory.Network)
            },
        ).run()
        assertEquals(ChatReplyDrain.Outcome.Retry, outcome)
        assertTrue(recorder.flushed.isEmpty())
    }

    private fun sampleConversation(id: String) = AuthorizedConversation(
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
